import {
  POKE_MOOD_DAILY_CAP,
  QUIET_SLEEP_AFTER_IDLE_SECONDS,
  SLEEP_AFTER_IDLE_SECONDS,
  SESSION_ENERGY_DRAIN_MS,
  SESSION_ENERGY_RECOVERY_MS,
  WALK_DURATION_MAX_MS,
  WALK_DURATION_MIN_MS,
  WALK_INTERVAL_MAX_MS,
  WALK_INTERVAL_MIN_MS,
} from '../shared/constants';
import { localDateKey } from '../shared/dates';
import type { Behavior, PetMode, PetView } from '../shared/types';

export interface BrainContext {
  idleSeconds: number;
  focusActive: boolean;
  quietHours: boolean;
  canRoam: boolean;
}

export interface WalkStart {
  durationMs: number;
  facing: -1 | 1;
}

export interface TickResult {
  state: PetView;
  walkStart?: WalkStart;
}

export interface PokeResult {
  state: PetView;
  moodGain: number;
  woke: boolean;
}

export interface StoredPet {
  energy: number;
  mood: number;
  xp: number;
  level: number;
  facing: -1 | 1;
}

interface BrainOptions {
  now?: number;
  rng?: () => number;
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let n = 2; n <= 20; n += 1) {
    const threshold = 10 * (n - 1) * (n + 5);
    if (xp >= threshold) level = n;
    else break;
  }
  return level;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How important a behaviour is. A lower number wins, so being carried beats
 * focusing, and focusing beats everything else.
 */
const PRIORITY: Record<Behavior, number> = {
  drag: 0,
  focus: 1,
  sleep: 2,
  celebrate: 3,
  wave: 4,
  walk: 4,
  wake: 4,
  idle: 5,
};

/**
 * Whether a behaviour may be cut short by one of the same importance.
 *
 * Being carried and focusing are never interrupted, and one celebration
 * never interrupts another.
 */
const INTERRUPTIBLE: Record<Behavior, boolean> = {
  drag: false,
  focus: false,
  sleep: false,
  celebrate: false,
  wave: true,
  walk: true,
  wake: true,
  idle: true,
};

/** How long a behaviour that does not end on its own may last. */
const INDEFINITE_BEHAVIOUR_MS = 30 * 60 * 1000;

/**
 * How long the pet may be carried before the watchdog assumes it was dropped.
 * The main process has its own watchdog for this, but if that one is ever
 * missed the pet would be stuck being carried for good.
 */
const DRAG_MAX_MS = 20 * 1000;

/** The grace given to a behaviour before the watchdog steps in. */
const WATCHDOG_GRACE_MS = 2000;

/** How long the watchdog's rescues are remembered for. */
const TIMEOUT_WINDOW_MS = 10 * 60 * 1000;

/** How many rescues in that window mean the animation is not working. */
const MAX_TIMEOUTS_IN_WINDOW = 3;

/** The shortest gap between two celebrations. */
const CELEBRATE_COOLDOWN_MS = 10 * 1000;

/**
 * Pure behavior director. It owns the pet's macro-state, energy, mood, XP,
 * and walk scheduling. All time and randomness are injected so it can be
 * tested without Electron or real timers.
 */
export class PetBrain {
  private behavior: Behavior = 'idle';
  private mode: PetMode = 'awake';
  private energy = 80;
  private mood = 70;
  private xp = 0;
  private level = 1;
  private facing: -1 | 1 = 1;

  private until = 0;
  /** When the watchdog gives up on the current behaviour. */
  private behaviorDeadline = 0;
  /** When the watchdog last had to rescue the pet. */
  private timeouts: number[] = [];
  /** When the pet last celebrated, so it does not celebrate twice at once. */
  private lastCelebrateAt = 0;
  /** What the pet was doing before it was picked up. */
  private modeBeforeDrag: PetMode | null = null;
  /** True when the pet's animation has stopped working. */
  private animationPaused = false;

