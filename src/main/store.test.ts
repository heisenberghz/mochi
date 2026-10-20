import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    expect(store.state.version).toBe(1);
    expect(store.state.settings.petName).toBe('Mochi');
    expect(store.state.hasSeenWelcome).toBe(false);
  });

  it('writes state that it can read back', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Biscuit';
    store.save();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Biscuit');
  });

  it('leaves the state file as valid JSON', () => {
    const store = new Store(dir);
    store.save();

    const raw = readFileSync(join(dir, 'state.json'), 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('keeps the previous state as a backup', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'First';
    store.save();

    store.state.settings.petName = 'Second';
    store.save();

    const backup = JSON.parse(readFileSync(join(dir, 'state.json.bak'), 'utf8'));
    expect(backup.settings.petName).toBe('First');
  });

  it('leaves no temp file behind after a successful save', () => {
    const store = new Store(dir);
    store.save();
    store.save();

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

  it('falls back to the backup when the main file is unreadable', () => {
    const store = new Store(dir);
    store.state.settings.petName = 'Good';
    store.save();
    store.state.settings.petName = 'Newer';
    store.save();

    // The backup now holds 'Good'; corrupt the primary.
    writeFileSync(join(dir, 'state.json'), '{ this is not json');

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Good');
  });

  it('survives being saved many times in a row', () => {
    const store = new Store(dir);
    for (let i = 0; i < 50; i += 1) {
      store.state.pet.xp = i;
      store.save();
    }

    const reloaded = new Store(dir);
    expect(reloaded.state.pet.xp).toBe(49);
  });
});

describe('Store recovery', () => {
  function corruptFiles(): string[] {
    return readdirSync(dir)
      .filter((name) => name.startsWith('state.corrupt-'))
      .map((name) => join(dir, name));
  }

  it('reports no recovery when everything is fine', () => {
    const store = new Store(dir);
    store.save();

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
    store.save();
    store.state.settings.petName = 'Overwritten';
    store.save();

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
    store.save();

    const reloaded = new Store(dir);
    expect(reloaded.state.settings.petName).toBe('Fresh');
    expect(reloaded.recovery).toBeNull();
  });
});
