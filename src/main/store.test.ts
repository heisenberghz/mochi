import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '../shared/constants';
import v1Fixture from '../domain/fixtures/state-v1.json';
import { Store } from './store';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mochi-store-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('Store', () => {
  it('starts from defaults when there is no file yet', () => {
    const store = new Store(dir);

    expect(store.state.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(store.state.settings.petName).toBe('Mochi');
    expect(store.state.hasSeenWelcome).toBe(false);
    expect(store.state.focus.active).toBeNull();
  });

  it('writes state that it can read back', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Biscuit';
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Biscuit');
  });

  it('leaves the state file as valid JSON', () => {
    const store = new Store(dir);
    store.flush();

    const raw = readFileSync(join(dir, 'state.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('keeps the previous state as a backup', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'First';
    store.flush();

    store.state.settings.petName = 'Second';
    store.flush();

    const backup = JSON.parse(readFileSync(join(dir, 'state.json.bak'), 'utf8'));
    expect(backup.settings.petName).toBe('First');
  });

  it('leaves no temp file behind after a successful save', () => {
    const store = new Store(dir);
    store.flush();
    store.flush();

    const leftovers = readFileSync(join(dir, 'state.json'), 'utf8');
    expect(leftovers.length).toBeGreaterThan(0);
    expect(existsSync(join(dir, 'state.json.tmp'))).toBe(false);
  });

  it('cleans up temp files left behind by a crash', () => {
    const stale = join(dir, 'state.json.tmp-9999-1');
    writeFileSync(stale, 'half written');
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    utimesSync(stale, old, old);

    new Store(dir);

    expect(existsSync(stale)).toBe(false);
  });

  it('keeps a temp file that is too recent to be stale', () => {
    const recent = join(dir, 'state.json.tmp-9999-2');
    writeFileSync(recent, 'in flight');

    new Store(dir);

    expect(existsSync(recent)).toBe(true);
  });

  it('survives being saved many times in a row', () => {
    const store = new Store(dir);
    for (let i = 0; i < 50; i += 1) {
      store.state.pet.xp = i;
      store.save();
    }
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.pet.xp).toBe(49);
  });
});

describe('Store recovery', () => {  function corruptFiles(): string[] {
    return readdirSync(dir)
      .filter((name) => name.startsWith('state.corrupt-'))
      .map((name) => join(dir, name));
  }

  it('reports no recovery when everything is fine', () => {
    const store = new Store(dir);
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.recovery).toBeNull();
    expect(reloaded.isReadOnly).toBe(false);
  });

  it('quarantines an unreadable main file and keeps it on disk', () => {
    writeFileSync(join(dir, 'state.json'), '{ truncated');

    const store = new Store(dir);

    expect(store.recovery?.kind).toBe('quarantined');
    expect(corruptFiles()).toHaveLength(1);
    expect(readFileSync(corruptFiles()[0]!, 'utf8')).toContain('truncated');
  });

  it('falls back to the backup when the main file is unreadable', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Recovered';
    store.flush();
    store.state.settings.petName = 'Overwritten';
    store.flush();

    // The backup holds 'Recovered'; corrupt the main file.
    writeFileSync(join(dir, 'state.json'), 'not json at all');

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Recovered');
    expect(reloaded.recovery?.kind).toBe('quarantined');
  });

  it('quarantines both files when both are unreadable', () => {
    writeFileSync(join(dir, 'state.json'), 'broken');
    writeFileSync(join(dir, 'state.json.bak'), 'also broken');

    const store = new Store(dir);

    expect(store.recovery?.kind).toBe('quarantined');
    expect(store.recovery?.files).toHaveLength(2);
    expect(corruptFiles()).toHaveLength(2);
  });

  it('starts from defaults when both files are unreadable', () => {
    writeFileSync(join(dir, 'state.json'), 'broken');
    writeFileSync(join(dir, 'state.json.bak'), 'also broken');

    const store = new Store(dir);

    expect(store.state.settings.petName).toBe('Mochi');
    expect(store.state.pet.xp).toBe(0);
  });

  it('tells the user where the quarantined files are', () => {
    writeFileSync(join(dir, 'state.json'), 'broken');

    const store = new Store(dir);

    expect(store.recovery?.folder).toBe(dir);
    expect(store.recovery?.message).toMatch(/could not read/i);
  });

  it('never overwrites a file written by a newer Mochi', () => {
    const newer = JSON.stringify({ version: 99, pet: {}, settings: {} });
    writeFileSync(join(dir, 'state.json'), newer);

    const store = new Store(dir);
    store.state.settings.petName = 'Should not be written';
    store.save();

    expect(readFileSync(join(dir, 'state.json'), 'utf8')).toBe(newer);
  });

  it('goes read-only when a newer Mochi owns the file', () => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ version: 99 }));

    const store = new Store(dir);

    expect(store.isReadOnly).toBe(true);
    expect(store.recovery?.kind).toBe('newer-version');
  });

  it('does not quarantine a file it must not touch', () => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ version: 99 }));

    new Store(dir);

    expect(corruptFiles()).toHaveLength(0);
    expect(existsSync(join(dir, 'state.json'))).toBe(true);
  });

  it('recovers its own file after a corrupt file is quarantined', () => {
    writeFileSync(join(dir, 'state.json'), 'broken');

    const store = new Store(dir);
    store.state.settings.petName = 'Fresh';
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Fresh');
    expect(reloaded.recovery).toBeNull();
  });
});