  private nextWalkAt: number;
  private lastTickAt: number;
  private sleepStartedAt: number | null = null;
  private moodDate: string;
  private moodGainedToday = 0;

  private readonly rng: () => number;

  constructor(options: BrainOptions = {}) {
    const now = options.now ?? Date.now();
    this.rng = options.rng ?? Math.random;
    this.lastTickAt = now;
    this.moodDate = localDateKey(now);
    this.nextWalkAt = now + this.randomBetween(WALK_INTERVAL_MIN_MS, WALK_INTERVAL_MAX_MS);
  }

  restore(pet: Partial<StoredPet>): void {
    if (typeof pet.energy === 'number') this.energy = clamp(pet.energy, 0, 100);
    if (typeof pet.mood === 'number') this.mood = clamp(pet.mood, 20, 100);
    if (typeof pet.xp === 'number') {
      this.xp = Math.max(0, pet.xp);
      this.level = levelForXp(this.xp);
    }
    if (pet.facing === 1 || pet.facing === -1) this.facing = pet.facing;
  }

  snapshot(): PetView {
    return {
      behavior: this.behavior,
      mode: this.mode,
      energy: Math.round(this.energy * 10) / 10,
      mood: Math.round(this.mood * 10) / 10,
      xp: this.xp,
      level: this.level,
      facing: this.facing,
      animationPaused: this.animationPaused,
    };
  }

  tick(now: number, ctx: BrainContext): TickResult {
    const elapsed = Math.max(0, now - this.lastTickAt);
    this.lastTickAt = now;

    // The watchdog gets first say. A behaviour that has run far too long is
    // rescued before anything else decides what the pet should be doing.
    this.checkWatchdog(now);

    if (this.mode === 'drag') {
      // Nothing preempts being carried.
      return { state: this.snapshot() };
    }

    if (ctx.focusActive) {
      if (this.behavior !== 'focus') {
        this.mode = 'focus';
        this.behavior = 'focus';
        this.until = Number.POSITIVE_INFINITY;
        this.sleepStartedAt = null;
      }
      // A session that keeps running keeps the pet's focus posture alive, so
      // the watchdog never fires on a long block.
      this.behaviorDeadline = now + INDEFINITE_BEHAVIOUR_MS + WATCHDOG_GRACE_MS;
      return { state: this.snapshot() };
    }

    if (this.mode === 'focus' && !ctx.focusActive) {
      this.mode = 'awake';
      this.behavior = 'idle';
      this.until = 0;
      this.behaviorDeadline = 0;
      this.scheduleNextWalk(now);
    }

    if (this.behavior === 'sleep') {
      this.energy = clamp(this.energy + elapsed / SESSION_ENERGY_RECOVERY_MS, 0, 100);
      const userIsBack =
        ctx.idleSeconds < 60 &&
        this.sleepStartedAt !== null &&
        now - this.sleepStartedAt > 1500;
      if (userIsBack) {
        this.wake(now);
        return { state: this.snapshot() };
      }
      // Still asleep and still on their own, so the nap keeps going.
      this.behaviorDeadline = now + INDEFINITE_BEHAVIOUR_MS + WATCHDOG_GRACE_MS;
      return { state: this.snapshot() };
    }

    this.energy = clamp(this.energy - elapsed / SESSION_ENERGY_DRAIN_MS, 0, 100);

    // A behaviour that runs for a while holds the pet's attention until it
    // finishes, unless something more important arrives.
    if (this.isTransient()) {
      if (now < this.until) {
        return { state: this.snapshot() };
      }
      if (this.behavior === 'walk') {
        this.scheduleNextWalk(now);
      }
      this.behavior = 'idle';
      this.until = 0;
      this.behaviorDeadline = 0;
    }

    const shouldSleep =
      this.energy < 15 ||
      ctx.idleSeconds >= SLEEP_AFTER_IDLE_SECONDS ||
      (ctx.quietHours && ctx.idleSeconds >= QUIET_SLEEP_AFTER_IDLE_SECONDS);

    if (shouldSleep) {
      this.mode = 'sleep';
      this.behavior = 'sleep';
      this.until = Number.POSITIVE_INFINITY;
      this.behaviorDeadline = now + INDEFINITE_BEHAVIOUR_MS + WATCHDOG_GRACE_MS;
      this.sleepStartedAt = now;
      return { state: this.snapshot() };
    }

    this.mode = 'awake';

    if (
      ctx.canRoam &&
      ctx.idleSeconds < 300 &&
      this.energy > 25 &&
      now >= this.nextWalkAt
    ) {
      const durationMs = Math.round(this.randomBetween(WALK_DURATION_MIN_MS, WALK_DURATION_MAX_MS));
      this.facing = this.rng() < 0.5 ? -1 : 1;
      this.behavior = 'walk';
      this.until = now + durationMs;
      this.behaviorDeadline = now + durationMs + WATCHDOG_GRACE_MS;
      this.noteWorking();
      return {
        state: this.snapshot(),
        walkStart: { durationMs, facing: this.facing },
      };
    }

    this.behavior = 'idle';
    return { state: this.snapshot() };
  }

