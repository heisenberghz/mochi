import {
  copyFileSync,
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';

/**
 * The file operations `writeFileAtomically` needs. Injecting them keeps the
 * "the old file survives a failed write" guarantee testable without having to
 * make a real Windows rename fail.
 */
export interface AtomicFileOps {
  writeFile(path: string, data: string, options: { encoding: 'utf8'; flag: 'wx' }): void;
  rename(from: string, to: string): void;
  copyFile(from: string, to: string): void;
  exists(path: string): boolean;
  unlink(path: string): void;
  /** Flush the file to stable storage, if the platform allows it. */
  flush?(path: string): void;
}

export const nodeFileOps: AtomicFileOps = {
  writeFile: (path, data, options) => writeFileSync(path, data, options),
  rename: (from, to) => renameSync(from, to),
  copyFile: (from, to) => copyFileSync(from, to),
  exists: (path) => existsSync(path),
  unlink: (path) => unlinkSync(path),
};

export interface AtomicWriteResult {
  ok: boolean;
  /** Where the new content was written. Still on disk when `ok` is false. */
  tempPath: string;
  error?: string;
}

export interface AtomicWriteOptions {
  /** Backoff between rename attempts, in milliseconds. */
  retryDelaysMs?: number[];
  /** Injected for tests so they do not actually wait. */
  sleep?: (ms: number) => void;
}

const DEFAULT_RETRY_DELAYS_MS = [25, 60, 150];
const MAX_TEMP_NAME_ATTEMPTS = 5;

let tempCounter = 0;

/**
 * Replace `target` with `payload` without ever truncating it.
 *
 * The content goes to a unique temp file, is flushed to disk, and is only
 * then renamed over the target. If the rename keeps failing — Windows refuses
 * a replace while a virus scanner holds the file open — the target is left
 * exactly as it was. It is never written to directly, because writing to it
 * directly is how the previous version could destroy the only good copy.
 */
export function writeFileAtomically(
  target: string,
  payload: string,
  ops: AtomicFileOps = nodeFileOps,
  options: AtomicWriteOptions = {},
): AtomicWriteResult {
  const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? sleepSync;

  let tempPath: string;
  try {
    tempPath = writeTemp(target, payload, ops);
  } catch (error) {
    return {
      ok: false,
      tempPath: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    ops.flush?.(tempPath);
  } catch {
    // Durability is best effort. Some filesystems refuse to flush.
  }

  // Keep the previous good state as the backup before we replace it. A failed
  // backup must not stop the save.
  if (ops.exists(target)) {
    try {
      ops.copyFile(target, `${target}.bak`);
    } catch {
      // Best effort.
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      ops.rename(tempPath, target);
      return { ok: true, tempPath };
    } catch (error) {
      lastError = error;
      const delay = retryDelays[attempt];
      if (attempt < retryDelays.length && delay !== undefined) sleep(delay);
    }
  }

  // Every attempt failed. The target still holds the last good state and the
  // temp file stays on disk, so no bytes are lost.
  return {
    ok: false,
    tempPath,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

/**
 * Write to a temp file that cannot collide with an existing one. The `wx` flag
 * refuses to clobber, so a leftover temp from a crashed run is never mistaken
 * for this write.
 */
function writeTemp(target: string, payload: string, ops: AtomicFileOps): string {
  for (let attempt = 0; attempt < MAX_TEMP_NAME_ATTEMPTS; attempt += 1) {
    tempCounter += 1;
    const tempPath = `${target}.tmp-${process.pid}-${tempCounter}`;
    try {
      ops.writeFile(tempPath, payload, { encoding: 'utf8', flag: 'wx' });
      return tempPath;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`could not find a free temp file name for ${target}`);
}

/** Block the thread briefly. Only used on the rare failure path. */
function sleepSync(ms: number): void {
  const buffer = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buffer, 0, 0, ms);
}
