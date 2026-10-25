import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { CURRENT_SCHEMA_VERSION } from '../shared/constants';
import type { PetView, RecoveryNotice, Settings } from '../shared/types';
import type { FocusPersisted } from '../domain/focus-timer';
import {
  defaultPersistedState,
  migrateState,
  todayKey,
  type PersistedState,
} from '../domain/persistence-schema';
import { nodeFileOps, writeFileAtomically, type AtomicFileOps } from './atomic-write';

/** A temp file older than this is left over from a crash and is safe to drop. */
const STALE_TEMP_AGE_MS = 60 * 60 * 1000;

/**
 * How long a write may be deferred, and how long it may be deferred in total.
 * Together they mean a forced kill can never lose more than two seconds of
 * changes.
 */
const PERSIST_DEBOUNCE_MS = 500;
const PERSIST_MAX_DELAY_MS = 2000;

const fileOps: AtomicFileOps = {
  ...nodeFileOps,
  /** Push the bytes to stable storage, so a crash cannot leave a short file. */
  flush(path: string): void {
    const fd = openSync(path, 'r+');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  },
};

/** Single-writer JSON store. Small state, atomic replace, one backup. */
export class Store {
  private readonly filePath: string;
  /** Set when a newer Mochi owns the file and we must not write to it. */
  private readOnly = false;
  private recoveryNotice: RecoveryNotice | null = null;
  private warnedAboutReadOnly = false;

  /** True when the state has changed but has not been written yet. */
  private pending = false;
  private timer: NodeJS.Timeout | null = null;
  /** When the file on disk was last known to match the state. */
  private lastWriteAt = Date.now();
  /** The exact bytes last written, so an unchanged state costs no disk write. */
  private lastWrittenPayload: string | null = null;

  /** The version the file on disk was at before it was migrated. */
  private migratedFromVersion: number | null = null;
  private preMigrationBackupTaken = false;

  state: PersistedState;

  constructor(userDataDir: string) {
    this.filePath = join(userDataDir, 'state.json');
    this.cleanupStaleTemps();
    this.state = this.load();
  }

  /** The folder the state file lives in, so the user can open it. */
  get dataFolder(): string {
    return dirname(this.filePath);
  }

  /** What went wrong with the saved data, if anything. Shown once. */
  get recovery(): RecoveryNotice | null {
    return this.recoveryNotice;
  }

  /** True when a newer Mochi owns the file, so we refuse to write to it. */
  get isReadOnly(): boolean {
    return this.readOnly;
  }

