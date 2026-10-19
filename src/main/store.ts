import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_SETTINGS } from '../shared/constants';
import type { PetView, Settings } from '../shared/types';
import type { StoredPet } from '../domain/pet-brain';

interface PersistedState {
  version: 1;
  pet: StoredPet;
  placement: { x: number; y: number } | null;
  settings: Settings;
  hasSeenWelcome: boolean;
}

const DEFAULT_STATE: PersistedState = {
  version: 1,
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
  state: PersistedState;

  constructor(userDataDir: string) {
    this.filePath = join(userDataDir, 'state.json');
    this.state = this.load();
  }

  private load(): PersistedState {
    const candidates = [this.filePath, `${this.filePath}.bak`];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      try {
        const parsed: unknown = JSON.parse(readFileSync(candidate, 'utf8'));
        if (!isRecord(parsed) || parsed.version !== 1) continue;
        const placement = isRecord(parsed.placement)
          ? {
              x: Number(parsed.placement.x) || 0,
              y: Number(parsed.placement.y) || 0,
            }
          : null;
        return {
          version: 1,
          pet: sanitizePet(parsed.pet),
          placement,
          settings: sanitizeSettings(parsed.settings),
          hasSeenWelcome: parsed.hasSeenWelcome === true,
        };
      } catch {
        // Try the backup; if both fail, start clean.
      }
    }
    return { ...DEFAULT_STATE, pet: { ...DEFAULT_STATE.pet }, settings: { ...DEFAULT_STATE.settings } };
  }

  save(): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    const payload = `${JSON.stringify(this.state, null, 2)}\n`;
    writeFileSync(tmp, payload, 'utf8');

    try {
      if (existsSync(this.filePath)) copyFileSync(this.filePath, `${this.filePath}.bak`);
      renameSync(tmp, this.filePath);
    } catch {
      // Windows can reject a replace while a scanner holds the file.
      writeFileSync(this.filePath, payload, 'utf8');
      try {
        unlinkSync(tmp);
      } catch {
        // Best effort cleanup.
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
