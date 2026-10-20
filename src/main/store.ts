import {
  closeSync,
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
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from '../shared/constants';
import type { PetView, RecoveryNotice, Settings } from '../shared/types';
import type { StoredPet } from '../domain/pet-brain';
import { nodeFileOps, writeFileAtomically, type AtomicFileOps } from './atomic-write';

/** A temp file older than this is left over from a crash and is safe to drop. */
const STALE_TEMP_AGE_MS = 60 * 60 * 1000;

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

interface PersistedState {
  version: number;
  pet: StoredPet;
  placement: { x: number; y: number } | null;
  settings: Settings;
  hasSeenWelcome: boolean;
}

const DEFAULT_STATE: PersistedState = {
  version: CURRENT_SCHEMA_VERSION,
  pet: { energy: 80, mood: 70, xp: 0, level: 1, facing: 1 },
  placement: null,
  settings: { ...DEFAULT_SETTINGS },
  hasSeenWelcome: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizePet(value: unknown): StoredPet {
  if (!isRecord(value)) return { ...DEFAULT_STATE.pet };
  const num = (key: string, fallback: number, min: number, max: number): number => {
    const raw = value[key];
    return typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(max, Math.max(min, raw))
      : fallback;
  };
  const facing = value.facing === -1 ? -1 : 1;
  return {
    energy: num('energy', DEFAULT_STATE.pet.energy, 0, 100),
    mood: num('mood', DEFAULT_STATE.pet.mood, 20, 100),
    xp: Math.max(0, Math.round(num('xp', 0, 0, 10_000_000))),
    level: Math.max(1, Math.round(num('level', 1, 1, 20))),
    facing,
  };
}

function sanitizeSettings(value: unknown): Settings {
  const base = { ...DEFAULT_STATE.settings };
  if (!isRecord(value)) return base;
  return {
    petName:
      typeof value.petName === 'string' && value.petName.trim()
        ? value.petName.trim().slice(0, 20)
        : base.petName,
    roam: typeof value.roam === 'boolean' ? value.roam : base.roam,
    reducedMotion:
      value.reducedMotion === 'on' || value.reducedMotion === 'off' || value.reducedMotion === 'system'
        ? value.reducedMotion
        : base.reducedMotion,
    sound: typeof value.sound === 'boolean' ? value.sound : base.sound,
    launchAtLogin:
      typeof value.launchAtLogin === 'boolean' ? value.launchAtLogin : base.launchAtLogin,
  };
}

/** Single-writer JSON store. Small state, atomic replace, one backup. */
export class Store {
  private readonly filePath: string;
  /** Set when a newer Mochi owns the file and we must not write to it. */
  private readOnly = false;
  private recoveryNotice: RecoveryNotice | null = null;
  private warnedAboutReadOnly = false;

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

      if (!isRecord(parsed)) {
        quarantined.push(this.quarantineFile(candidate));
        continue;
      }

      const version = typeof parsed.version === 'number' ? parsed.version : 0;

      if (version > CURRENT_SCHEMA_VERSION) {
        // A newer Mochi owns this file. Reading it would mean guessing at
        // fields we do not know, and writing over it would destroy data we
        // cannot recreate.
        newerVersionPath = candidate;
        continue;
      }

      if (version < CURRENT_SCHEMA_VERSION) {
        // This needs a migration rather than a guess. The migration chain
        // arrives with schema v2; until then an unreadable older file is
        // kept rather than silently discarded.
        quarantined.push(this.quarantineFile(candidate));
        continue;
      }

      loaded = this.fromRecord(parsed);
      break;
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

    return {
      ...DEFAULT_STATE,
      pet: { ...DEFAULT_STATE.pet },
      settings: { ...DEFAULT_STATE.settings },
    };
  }

  private fromRecord(parsed: Record<string, unknown>): PersistedState {
    const placement = isRecord(parsed.placement)
      ? {
          x: Number(parsed.placement.x) || 0,
          y: Number(parsed.placement.y) || 0,
        }
      : null;

    return {
      version: CURRENT_SCHEMA_VERSION,
      pet: sanitizePet(parsed.pet),
      placement,
      settings: sanitizeSettings(parsed.settings),
      hasSeenWelcome: parsed.hasSeenWelcome === true,
    };
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

  save(): void {
    if (this.readOnly) {
      if (!this.warnedAboutReadOnly) {
        this.warnedAboutReadOnly = true;
        console.error(
          '[mochi] not writing state: a newer version of Mochi owns this file',
        );
      }
      return;
    }

    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
    } catch {
      // The write below reports the real problem.
    }

    const payload = `${JSON.stringify(this.state, null, 2)}\n`;
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

  setPet(pet: PetView): void {
    this.state.pet = {
      energy: pet.energy,
      mood: pet.mood,
      xp: pet.xp,
      level: pet.level,
      facing: pet.facing,
    };
  }

  setPlacement(x: number, y: number): void {
    this.state.placement = { x: Math.round(x), y: Math.round(y) };
  }

  setSettings(settings: Settings): void {
    this.state.settings = { ...settings };
  }

  markWelcomeSeen(): void {
    this.state.hasSeenWelcome = true;
  }
}
