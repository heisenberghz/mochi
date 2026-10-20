import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
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
