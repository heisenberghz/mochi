export const PET_WINDOW = { width: 320, height: 360 } as const;

/**
 * How much bigger the hit region grows when the cursor is moving onto the
 * pet, so it does not flicker at the edge.
 */
export const HIT_HYSTERESIS = 8;
export const INTERACTIVE_EXIT_DELAY = 150;

export const DRAG_THRESHOLD = 4;
export const CLICK_MAX_DURATION = 400;
export const SNAP_DISTANCE = 48;

/** How long the pet takes to glide into a corner when it is dropped near one. */
export const SNAP_DURATION_MS = 180;

/**
 * How long the speech bubble takes to fade out. It matches the
 * `--motion-fast` token in the stylesheet.
 */
export const BUBBLE_EXIT_MS = 120;

/** How long the pet takes to settle after being put down. */
export const SETTLE_DURATION_MS = 250;

export const SLEEP_AFTER_IDLE_SECONDS = 600;
export const QUIET_SLEEP_AFTER_IDLE_SECONDS = 300;

export const WALK_INTERVAL_MIN_MS = 90_000;
export const WALK_INTERVAL_MAX_MS = 240_000;
export const WALK_DURATION_MIN_MS = 2600;
export const WALK_DURATION_MAX_MS = 5200;
export const WALK_SPEED_DIP_PER_SECOND = 70;

export const BEHAVIOR_TICK_MS = 500;
export const FOCUS_TICK_MS = 1000;
export const SESSION_ENERGY_DRAIN_MS = 600_000; // 1 energy per 10 min awake
export const SESSION_ENERGY_RECOVERY_MS = 240_000; // 1 energy per 4 min asleep
export const POKE_MOOD_DAILY_CAP = 8;

export const FOCUS_DEFAULTS = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  rounds: 4,
  autoStartBreak: true,
  autoStartWork: false,
} as const;

/** The range each focus setting may take. Anything outside it is rejected. */
export const FOCUS_LIMITS = {
  workMin: { min: 5, max: 120 },
  shortBreakMin: { min: 1, max: 30 },
  longBreakMin: { min: 5, max: 60 },
  rounds: { min: 2, max: 8 },
} as const;

/**
 * A partial session only counts once this much of it was actually focused.
 * Below that, the time is recorded but earns nothing.
 */
export const FOCUS_PARTIAL_CREDIT_RATIO = 0.5;

/** How long the system may sit idle before a work phase pauses itself. */
export const IDLE_AUTO_PAUSE_SECONDS = 180;

/**
 * How often the pet does something small of its own, when the user is away.
 * The gap is uneven, so it never looks like a loop.
 */
export const MICRO_BEHAVIOR_INTERVAL_MIN_MS = 4_000;
export const MICRO_BEHAVIOR_INTERVAL_MAX_MS = 12_000;

/** How long the user must be away before the pet starts fidgeting. */
export const MICRO_BEHAVIOR_IDLE_SECONDS = 60;

/** How long the pet may be away before it stops recovering energy. */
export const MAX_OFFLINE_HOURS = 12;

/** Mood lost for every six hours awake, and the most it may lose in a day. */
export const MOOD_DECAY_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const MOOD_DECAY_DAILY_CAP = 4;

/** Mood lost for being away for a whole day, and the most it may lose. */
export const MOOD_OFFLINE_DECAY = 4;

/** Mood gained for a finished block, a finished break, and a level up. */
export const MOOD_FOCUS_REWARD = 6;
export const MOOD_BREAK_REWARD = 3;
export const MOOD_LEVEL_REWARD = 2;

/** XP for each minute of a finished work phase. */
export const FOCUS_XP_PER_MINUTE = 1;

/** XP on top of the minutes, for finishing a whole phase. */
export const FOCUS_PHASE_BONUS_XP = 5;

/** XP for finishing a break. */
export const FOCUS_BREAK_XP = 2;

/**
 * The schema version this build writes. Bump it whenever the persisted shape
 * changes, and add a migration for the previous version.
 */
export const CURRENT_SCHEMA_VERSION = 3;

export const DEFAULT_SETTINGS = {
  petName: 'Mochi',
  roam: true,
  reducedMotion: 'system',
  sound: true,
  launchAtLogin: false,
  pauseWhenLocked: true,
  autoResume: false,
} as const;

/**
 * Hosts allowed to open in the user's browser. Anything not listed here is
 * refused. The support and privacy pages will live on the project's GitHub
 * organisation, so that is the only host allowed today. Add an entry here when
 * a real link ships — never widen this at the call site.
 */
export const EXTERNAL_LINK_HOSTS: readonly string[] = ['github.com'];