describe('Store write scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not write the moment it is asked to', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Later';

    store.save();

    expect(existsSync(join(dir, 'state.json'))).toBe(false);
  });

  it('writes after the debounce', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Later';

    store.save();
    vi.advanceTimersByTime(499);
    expect(existsSync(join(dir, 'state.json'))).toBe(false);

    vi.advanceTimersByTime(1);
    expect(existsSync(join(dir, 'state.json'))).toBe(true);
  });

  it('writes the latest state, not the state at the time of the call', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'First';
    store.save();
    store.state.settings.petName = 'Second';
    store.save();

    vi.advanceTimersByTime(500);

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Second');
  });

  it('coalesces a burst of changes into one write', () => {
    const store = new Store(dir);
    for (let i = 0; i < 20; i += 1) {
      store.state.pet.xp = i;
      store.save();
    }

    vi.advanceTimersByTime(500);

    const reloaded = new Store(dir);
    expect(reloaded.state.pet.xp).toBe(19);
  });

  it('writes immediately when flushed', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Now';

    store.save();
    store.flush();

    expect(existsSync(join(dir, 'state.json'))).toBe(true);
  });

  it('does not write twice when flushed after a write already happened', () => {
    const store = new Store(dir);
    store.state.pet.xp = 1;

    store.flush();
    store.state.pet.xp = 2;
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.pet.xp).toBe(2);
  });

  it('cancels the pending write when flushed', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Flushed';

    store.save();
    store.flush();
    vi.advanceTimersByTime(5000);

    // One file, not a second one from the timer.
    const stateFiles = readdirSync(dir).filter((name) => name === 'state.json');
    expect(stateFiles).toHaveLength(1);
  });

  it('does not write again when the state has not changed', () => {
    const store = new Store(dir);
    store.flush();
    const first = statSync(join(dir, 'state.json')).mtimeMs;

    store.flush();
    vi.advanceTimersByTime(5000);

    expect(statSync(join(dir, 'state.json')).mtimeMs).toBe(first);
  });

  it('writes straight away when flushed, even if save was never called', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'StraightAway';

    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('StraightAway');
  });

  it('never leaves the saved state more than two seconds behind', () => {
    const store = new Store(dir);
    let lastWritten = -1;

    // A change every 100 ms, for ten seconds.
    for (let tick = 0; tick < 100; tick += 1) {
      store.state.pet.xp = tick;
      store.save();
      vi.advanceTimersByTime(100);

      if (!existsSync(join(dir, 'state.json'))) continue;

      const onDisk = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as {
        pet: { xp: number };
      };
      // Twenty ticks is two seconds.
      expect(tick - onDisk.pet.xp).toBeLessThanOrEqual(20);
      lastWritten = onDisk.pet.xp;
    }

    expect(lastWritten).toBeGreaterThanOrEqual(79);
  });

  it('does not write when nothing actually changed', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Same';

    store.flush();
    const first = statSync(join(dir, 'state.json')).mtimeMs;

    store.state.pet.energy = 80; // already the default
    store.flush();
    vi.advanceTimersByTime(5000);

    expect(statSync(join(dir, 'state.json')).mtimeMs).toBe(first);
  });

  it('writes again once the state really changes', () => {
    const store = new Store(dir);
    store.flush();
    const first = statSync(join(dir, 'state.json')).mtimeMs;

    store.state.pet.xp = 7;
    store.flush();

    expect(statSync(join(dir, 'state.json')).mtimeMs).not.toBe(first);
  });

  it('keeps working when the file cannot be written', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'One';

    store.flush();
    store.state.settings.petName = 'Two';
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Two');
  });

  it('recovers after a corrupt file is quarantined', () => {
    writeFileSync(join(dir, 'state.json'), 'broken');

    const store = new Store(dir);
    store.state.settings.petName = 'Fresh';
    store.flush();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Fresh');
  });

  it('upgrades a version 1 file on disk', () => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(v1Fixture));

    const store = new Store(dir);

    expect(store.state.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(store.state.pet.xp).toBe(310);
    expect(store.state.settings.petName).toBe('Mochi');
    expect(store.state.focus.config.workMin).toBe(25);
    expect(store.recovery).toBeNull();
  });

  it('keeps a copy of the file as it was before the migration', () => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(v1Fixture));

    const store = new Store(dir);
    store.flush();

    const backupPath = join(dir, 'state.pre-v1.bak');
    expect(existsSync(backupPath)).toBe(true);

    const backup = JSON.parse(readFileSync(backupPath, 'utf8')) as { version: number };
    expect(backup.version).toBe(1);
  });

  it('writes the upgraded file so the migration only happens once', () => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(v1Fixture));

    const store = new Store(dir);
    store.flush();

    const onDisk = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as {
      version: number;
    };
    expect(onDisk.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('does not take a pre-migration copy of a file that was already current', () => {
    const store = new Store(dir);
    store.flush();

    expect(existsSync(join(dir, 'state.pre-v1.bak'))).toBe(false);
  });
});