  private load(): PersistedState {
    const today = todayKey();
    const candidates = [this.filePath, `${this.filePath}.bak`];
    const quarantined: string[] = [];
    let newerVersionPath: string | null = null;
    let loaded: PersistedState | null = null;

    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(candidate, 'utf8'));
      } catch {
        quarantined.push(this.quarantineFile(candidate));
        continue;
      }

      // A file from a newer Mochi owns itself. Reading it would mean guessing
      // at fields we do not know, and writing over it would destroy data we
      // cannot recreate.
      if (versionOf(parsed) > CURRENT_SCHEMA_VERSION) {
        newerVersionPath = candidate;
        continue;
      }

      try {
        const outcome = migrateState(parsed, today);
        if (outcome.applied.length > 0) {
          this.migratedFromVersion = outcome.applied[0]! - 1;
        }
        loaded = outcome.state;
        break;
      } catch {
        quarantined.push(this.quarantineFile(candidate));
        continue;
      }
    }

    if (newerVersionPath !== null) {
      this.readOnly = true;
      this.recoveryNotice = {
        kind: 'newer-version',
        message:
          'A newer version of Mochi wrote this data, so it has been left alone. Update Mochi to keep using it.',
        folder: this.dataFolder,
        files: [newerVersionPath],
      };
    } else if (quarantined.length > 0) {
      this.recoveryNotice = {
        kind: 'quarantined',
        message:
          'Mochi could not read its saved data, so it kept a copy and started fresh. Your old data is still in the folder below.',
        folder: this.dataFolder,
        files: quarantined,
      };
    }

    if (loaded !== null) return loaded;

    return defaultPersistedState(today);
  }

  /**
   * Schedule a write.
   *
   * Writes are debounced so a burst of changes costs one file write, and are
   * never deferred for more than two seconds, so a forced kill cannot lose
   * much. The state is serialised when the write actually happens, so every
   * change made in the meantime is included.
   */
  save(): void {
    if (this.readOnly) {
      this.warnReadOnly();
      return;
    }

    this.pending = true;

    if (Date.now() - this.lastWriteAt >= PERSIST_MAX_DELAY_MS) {
      this.flush();
      return;
    }

    if (this.timer === null) {
      this.timer = setTimeout(() => this.flush(), PERSIST_DEBOUNCE_MS);
      // A pending write must never keep the process alive on its own.
      this.timer.unref?.();
    }
  }

  /**
   * Write the state now. Call this before the app quits, and whenever losing
   * the change would be noticed.
   *
   * This always attempts a write — it is an explicit request — but a state
   * that is byte-for-byte what is already on disk costs no disk write.
   */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.pending = false;

    if (this.readOnly) {
      this.warnReadOnly();
      return;
    }

    const payload = `${JSON.stringify(this.state, null, 2)}\n`;

    if (payload === this.lastWrittenPayload) {
      // Nothing actually changed, so the file on disk is already correct.
      // The pet's energy drifts every tick, and writing that to disk twice a
      // second forever would be a lot of pointless I/O.
      this.lastWriteAt = Date.now();
      return;
    }

    this.lastWrittenPayload = payload;
    this.lastWriteAt = Date.now();

    this.writePreMigrationBackup();

    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
    } catch {
      // The write below reports the real problem.
    }

    const result = writeFileAtomically(this.filePath, payload, fileOps);

    if (!result.ok) {
      // The previous state file is untouched and still holds the last good
      // state. Say so out loud rather than losing the failure quietly.
      console.error(
        `[mochi] state write failed, keeping the previous file. ${result.error ?? 'unknown error'}`,
      );
    }
  }

  /**
   * Keep the file as it was before it was migrated, so the old version can
   * still be read if the migration turns out to be wrong.
   */
  private writePreMigrationBackup(): void {
    if (this.migratedFromVersion === null || this.preMigrationBackupTaken) return;
    this.preMigrationBackupTaken = true;

    try {
      if (!existsSync(this.filePath)) return;
      copyFileSync(
        this.filePath,
        join(dirname(this.filePath), `state.pre-v${this.migratedFromVersion}.bak`),
      );
    } catch {
      // Best effort. The migration itself does not depend on this copy.
    }
  }

  private warnReadOnly(): void {
    if (this.warnedAboutReadOnly) return;
    this.warnedAboutReadOnly = true;
    console.error('[mochi] not writing state: a newer version of Mochi owns this file');
  }

  /**
   * Move an unreadable file out of the way instead of letting the next save
   * overwrite it. The file is kept, never deleted, so the user can still get
   * at whatever was in it.
   */
  private quarantineFile(path: string): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = dirname(path);
    let target = join(dir, `state.corrupt-${stamp}-${basename(path)}`);

    let counter = 2;
    while (existsSync(target)) {
      target = join(dir, `state.corrupt-${stamp}-${counter}-${basename(path)}`);
      counter += 1;
    }

    try {
      renameSync(path, target);
      return target;
    } catch {
      // It could not be moved. Leave it where it is — it is still the user's
      // to look at, and we will not write over it.
      return path;
    }
  }

  /**
   * Drop temp files left behind by a crash. They are named uniquely, so
   * without this they would pile up forever.
   */
  private cleanupStaleTemps(): void {
    const dir = dirname(this.filePath);
    const prefix = `${basename(this.filePath)}.tmp-`;
    const cutoff = Date.now() - STALE_TEMP_AGE_MS;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.startsWith(prefix)) continue;
      const full = join(dir, entry);
      try {
        if (statSync(full).mtimeMs < cutoff) {
          unlinkSync(full);
        }
      } catch {
        // Best effort.
      }
    }
  }

  setPet(pet: PetView, lastSeenAt: number): void {
    this.state.pet = {
      energy: pet.energy,
      mood: pet.mood,
      xp: pet.xp,
      level: pet.level,
      facing: pet.facing,
      lastSeenAt,
      equipped: [...pet.equipped],
    };
  }

  setPlacement(x: number, y: number): void {
    this.state.placement = { x: Math.round(x), y: Math.round(y) };
  }

  setSettings(settings: Settings): void {
    this.state.settings = { ...settings };
  }

  setFocus(focus: FocusPersisted): void {
    this.state.focus = focus;
  }

  markWelcomeSeen(): void {
    this.state.hasSeenWelcome = true;
  }
}

function versionOf(value: unknown): number {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return -1;
  const version = (value as Record<string, unknown>).version;
  return typeof version === 'number' && Number.isFinite(version) ? version : -1;
}
