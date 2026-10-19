export const PET_WINDOW = { width: 320, height: 360 } as const;

/** Hit ellipse in window-local DIP coordinates. */
export const HIT_ELLIPSE = { cx: 160, cy: 242, rx: 84, ry: 100 } as const;
export const HIT_HYSTERESIS = 8;
export const INTERACTIVE_EXIT_DELAY = 150;

export const DRAG_THRESHOLD = 4;
export const CLICK_MAX_DURATION = 400;
export const SNAP_DISTANCE = 48;

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

export const DEFAULT_SETTINGS = {
  petName: 'Mochi',
  roam: true,
  reducedMotion: 'system',
  sound: true,
  launchAtLogin: false,
} as const;
