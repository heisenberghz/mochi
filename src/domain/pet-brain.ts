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

function localDateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    };
  }

  tick(now: number, ctx: BrainContext): TickResult {
    const elapsed = Math.max(0, now - this.lastTickAt);
    this.lastTickAt = now;

    if (this.mode === 'drag') {
      return { state: this.snapshot() };
    }

    if (ctx.focusActive) {
      this.mode = 'focus';
      this.behavior = 'focus';
      this.until = Number.POSITIVE_INFINITY;
      this.sleepStartedAt = null;
      return { state: this.snapshot() };
    }

    if (this.mode === 'focus') {
      this.mode = 'awake';
      this.behavior = 'idle';
      this.until = 0;
      this.scheduleNextWalk(now);
    }

    if (this.behavior === 'sleep') {
      this.energy = clamp(this.energy + elapsed / SESSION_ENERGY_RECOVERY_MS, 0, 100);
      const userIsBack = ctx.idleSeconds < 60 && this.sleepStartedAt !== null && now - this.sleepStartedAt > 1500;
      if (userIsBack) {
        this.behavior = 'wake';
        this.mode = 'awake';
        this.until = now + 1200;
        this.sleepStartedAt = null;
        this.scheduleNextWalk(now);
      }
      return { state: this.snapshot() };
    }

    this.energy = clamp(this.energy - elapsed / SESSION_ENERGY_DRAIN_MS, 0, 100);

    if (this.behavior === 'wake' || this.behavior === 'wave' || this.behavior === 'celebrate' || this.behavior === 'walk') {
      if (now < this.until) {
        return { state: this.snapshot() };
      }
      if (this.behavior === 'walk') {
        this.scheduleNextWalk(now);
      }
      this.behavior = 'idle';
      this.until = 0;
    }

    const shouldSleep =
      this.energy < 15 ||
      ctx.idleSeconds >= SLEEP_AFTER_IDLE_SECONDS ||
      (ctx.quietHours && ctx.idleSeconds >= QUIET_SLEEP_AFTER_IDLE_SECONDS);

    if (shouldSleep) {
      this.behavior = 'sleep';
      this.mode = 'sleep';
      this.until = Number.POSITIVE_INFINITY;
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
      this.behavior = 'wake';
      this.mode = 'awake';
      this.until = now + 1200;
      this.sleepStartedAt = null;
      this.scheduleNextWalk(now);
      woke = true;
    }

    return { state: this.snapshot(), moodGain, woke };
  }

  flipFacing(): void {
    this.facing = this.facing === 1 ? -1 : 1;
  }

  startDrag(): void {
    this.mode = 'drag';
    this.behavior = 'drag';
    this.until = Number.POSITIVE_INFINITY;
  }

  endDrag(now: number): void {
    this.mode = 'awake';
    this.behavior = 'idle';
    this.until = 0;
    this.scheduleNextWalk(now);
  }

  /** Leave focus immediately when the user ends a session. */
  endFocus(now: number): void {
    if (this.mode !== 'focus') return;
    this.mode = 'awake';
    this.behavior = 'idle';
    this.until = 0;
    this.scheduleNextWalk(now);
  }

  forceWalk(now: number): WalkStart {
    const durationMs = 3600;
    this.facing = this.rng() < 0.5 ? -1 : 1;
    this.mode = 'awake';
    this.behavior = 'walk';
    this.until = now + durationMs;
    this.sleepStartedAt = null;
    return { durationMs, facing: this.facing };
  }

  forceSleep(now: number): void {
    this.mode = 'sleep';
    this.behavior = 'sleep';
    this.until = Number.POSITIVE_INFINITY;
    this.sleepStartedAt = now;
  }

  forceWake(now: number): void {
    this.mode = 'awake';
    this.behavior = 'wake';
    this.until = now + 1200;
    this.sleepStartedAt = null;
    this.scheduleNextWalk(now);
  }

  wave(now: number): void {
    if (this.mode === 'drag' || this.mode === 'sleep') return;
    this.behavior = 'wave';
    this.until = now + 1500;
  }

  celebrate(now: number): void {
    if (this.mode === 'drag') return;
    this.behavior = 'celebrate';
    this.until = now + 2500;
  }

  addXp(points: number): void {
    this.xp = Math.max(0, Math.round(this.xp + points));
    this.level = levelForXp(this.xp);
  }

  private scheduleNextWalk(now: number): void {
    this.nextWalkAt = now + this.randomBetween(WALK_INTERVAL_MIN_MS, WALK_INTERVAL_MAX_MS);
  }

  private randomBetween(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }
}
