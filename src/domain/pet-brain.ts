import {
  MAX_OFFLINE_HOURS,
  MICRO_BEHAVIOR_IDLE_SECONDS,
  MICRO_BEHAVIOR_INTERVAL_MAX_MS,
  MICRO_BEHAVIOR_INTERVAL_MIN_MS,
  MOOD_BREAK_REWARD,
  MOOD_DECAY_DAILY_CAP,
  MOOD_DECAY_INTERVAL_MS,
  MOOD_FOCUS_REWARD,
  MOOD_LEVEL_REWARD,
  MOOD_OFFLINE_DECAY,
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
  /** When the user was last here, so the pet can catch up. */
  lastSeenAt: number | null;
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
  lookLeft: 4,
  lookRight: 4,
  earFlick: 4,
  stretch: 4,
  yawn: 4,
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
  lookLeft: true,
  lookRight: true,
  earFlick: true,
  stretch: true,
  yawn: true,
  idle: true,
};

/**
 * The small things the pet does of its own.
 *
 * They are what stops it looking like a statue, and they only happen when
 * the user is away — a pet that fidgeted while you were working would be
 * noise, not company.
 */
interface MicroBehavior {
  id: Behavior;
  /** How likely it is to be picked, against the others. */
  weight: number;
  /** How long before it can happen again. */
  cooldownMs: number;
  /** How long it lasts. */
  durationMs: number;
  /** The pet needs this much energy to bother. */
  minEnergy: number;
}