  poke(now: number): PokeResult {
    const today = localDateKey(now);
    if (today !== this.moodDate) {
      this.moodDate = today;
      this.moodGainedToday = 0;
    }

    let moodGain = 0;
    if (this.moodGainedToday < POKE_MOOD_DAILY_CAP) {
      this.mood = clamp(this.mood + 1, 20, 100);
      this.moodGainedToday += 1;
      moodGain = 1;
    }

    let woke = false;
    if (this.behavior === 'sleep') {
      this.wake(now);
      woke = true;
    }

    return { state: this.snapshot(), moodGain, woke };
  }

  flipFacing(): void {
    this.facing = this.facing === 1 ? -1 : 1;
  }

  startDrag(now: number): void {
    // Remember what the pet was doing, so it can go back to it.
    this.modeBeforeDrag = this.mode;
    this.mode = 'drag';
    this.behavior = 'drag';
    this.until = Number.POSITIVE_INFINITY;
    this.behaviorDeadline = now + DRAG_MAX_MS + WATCHDOG_GRACE_MS;
  }

  endDrag(now: number): void {
    const previous = this.modeBeforeDrag;
    this.modeBeforeDrag = null;

    // The pet goes back to what it was doing before it was picked up, rather
    // than always snapping back to idle.
    this.mode = previous === 'focus' || previous === 'sleep' ? previous : 'awake';
    this.behavior =
      this.mode === 'focus' ? 'focus' : this.mode === 'sleep' ? 'sleep' : 'idle';
    this.until =
      this.mode === 'focus' || this.mode === 'sleep' ? Number.POSITIVE_INFINITY : 0;
    this.behaviorDeadline = 0;
    if (this.mode === 'sleep') this.sleepStartedAt = now;
    this.scheduleNextWalk(now);
  }

  /** Leave focus immediately when the user ends a session. */
  endFocus(now: number): void {
    if (this.mode !== 'focus') return;
    this.mode = 'awake';
    this.behavior = 'idle';
    this.until = 0;
    this.behaviorDeadline = 0;
    this.scheduleNextWalk(now);
  }

  forceWalk(now: number): WalkStart {
    const durationMs = 3600;
    this.facing = this.rng() < 0.5 ? -1 : 1;
    this.mode = 'awake';
    this.behavior = 'walk';
    this.until = now + durationMs;
    this.behaviorDeadline = now + durationMs + WATCHDOG_GRACE_MS;
    this.sleepStartedAt = null;
    return { durationMs, facing: this.facing };
  }

