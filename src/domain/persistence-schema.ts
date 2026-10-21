import { localDateKey } from '../shared/dates';
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, FOCUS_DEFAULTS } from '../shared/constants';
import { clampFocusConfig } from '../shared/focus-config';
import type { FocusConfig, Settings } from '../shared/types';
import type {
  FocusActiveSession,
  FocusAggregates,
  FocusPersisted,
  FocusSessionRecord,
} from './focus-timer';
import type { StoredPet } from './pet-brain';

/** The shape of the file on disk. */
export interface PersistedState {
  version: number;
  pet: StoredPet;
  placement: { x: number; y: number } | null;
  settings: Settings;
  hasSeenWelcome: boolean;
  focus: FocusPersisted;
}

/** The saved file could not be understood. */
export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaError';
  }
}

/** The saved file was written by a newer build than this one. */
export class UnsupportedVersionError extends SchemaError {
  constructor(readonly version: number) {
    super(`the saved file is version ${version}, which this build does not know`);
    this.name = 'UnsupportedVersionError';
  }
}

/**
 * A migration takes the state at version N and returns it at version N + 1.
 * Each one is pure: the same input always produces the same output.
 */
type Migration = (state: Record<string, unknown>, today: string) => Record<string, unknown>;

/**
 * Migrations, keyed by the version they produce.
 *
 * Each entry moves the state forward by exactly one version, so a file can
 * climb from any older version by running them in order.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 1 -> 2: the focus timer gained a configuration, daily totals, a session
  // history and an active session that can be recovered.
  //
  // Anything the file already has is kept. A real version 1 file has no
  // focus section, but a hand-edited or half-migrated one might, and
  // overwriting it would throw away real data.
  2: (state, today) => ({
    ...state,
    version: 2,
    focus: isRecord(state.focus) ? state.focus : defaultFocus(today),
  }),
};

export interface MigrationOutcome {
  state: PersistedState;
  /** The versions that were applied, in order. Empty when nothing changed. */
  applied: number[];
}

/**
 * Bring a saved file up to the current schema.
 *
 * Running this on a file that is already current changes nothing, so it is
 * safe to call on every load.
 */
export function migrateState(raw: unknown, today: string): MigrationOutcome {
  if (!isRecord(raw)) {
    throw new SchemaError('the saved file is not an object');
  }

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new SchemaError('the saved file has no version');
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedVersionError(version);
  }

  const applied: number[] = [];
  let current: Record<string, unknown> = { ...raw };

  while (versionOf(current) < CURRENT_SCHEMA_VERSION) {
    const from = versionOf(current);
    const migration = MIGRATIONS[from + 1];
    if (!migration) {
      throw new SchemaError(`there is no migration from version ${from}`);
    }
    current = migration(current, today);
    applied.push(from + 1);
  }

  return { state: normalise(current, today), applied };
}

/** The state a fresh install starts with. */
export function defaultPersistedState(today: string): PersistedState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    pet: { ...DEFAULT_PET },
    placement: null,
    settings: { ...DEFAULT_SETTINGS },
    hasSeenWelcome: false,
    focus: defaultFocus(today),
  };
}

const DEFAULT_PET: StoredPet = { energy: 80, mood: 70, xp: 0, level: 1, facing: 1 };

function defaultFocus(today: string): FocusPersisted {
  return {
    config: { ...FOCUS_DEFAULTS },
    aggregates: {
      dayKey: today,
      completedToday: 0,
      focusedMsToday: 0,
      focusedByDay: {},
      streakDays: 0,
      lastCompletedDay: null,
    },
    sessions: [],
    active: null,
  };
}

/**
 * Force a state into a shape the rest of the app can rely on, whatever was
 * on disk. Every field falls back to a sensible value rather than failing.
 */
function normalise(raw: Record<string, unknown>, today: string): PersistedState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    pet: sanitisePet(raw.pet),
    placement: sanitisePlacement(raw.placement),
    settings: sanitiseSettings(raw.settings),
    hasSeenWelcome: raw.hasSeenWelcome === true,
    focus: sanitiseFocus(raw.focus, today),
  };
}