const MICRO_BEHAVIORS: readonly MicroBehavior[] = [
  { id: 'lookLeft', weight: 3, cooldownMs: 25_000, durationMs: 1400, minEnergy: 20 },
  { id: 'lookRight', weight: 3, cooldownMs: 25_000, durationMs: 1400, minEnergy: 20 },
  { id: 'earFlick', weight: 2, cooldownMs: 45_000, durationMs: 700, minEnergy: 20 },
  { id: 'stretch', weight: 2, cooldownMs: 60_000, durationMs: 1600, minEnergy: 40 },
  { id: 'yawn', weight: 1, cooldownMs: 90_000, durationMs: 1400, minEnergy: 15 },
];

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
  /** Mood lost so far today, so it cannot fall away without limit. */
  private moodDecayedToday = 0;
  /** Time towards the next mood decay. */
  private moodDecayAccumulator = 0;

  /** When the pet may next do something small of its own. */
  private nextMicroAt = 0;
  /** The last small thing it did, so it never repeats itself. */
  private lastMicro: Behavior | null = null;
  /** When each small thing may happen again. */
  private microCooldowns = new Map<Behavior, number>();

  /** When the user was last here. */
  private lastSeenAt: number | null = null;

  private readonly rng: () => number;

  constructor(options: BrainOptions = {}) {
    const now = options.now ?? Date.now();
    this.rng = options.rng ?? Math.random;
    this.lastTickAt = now;
    this.moodDate = localDateKey(now);
    this.nextWalkAt = now + this.randomBetween(WALK_INTERVAL_MIN_MS, WALK_INTERVAL_MAX_MS);
  }

  restore(pet: Partial<StoredPet>, now: number): void {
    if (typeof pet.energy === 'number') this.energy = clamp(pet.energy, 0, 100);
    if (typeof pet.mood === 'number') this.mood = clamp(pet.mood, 20, 100);
    if (typeof pet.xp === 'number') {
      this.xp = Math.max(0, pet.xp);
      this.level = levelForXp(this.xp);
    }
    if (pet.facing === 1 || pet.facing === -1) this.facing = pet.facing;

    const lastSeen = typeof pet.lastSeenAt === 'number' ? pet.lastSeenAt : null;
    this.lastSeenAt = now;

    if (lastSeen !== null) this.applyOfflineRecovery(now, lastSeen);
  }

  /** When the user was last here, so it can be remembered. */
  get lastSeen(): number | null {
    return this.lastSeenAt;
  }

  /**
   * Catch the pet up on the time it was away.
   *
   * It recovers energy at the same rate as a nap, but only for the first
   * twelve hours, and its mood fades a little for every day it was ignored.
   */
  private applyOfflineRecovery(now: number, lastSeen: number): void {
    const awayMs = Math.max(0, now - lastSeen);
    const capped = Math.min(awayMs, MAX_OFFLINE_HOURS * 60 * 60 * 1000);

    this.energy = clamp(this.energy + capped / SESSION_ENERGY_RECOVERY_MS, 0, 100);

    const dayMs = 24 * 60 * 60 * 1000;
    const moodLoss = Math.min(
      MOOD_OFFLINE_DECAY,
      Math.floor((awayMs / dayMs) * MOOD_OFFLINE_DECAY),
    );
    this.mood = clamp(this.mood - moodLoss, 20, 100);
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
    this.applyMoodDecay(elapsed, now);

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

    // The pet does small things of its own when the user is away. This comes
    // before a walk, because a glance about is more interesting than a stroll.
    if (this.tryMicroBehavior(now, ctx)) {
      return { state: this.snapshot() };
    }

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
    const before = this.level;
    this.xp = Math.max(0, Math.round(this.xp + points));
    this.level = levelForXp(this.xp);
    if (this.level > before) this.rewardLevelUp();
  }

  /** A finished block makes the pet pleased. */
  rewardFocusPhase(): void {
    this.mood = clamp(this.mood + MOOD_FOCUS_REWARD, 20, 100);
  }

  /** A finished break does too, just a little less. */
  rewardBreak(): void {
    this.mood = clamp(this.mood + MOOD_BREAK_REWARD, 20, 100);
  }

  /** Reaching a new level is worth a smile. */
  rewardLevelUp(): void {
    this.mood = clamp(this.mood + MOOD_LEVEL_REWARD, 20, 100);
  }

  /** Behaviours that run for a while and then finish on their own. */
  private isTransient(): boolean {
    return (
      this.behavior === 'wake' ||
      this.behavior === 'wave' ||
      this.behavior === 'celebrate' ||
      this.behavior === 'walk' ||
      this.isMicroBehavior(this.behavior)
    );
  }

  private isMicroBehavior(behavior: Behavior): boolean {
    return MICRO_BEHAVIORS.some((m) => m.id === behavior);
  }

  /**
   * Do something small, if it is time and the pet is in the mood.
   *
   * The pet stays out of the way while the user is at the keyboard. A pet that
   * fidgeted while you were working would be noise, not company.
   */
  private tryMicroBehavior(now: number, ctx: BrainContext): boolean {
    if (now < this.nextMicroAt) return false;

    if (ctx.idleSeconds < MICRO_BEHAVIOR_IDLE_SECONDS || this.energy <= 15) {
      this.nextMicroAt =
        now + this.randomBetween(MICRO_BEHAVIOR_INTERVAL_MIN_MS, MICRO_BEHAVIOR_INTERVAL_MAX_MS);
      return false;
    }

    const choice = this.pickMicroBehavior(now);
    this.nextMicroAt =
      now + this.randomBetween(MICRO_BEHAVIOR_INTERVAL_MIN_MS, MICRO_BEHAVIOR_INTERVAL_MAX_MS);

    if (!choice) return false;

    this.lastMicro = choice.id;
    this.microCooldowns.set(choice.id, now + choice.cooldownMs);
    this.behavior = choice.id;
    this.until = now + choice.durationMs;
    this.behaviorDeadline = now + choice.durationMs + WATCHDOG_GRACE_MS;
    return true;
  }

  /** Choose one of the small things, by weight, never the same one twice running. */
  private pickMicroBehavior(now: number): MicroBehavior | null {
    const eligible = MICRO_BEHAVIORS.filter((m) => {
      if (m.id === this.lastMicro) return false;
      if (now < (this.microCooldowns.get(m.id) ?? 0)) return false;
      if (this.energy < m.minEnergy) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    const total = eligible.reduce((sum, m) => sum + m.weight, 0);
    let roll = this.rng() * total;

    for (const candidate of eligible) {
      roll -= candidate.weight;
      if (roll <= 0) return candidate;
    }
    return eligible[eligible.length - 1] ?? null;
  }

  /**
   * The pet's mood fades a little for every six hours it is left alone, but
   * never by more than four in a day. It is neglect, not punishment.
   */
  private applyMoodDecay(elapsed: number, now: number): void {
    this.moodDecayAccumulator += elapsed;
    if (this.moodDecayAccumulator < MOOD_DECAY_INTERVAL_MS) return;

    this.moodDecayAccumulator -= MOOD_DECAY_INTERVAL_MS;

    const today = localDateKey(now);
    if (today !== this.moodDate) {
      this.moodDate = today;
      this.moodGainedToday = 0;
      this.moodDecayedToday = 0;
    }

    if (this.moodDecayedToday >= MOOD_DECAY_DAILY_CAP) return;

    this.mood = clamp(this.mood - 1, 20, 100);
    this.moodDecayedToday += 1;
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
