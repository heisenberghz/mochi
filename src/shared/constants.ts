export const PET_WINDOW = { width: 320, height: 360 } as const;

/**
 * How much bigger the hit region grows when the cursor is moving onto the
 * pet, so it does not flicker at the edge.
 */
export const HIT_HYSTERESIS = 8;
export const INTERACTIVE_EXIT_DELAY = 150;

/**
 * How often the main process polls the real cursor to throw the
 * interactive/click-through switch. Fast enough that hovering in feels
 * instant, slow enough to be invisible in the process budget.
 */
export const CURSOR_WATCH_INTERVAL_MS = 100;

/** How long after a bubble's own timer it still counts as on screen. */
export const BUBBLE_INTERACTIVE_MARGIN_MS = 600;

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

/**
 * The steps the pet can be scaled to.
 *
 * These are not free choices: the sprite is pixel art on an 8-unit cell, and
 * each step below lands every cell on a whole number of screen pixels (6, 8,
 * 10 or 12), so Mochi stays crisp. Anything between the steps blurs her.
 */
export const PET_SCALES = [0.75, 1, 1.25, 1.5] as const;
export type PetScale = (typeof PET_SCALES)[number];

/**
 * What one paw cycle is worth in ground distance. Two steps happen inside it
 * — one near paw and one far paw lift together in a trot.
 */
export const WALK_STRIDE_DIP = 63;

/**
 * How long one paw cycle takes, so the stride and the window glide agree:
 * the pet's feet cover exactly the ground the window moves in that time.
 */
export const WALK_CYCLE_MS = Math.round((WALK_STRIDE_DIP / WALK_SPEED_DIP_PER_SECOND) * 1000);

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

/** What Mochi can wear, unlocked by level. No currency, no countdowns, no
 * pressure mechanics — the pet just earns them by being your companion. */
export interface Cosmetic {
  id: 'glasses' | 'leaf-hat' | 'mug' | 'bed' | 'scarf-moss' | 'scarf-sky' | 'scarf-aurora';
  label: string;
  unlockLevel: number;
  /** Where it hangs on the artboard. */
  slot: 'face' | 'head' | 'paw' | 'ground' | 'neck';
}

export type CosmeticId = Cosmetic['id'];

export const COSMETICS: readonly Cosmetic[] = [
  { id: 'glasses', label: 'Glasses', unlockLevel: 1, slot: 'face' },
  { id: 'leaf-hat', label: 'Leaf hat', unlockLevel: 2, slot: 'head' },
  { id: 'scarf-moss', label: 'Moss scarf', unlockLevel: 3, slot: 'neck' },
  { id: 'scarf-sky', label: 'Sky scarf', unlockLevel: 4, slot: 'neck' },
  { id: 'mug', label: 'Mug', unlockLevel: 5, slot: 'paw' },
  { id: 'scarf-aurora', label: 'Aurora scarf', unlockLevel: 6, slot: 'neck' },
  { id: 'bed', label: 'Bed', unlockLevel: 10, slot: 'ground' },
];

/** Full list of the ids that may appear in an equipped list. */
export const COSMETIC_IDS: readonly CosmeticId[] = COSMETICS.map((c) => c.id);

/** The slot a cosmetic hangs from, or null when the id is not known. */
export function cosmeticSlot(id: unknown): Cosmetic['slot'] | null {
  if (typeof id !== 'string') return null;
  const cosmetic = COSMETICS.find((c) => c.id === id);
  return cosmetic ? cosmetic.slot : null;
}

/** What the pet has earned so far, derived from level (no separate save needed). */
export function unlockedCosmetics(level: number): string[] {
  return COSMETICS.filter((c) => c.unlockLevel <= level).map((c) => c.id);
}

/** Bubbles the pet shows on its own are rate-limited so they never nag. */
export const BUBBLE_UNSOLICITED_MIN_GAP_MS = 5 * 60_000;
export const BUBBLE_UNSOLICITED_MAX_PER_HOUR = 6;

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
export const CURRENT_SCHEMA_VERSION = 5;

export const DEFAULT_SETTINGS = {
  petName: 'Mochi',
  /** How big the pet stands on the desk: one of PET_SCALES. */
  petScale: 1 as PetScale,
  roam: true,
  reducedMotion: 'system',
  sound: true,
  launchAtLogin: false,
  pauseWhenLocked: true,
  autoResume: false,
  /** A toast and a sound are quiet between these hours, when enabled. */
  quietHoursEnabled: true,
  /** Minutes past midnight; 1320 = 22:00, 420 = 07:00. */
  quietStartMin: 22 * 60,
  quietEndMin: 7 * 60,
  /** Best effort: hide the pet while an exclusive-fullscreen app has the screen. */
  hideInFullscreen: true,
  /** The three global hotkeys control pet visibility, focus and the Den. */
  globalHotkeys: true,
} as const;

/** Bound for quiet-hour times, in minutes past midnight, on 15-minute steps. */
export const QUIET_MINUTE_MIN = 0;
export const QUIET_MINUTE_MAX = 24 * 60;

/**
 * Hotkey defaults, shared by the main process (registration) and the Den
 * (displaying them). Electron accelerators.
 */
export const HOTKEY_DEFAULTS = {
  pet: 'Ctrl+Alt+P',
  focus: 'Ctrl+Alt+F',
  den: 'Ctrl+Alt+D',
} as const;

/**
 * Hosts allowed to open in the user's browser. Anything not listed here is
 * refused. The support and privacy pages will live on the project's GitHub
 * organisation, so that is the only host allowed today. Add an entry here when
 * a real link ships — never widen this at the call site.
 */
export const EXTERNAL_LINK_HOSTS: readonly string[] = ['github.com'];