export function sanitisePet(value: unknown): StoredPet {
  if (!isRecord(value)) return { ...DEFAULT_PET };
  const num = (key: string, fallback: number, min: number, max: number): number => {
    const raw = value[key];
    return typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(max, Math.max(min, raw))
      : fallback;
  };
  const facing = value.facing === -1 ? -1 : 1;
  return {
    energy: num('energy', DEFAULT_PET.energy, 0, 100),
    mood: num('mood', DEFAULT_PET.mood, 20, 100),
    xp: Math.max(0, Math.round(num('xp', 0, 0, 10_000_000))),
    level: Math.max(1, Math.round(num('level', 1, 1, 20))),
    facing,
  };
}

export function sanitiseSettings(value: unknown): Settings {
  const base = { ...DEFAULT_SETTINGS };
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

function sanitisePlacement(value: unknown): { x: number; y: number } | null {
  if (!isRecord(value)) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

function sanitiseFocus(value: unknown, today: string): FocusPersisted {
  const record = isRecord(value) ? value : {};
  const aggregates = isRecord(record.aggregates) ? record.aggregates : {};

  return {
    config: sanitiseFocusConfig(record.config),
    aggregates: {
      dayKey: typeof aggregates.dayKey === 'string' ? aggregates.dayKey : today,
      completedToday: countOr(aggregates.completedToday),
      focusedMsToday: countOr(aggregates.focusedMsToday),
      focusedByDay: sanitiseDayTotals(aggregates.focusedByDay),
      streakDays: countOr(aggregates.streakDays),
      lastCompletedDay:
        typeof aggregates.lastCompletedDay === 'string' ? aggregates.lastCompletedDay : null,
    },
    sessions: sanitiseSessions(record.sessions),
    active: sanitiseActive(record.active),
  };
}

function sanitiseFocusConfig(value: unknown): FocusConfig {
  const record = isRecord(value) ? value : {};
  const num = (key: string, fallback: number): number =>
    typeof record[key] === 'number' && Number.isFinite(record[key] as number)
      ? (record[key] as number)
      : fallback;

  return clampFocusConfig({
    workMin: num('workMin', FOCUS_DEFAULTS.workMin),
    shortBreakMin: num('shortBreakMin', FOCUS_DEFAULTS.shortBreakMin),
    longBreakMin: num('longBreakMin', FOCUS_DEFAULTS.longBreakMin),
    rounds: num('rounds', FOCUS_DEFAULTS.rounds),
    autoStartBreak:
      typeof record.autoStartBreak === 'boolean'
        ? record.autoStartBreak
        : FOCUS_DEFAULTS.autoStartBreak,
    autoStartWork:
      typeof record.autoStartWork === 'boolean'
        ? record.autoStartWork
        : FOCUS_DEFAULTS.autoStartWork,
  });
}

function sanitiseSessions(value: unknown): FocusSessionRecord[] {
  if (!Array.isArray(value)) return [];

  const sessions: FocusSessionRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const dayKey = entry.dayKey;
    if (typeof dayKey !== 'string') continue;

    sessions.push({
      dayKey,
      phase:
        entry.phase === 'shortBreak' || entry.phase === 'longBreak' ? entry.phase : 'work',
      focusedMs: countOr(entry.focusedMs),
      completed: entry.completed === true,
    });
  }

  return sessions.slice(-30);
}

function sanitiseActive(value: unknown): FocusActiveSession | null {
  if (!isRecord(value)) return null;

  const phase =
    value.phase === 'shortBreak' || value.phase === 'longBreak' ? value.phase : 'work';
  const remainingMs = countOr(value.remainingMs);

  return {
    // Always paused. The monotonic clock starts again with the process, so a
    // session that was running when the app closed cannot simply carry on
    // from a deadline that no longer means anything.
    status: 'paused',
    phase,
    round: Math.max(1, countOr(value.round)),
    remainingMs: Math.max(1000, remainingMs),
    startedAtMs: typeof value.startedAtMs === 'number' ? value.startedAtMs : null,
    pauseReason:
      value.pauseReason === 'user' ||
      value.pauseReason === 'idle' ||
      value.pauseReason === 'lock' ||
      value.pauseReason === 'suspend' ||
      value.pauseReason === 'recovered'
        ? value.pauseReason
        : 'recovered',
  };
}

function sanitiseDayTotals(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const totals: Record<string, number> = {};
  for (const [day, ms] of Object.entries(value)) {
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
      totals[day] = Math.round(ms);
    }
  }
  return totals;
}

function countOr(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function versionOf(state: Record<string, unknown>): number {
  const version = state.version;
  return typeof version === 'number' && Number.isInteger(version) ? version : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Today's date, for callers that do not want to work it out themselves. */
export function todayKey(): string {
  return localDateKey(Date.now());
}