  forceSleep(now: number): void {
    this.mode = 'sleep';
    this.behavior = 'sleep';
    this.until = Number.POSITIVE_INFINITY;
    this.behaviorDeadline = now + INDEFINITE_BEHAVIOUR_MS + WATCHDOG_GRACE_MS;
    this.sleepStartedAt = now;
  }

  forceWake(now: number): void {
    this.wake(now);
  }

  wave(now: number): void {
    if (this.mode === 'drag' || this.mode === 'sleep') return;
    this.request('wave', now, 1500);
  }

  celebrate(now: number): void {
    if (this.mode === 'drag') return;

    // One celebration every ten seconds, so a burst of finished blocks does
    // not turn into a burst of confetti.
    if (now - this.lastCelebrateAt < CELEBRATE_COOLDOWN_MS) return;

    // A celebration must not stomp on something more important, such as the
    // pet focusing or being carried.
    if (!this.mayPreempt(this.behavior, 'celebrate')) return;

    this.lastCelebrateAt = now;
    this.request('celebrate', now, 2500);
  }

  addXp(points: number): void {
    this.xp = Math.max(0, Math.round(this.xp + points));
    this.level = levelForXp(this.xp);
  }

  /** Behaviours that run for a while and then finish on their own. */
  private isTransient(): boolean {
    return (
      this.behavior === 'wake' ||
      this.behavior === 'wave' ||
      this.behavior === 'celebrate' ||
      this.behavior === 'walk'
    );
  }

  /**
   * Ask for a behaviour.
   *
   * It only happens if the new behaviour matters more than what is already
   * running, or matters the same and the current one can be cut short.
   */
  private request(behavior: Behavior, now: number, durationMs: number): boolean {
    if (!this.mayPreempt(this.behavior, behavior)) return false;

    this.behavior = behavior;
    this.until = now + durationMs;
    this.behaviorDeadline = now + durationMs + WATCHDOG_GRACE_MS;
    this.noteWorking();
    return true;
  }

  /**
   * The pet is doing something deliberate, so its animation is working. The
   * rescues the watchdog had to make are forgotten.
   */
  private noteWorking(): void {
    this.timeouts = [];
    this.animationPaused = false;
  }

  private mayPreempt(current: Behavior, next: Behavior): boolean {
    if (PRIORITY[next] < PRIORITY[current]) return true;
    if (PRIORITY[next] === PRIORITY[current] && INTERRUPTIBLE[current]) return true;
    return false;
  }

  /** The pet wakes up. */
  private wake(now: number): void {
    this.mode = 'awake';
    this.behavior = 'wake';
    this.until = now + 1200;
    this.behaviorDeadline = now + 1200 + WATCHDOG_GRACE_MS;
    this.sleepStartedAt = null;
    this.scheduleNextWalk(now);
  }

  /**
   * Rescue the pet if a behaviour has run far too long.
   *
   * A behaviour that never ends — focus, sleep, being carried — would
   * otherwise leave the pet stuck in a pose with no way out. If this keeps
   * happening the animation is not working, and the pet stops moving rather
   * than flickering.
   */
  private checkWatchdog(now: number): void {
    if (this.behaviorDeadline === 0) return;
    if (now < this.behaviorDeadline) return;

    this.behaviorDeadline = 0;
    this.timeouts.push(now);
    this.timeouts = this.timeouts.filter((at) => now - at < TIMEOUT_WINDOW_MS);

    // The pet goes back to a state it can definitely get out of.
    this.mode = 'awake';
    this.modeBeforeDrag = null;
    this.behavior = 'idle';
    this.until = 0;
    this.behaviorDeadline = 0;
    this.sleepStartedAt = null;

    this.animationPaused = this.timeouts.length >= MAX_TIMEOUTS_IN_WINDOW;
  }

  private scheduleNextWalk(now: number): void {
    this.nextWalkAt = now + this.randomBetween(WALK_INTERVAL_MIN_MS, WALK_INTERVAL_MAX_MS);
  }

  private randomBetween(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }
}
