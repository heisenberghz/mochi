import { describe, expect, it } from 'vitest';
import { writeFileAtomically, type AtomicFileOps } from './atomic-write';

interface FakeWorld {
  ops: AtomicFileOps;
  files: Map<string, string>;
  renameAttempts: number;
  slept: number[];
}

function fakeWorld(overrides: Partial<AtomicFileOps> = {}): FakeWorld {
  const files = new Map<string, string>();
  const world: FakeWorld = {
    files,
    renameAttempts: 0,
    slept: [],
    ops: {} as AtomicFileOps,
  };

  const base: AtomicFileOps = {
    writeFile: (path, data) => {
      files.set(path, data);
    },
    rename: (from, to) => {
      const data = files.get(from);
      if (data === undefined) throw new Error(`ENOENT: ${from}`);
      files.set(to, data);
      files.delete(from);
    },
    copyFile: (from, to) => {
      const data = files.get(from);
      if (data === undefined) throw new Error(`ENOENT: ${from}`);
      files.set(to, data);
    },
    exists: (path) => files.has(path),
    unlink: (path) => {
      files.delete(path);
    },
  };

  // Count every rename, including the ones a test replaces with a failing
  // implementation, so the retry behaviour can be asserted.
  const rename = overrides.rename ?? base.rename;

  world.ops = {
    ...base,
    ...overrides,
    rename: (from, to) => {
      world.renameAttempts += 1;
      rename(from, to);
    },
  };

  return world;
}

const NO_WAIT = { sleep: () => {}, retryDelaysMs: [0, 0, 0] };

describe('writeFileAtomically', () => {
  it('replaces the target with the new content', () => {
    const world = fakeWorld();
    world.files.set('state.json', 'old');

    const result = writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(result.ok).toBe(true);
    expect(world.files.get('state.json')).toBe('new');
  });

  it('keeps the previous content as a backup', () => {
    const world = fakeWorld();
    world.files.set('state.json', 'old');

    writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(world.files.get('state.json.bak')).toBe('old');
  });

  it('does not create a backup when there was no previous file', () => {
    const world = fakeWorld();

    writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(world.files.has('state.json.bak')).toBe(false);
  });

  it('leaves no temp file behind after a successful write', () => {
    const world = fakeWorld();
    world.files.set('state.json', 'old');

    const result = writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(world.files.has(result.tempPath)).toBe(false);
  });

  it('uses a different temp file for every write', () => {
    const world = fakeWorld();

    const first = writeFileAtomically('state.json', 'a', world.ops, NO_WAIT);
    const second = writeFileAtomically('state.json', 'b', world.ops, NO_WAIT);

    expect(first.tempPath).not.toBe(second.tempPath);
  });

  describe('when the rename keeps failing', () => {
    const failingRename = {
      rename: (): never => {
        throw Object.assign(new Error('EPERM: operation not permitted'), {
          code: 'EPERM',
        });
      },
    };

    it('leaves the previous file exactly as it was', () => {
      const world = fakeWorld(failingRename);
      world.files.set('state.json', 'the good state');

      const result = writeFileAtomically('state.json', 'the new state', world.ops, NO_WAIT);

      expect(result.ok).toBe(false);
      expect(world.files.get('state.json')).toBe('the good state');
    });

    it('never writes to the target directly', () => {
      const world = fakeWorld(failingRename);
      world.files.set('state.json', 'the good state');

      writeFileAtomically('state.json', 'the new state', world.ops, NO_WAIT);

      // The target is only ever touched by rename, which failed.
      expect(world.files.get('state.json')).not.toContain('the new state');
    });

    it('keeps the new content in the temp file rather than losing it', () => {
      const world = fakeWorld(failingRename);

      const result = writeFileAtomically('state.json', 'the new state', world.ops, NO_WAIT);

      expect(result.tempPath).not.toBe('');
      expect(world.files.get(result.tempPath)).toBe('the new state');
    });

    it('reports why it failed', () => {
      const world = fakeWorld(failingRename);

      const result = writeFileAtomically('state.json', 'x', world.ops, NO_WAIT);

      expect(result.error).toMatch(/EPERM/);
    });

    it('retries the rename before giving up', () => {
      const world = fakeWorld(failingRename);

      writeFileAtomically('state.json', 'x', world.ops, NO_WAIT);

      // One initial attempt plus one per configured delay.
      expect(world.renameAttempts).toBe(4);
    });

    it('waits between attempts', () => {
      const world = fakeWorld(failingRename);
      const slept: number[] = [];

      writeFileAtomically('state.json', 'x', world.ops, {
        sleep: (ms) => slept.push(ms),
        retryDelaysMs: [10, 20, 30],
      });

      expect(slept).toEqual([10, 20, 30]);
    });
  });

  it('succeeds when a later rename attempt works', () => {
    let attempts = 0;
    const world = fakeWorld({
      rename: (from, to) => {
        attempts += 1;
        if (attempts < 3) throw new Error('EBUSY');
        const data = world.files.get(from);
        if (data === undefined) throw new Error('ENOENT');
        world.files.set(to, data);
        world.files.delete(from);
      },
    });

    const result = writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(result.ok).toBe(true);
    expect(world.files.get('state.json')).toBe('new');
  });

  it('flushes the temp file before trying to replace the target', () => {
    const order: string[] = [];
    const world = fakeWorld({
      writeFile: (path, data) => {
        order.push('write');
        world.files.set(path, data);
      },
      flush: () => {
        order.push('flush');
      },
      rename: (from, to) => {
        order.push('rename');
        const data = world.files.get(from);
        if (data === undefined) throw new Error('ENOENT');
        world.files.set(to, data);
        world.files.delete(from);
      },
    });

    writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(order).toEqual(['write', 'flush', 'rename']);
  });

  it('still replaces the target when the flush fails', () => {
    const world = fakeWorld({
      flush: () => {
        throw new Error('ENOTSUP');
      },
    });

    const result = writeFileAtomically('state.json', 'new', world.ops, NO_WAIT);

    expect(result.ok).toBe(true);
    expect(world.files.get('state.json')).toBe('new');
  });
});
