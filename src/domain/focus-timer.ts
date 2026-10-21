import { FOCUS_DEFAULTS, FOCUS_PARTIAL_CREDIT_RATIO } from '../shared/constants';
import type {
  FocusConfig,
  FocusPauseReason,
  FocusPhase,
  FocusStatus,
  FocusView,
} from '../shared/types';

/**
 * Everything the timer needs to know about time that it cannot work out for
 * itself. Injected so the domain stays pure and the tests stay deterministic.
 */
export interface FocusClock {
  /**
   * The local calendar date at the given instant, as `YYYY-MM-DD`.
   *
   * The instant is on the same monotonic timeline the timer is driven with,
   * so the day a session is credited to always matches the day its time was
   * actually spent on.
   */
  localDateKeyAt(monotonicMs: number): string;
}

export interface FocusSessionRecord {
  /** The local day the session was spent on. */
  dayKey: string;
  phase: FocusPhase;
  /** How much of the phase was actually focused, in milliseconds. */
  focusedMs: number;
  /** Whether the phase ran to the end. */
  completed: boolean;
}

export interface FocusAggregates {
  /** The local day these counters belong to. */
  dayKey: string;
  completedToday: number;
  focusedMsToday: number;
  /** Focus time on each local day, so a block spanning midnight is split. */
  focusedByDay: Record<string, number>;
  streakDays: number;
  /** The last day a block was completed on. */
  lastCompletedDay: string | null;
}

export interface FocusActiveSession {
  status: FocusStatus;
  phase: FocusPhase;
  round: number;
  remainingMs: number;
  startedAtMs: number | null;
  pauseReason: FocusPauseReason | null;
}

export interface FocusPersisted {
  config: FocusConfig;
  aggregates: FocusAggregates;
  sessions: FocusSessionRecord[];
  active: FocusActiveSession | null;
}

export interface FocusTickResult {
  state: FocusView;
  completedWork?: boolean;
  completedBreak?: boolean;
  /** True when the local day changed and the daily counters were reset. */
  dayRolledOver?: boolean;
}

export interface FocusAbandonResult {
  state: FocusView;
  /** How much of the phase was actually focused, in milliseconds. */
  focusedMs: number;
  /** How much of the phase was completed, from 0 to 1. */
  completionRatio: number;
  /** Whether a partial session of this length counts. */
  counts: boolean;
}

export interface FocusSkipResult {
  state: FocusView;
  skippedPhase: FocusPhase;
}

/** How many finished sessions are kept. */
const MAX_RECENT_SESSIONS = 30;

/** How many days of totals are kept — a little over two years. */
const MAX_TRACKED_DAYS = 800;

/**
 * The day before the given one, as `YYYY-MM-DD`.
 *
 * Used to work out whether yesterday's block makes today a continuation of
 * the streak or the start of a new one.
 */
export function previousDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map((part) => Number(part));
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Pure focus timer.
 *
 * Time is injected on every call and must never go backwards. The caller is
 * expected to pass a monotonic clock, so that changing the system clock cannot
 * stretch or shorten a session.
 *
 * Pausing at a suspend and resuming at the wake is what keeps the gap out of
 * the session, so the timer's own arithmetic never has to know that the
 * machine was asleep.
 */
export class FocusTimer {
  private config: FocusConfig;
  private readonly clock: FocusClock;

  private status: FocusStatus = 'idle';
  private phase: FocusPhase = 'work';
  private round = 1;
  private remainingMs: number;
  /** The length the current phase started with, so the ring stays honest. */
  private phaseDurationMs: number;
  /** The monotonic instant the current phase ends at. */
  private deadline = 0;
  /** The monotonic instant of the last tick. */
  private lastTickAt = 0;
  private startedAtMs: number | null = null;
  private pauseReason: FocusPauseReason | null = null;

  private aggregates: FocusAggregates;
  private sessions: FocusSessionRecord[] = [];

  constructor(config: Partial<FocusConfig> = {}, clock: FocusClock) {
    this.config = safeConfig({ ...FOCUS_DEFAULTS, ...config });
    this.clock = clock;
    this.remainingMs = this.durationFor('work');
    this.phaseDurationMs = this.remainingMs;
    this.aggregates = {
      dayKey: clock.localDateKeyAt(0),
      completedToday: 0,
      focusedMsToday: 0,
      focusedByDay: {},
      streakDays: 0,
      lastCompletedDay: null,
    };
  }

  getConfig(): FocusConfig {
    return { ...this.config };
  }

  /**
   * Change the configuration.
   *
   * A change made while a session is running applies to the **next** phase —
   * the phase in progress keeps the length it started with.
   */
  setConfig(patch: Partial<FocusConfig>): FocusConfig {
    const next = safeConfig({ ...this.config, ...patch });
    this.config = next;

    if (this.status === 'idle') {
      this.remainingMs = this.durationFor(this.phase);
      this.phaseDurationMs = this.remainingMs;
    }

    return { ...this.config };
  }

  start(now: number): FocusView {
    if (this.status === 'running') return this.state();
    if (this.status === 'paused') return this.resume(now);

    // A break that is waiting to be started should start the break, not throw
    // away the break and begin a new block of work.
    if (this.phase !== 'work') {
      this.status = 'running';
      this.remainingMs = this.durationFor(this.phase);
      this.phaseDurationMs = this.remainingMs;
      this.deadline = now + this.remainingMs;
      this.lastTickAt = now;
      this.startedAtMs = now;
      this.pauseReason = null;
      return this.state();
    }

    this.status = 'running';
    this.phase = 'work';
    this.round = 1;
    this.remainingMs = this.durationFor('work');
    this.phaseDurationMs = this.remainingMs;
    this.deadline = now + this.remainingMs;
    this.lastTickAt = now;
    this.startedAtMs = now;
    this.pauseReason = null;
    return this.state();
  }

  pause(now: number, reason: FocusPauseReason = 'user'): FocusView {
    if (this.status !== 'running') return this.state();
    this.remainingMs = Math.max(0, this.deadline - now);
    this.status = 'paused';
    this.pauseReason = reason;
    return this.state();
  }

  resume(now: number): FocusView {
    if (this.status !== 'paused') return this.state();
    this.status = 'running';
    this.remainingMs = Math.max(1000, this.remainingMs);
    this.deadline = now + this.remainingMs;
    this.lastTickAt = now;
    this.pauseReason = null;
    return this.state();
  }

  /** End the session completely, keeping nothing of it. */
  stop(): FocusView {
    this.status = 'idle';
    this.phase = 'work';
    this.round = 1;
    this.remainingMs = this.durationFor('work');
    this.phaseDurationMs = this.remainingMs;
    this.deadline = 0;
    this.startedAtMs = null;
    this.pauseReason = null;
    return this.state();
  }

  /**
   * End the session but keep what was actually focused.
   *
   * A session that was at least half focused counts towards the day's total
   * but is not a completed block, so it does not move the streak.
   */
  abandon(): FocusAbandonResult {
    const focusedMs = this.focusedMsInCurrentPhase();
    const completionRatio =
      this.phaseDurationMs > 0 ? Math.min(1, focusedMs / this.phaseDurationMs) : 0;
    const isWorkPhase = this.phase === 'work';
    const counts = isWorkPhase && completionRatio >= FOCUS_PARTIAL_CREDIT_RATIO;

    // Only a work phase is a session. A break that was cut short is nothing.
    if (isWorkPhase && focusedMs > 0) {
      this.sessions.push({
        dayKey: this.aggregates.dayKey,
        phase: 'work',
        focusedMs,
        completed: false,
      });
      this.trimSessions();
    }

    return { state: this.stop(), focusedMs, completionRatio, counts };
  }

  /**
   * Move to the next phase without crediting anything: no XP, no completed
   * session, no streak.
   */
  skip(now: number): FocusSkipResult {
    if (this.status !== 'running' && this.status !== 'paused') {
      return { state: this.state(), skippedPhase: this.phase };
    }

    const skippedPhase = this.phase;
    const next = this.nextPhaseInfo();

    // A skipped work phase hands over to the break; a skipped break hands
    // over to the next round of work.
    const autoStart =
      skippedPhase === 'work' ? this.config.autoStartBreak : this.config.autoStartWork;

    this.advanceTo(next.phase, next.round, now, autoStart);
    return { state: this.state(), skippedPhase };
  }

  tick(now: number): FocusTickResult {
    // The day rolls over whether or not a session is running. Otherwise
    // "blocks today" would still be showing yesterday's count first thing in
    // the morning.
    const rolledOver = this.checkDayRollover(now);

    if (this.status !== 'running') {
      return rolledOver ? { state: this.state(), dayRolledOver: true } : { state: this.state() };
    }

    const elapsed = Math.max(0, now - this.lastTickAt);
    this.lastTickAt = now;
    this.attributeElapsed(elapsed, now);

    if (now < this.deadline) {
      this.remainingMs = this.deadline - now;
      return { state: this.state() };
    }

    if (this.phase === 'work') {
      this.aggregates.completedToday += 1;
      this.updateStreak();
      this.sessions.push({
        dayKey: this.aggregates.dayKey,
        phase: 'work',
        focusedMs: this.phaseDurationMs,
        completed: true,
      });
      this.trimSessions();

      const next = this.nextPhaseInfo();
      this.advanceTo(next.phase, next.round, now, this.config.autoStartBreak);
      return { state: this.state(), completedWork: true };
    }

    const next = this.nextPhaseInfo();
    this.advanceTo(next.phase, next.round, now, this.config.autoStartWork);
    return { state: this.state(), completedBreak: true };
  }

  /** The current state, safe to show. */
  state(): FocusView {
    return {
      status: this.status,
      phase: this.phase,
      remainingMs: Math.max(0, Math.round(this.remainingMs)),
      phaseDurationMs: this.phaseDurationMs,
      round: this.round,
      totalRounds: this.config.rounds,
      completedToday: this.aggregates.completedToday,
      focusedMsToday: Math.round(this.aggregates.focusedMsToday),
      streakDays: this.aggregates.streakDays,
      pauseReason: this.pauseReason,
      startedAtMs: this.startedAtMs,
      config: { ...this.config },
    };
  }

  /** Everything that needs to survive a restart. */
  serialize(): FocusPersisted {
    const active: FocusActiveSession | null =
      this.status === 'idle'
        ? null
        : {
            status: this.status,
            phase: this.phase,
            round: this.round,
            remainingMs: Math.max(0, Math.round(this.remainingMs)),
            startedAtMs: this.startedAtMs,
            pauseReason: this.pauseReason,
          };

    return {
      config: { ...this.config },
      aggregates: { ...this.aggregates },
      sessions: this.sessions.map((session) => ({ ...session })),
      active,
    };
  }

  /**
   * Pick up where the last run left off.
   *
   * A session that was running comes back **paused**, never running: the
   * monotonic clock starts again with the process, so the old deadline means
   * nothing. The user decides whether to carry on.
   */
  restore(persisted: Partial<FocusPersisted>): void {
    if (persisted.config) {
      this.config = safeConfig({ ...FOCUS_DEFAULTS, ...persisted.config });
    }

    if (persisted.aggregates) {
      const aggregates = persisted.aggregates;
      this.aggregates = {
        dayKey: typeof aggregates.dayKey === 'string' ? aggregates.dayKey : this.aggregates.dayKey,
        completedToday: countOr(aggregates.completedToday),
        focusedMsToday: Math.max(0, countOr(aggregates.focusedMsToday)),
        focusedByDay: sanitiseDayTotals(aggregates.focusedByDay),
        streakDays: countOr(aggregates.streakDays),
        lastCompletedDay:
          typeof aggregates.lastCompletedDay === 'string' ? aggregates.lastCompletedDay : null,
      };
    }

    if (Array.isArray(persisted.sessions)) {
      this.sessions = persisted.sessions
        .filter(
          (session): session is FocusSessionRecord =>
            typeof session?.dayKey === 'string' && typeof session?.focusedMs === 'number',
        )
        .slice(-MAX_RECENT_SESSIONS)
        .map((session) => ({ ...session }));
    }

    const active = persisted.active;
    if (!active) return;

    this.phase = active.phase === 'work' ? 'work' : active.phase;
    this.round = Math.max(1, countOr(active.round));
    this.remainingMs = Math.max(1000, countOr(active.remainingMs));
    this.phaseDurationMs = this.durationFor(this.phase);
    this.startedAtMs = typeof active.startedAtMs === 'number' ? active.startedAtMs : null;
    this.status = 'paused';
    this.pauseReason = 'recovered';
    this.deadline = 0;
    this.lastTickAt = 0;
  }

  private durationFor(phase: FocusPhase): number {
    const minutes =
      phase === 'work'
        ? this.config.workMin
        : phase === 'shortBreak'
          ? this.config.shortBreakMin
          : this.config.longBreakMin;
    return Math.max(1000, Math.round(minutes * 60_000));
  }

  /** How much of the current phase was actually focused. */
  private focusedMsInCurrentPhase(): number {
    if (this.status === 'idle') return 0;
    return Math.max(0, this.phaseDurationMs - this.remainingMs);
  }

  private nextPhaseInfo(): { phase: FocusPhase; round: number } {
    if (this.phase === 'work') {
      return {
        phase: this.round % this.config.rounds === 0 ? 'longBreak' : 'shortBreak',
        round: this.round,
      };
    }
    return {
      phase: 'work',
      round: this.phase === 'longBreak' ? 1 : this.round + 1,
    };
  }

  private advanceTo(phase: FocusPhase, round: number, now: number, autoStart: boolean): void {
    this.phase = phase;
    this.round = round;
    this.remainingMs = this.durationFor(phase);
    this.phaseDurationMs = this.remainingMs;
    this.startedAtMs = now;
    this.pauseReason = null;

    if (autoStart) {
      this.status = 'running';
      this.deadline = now + this.remainingMs;
      this.lastTickAt = now;
    } else {
      this.status = 'idle';
      this.deadline = 0;
    }
  }

  /**
   * Credit the time that just passed to the day it was spent on, and start a
   * new day when the local date changes.
   */
  private attributeElapsed(elapsed: number, now: number): void {
    if (elapsed <= 0) return;

    this.checkDayRollover(now);
    const dayKey = this.aggregates.dayKey;

    this.aggregates.focusedMsToday += elapsed;
    this.aggregates.focusedByDay[dayKey] =
      (this.aggregates.focusedByDay[dayKey] ?? 0) + elapsed;
    this.trimDays();
  }

  /**
   * Start a new day when the local date changes.
   *
   * Returns true when it actually rolled over.
   */
  private checkDayRollover(now: number): boolean {
    const dayKey = this.clock.localDateKeyAt(now);
    if (dayKey === this.aggregates.dayKey) return false;

    this.aggregates.dayKey = dayKey;
    this.aggregates.completedToday = 0;
    this.aggregates.focusedMsToday = 0;
    return true;
  }

  /** Keep the daily totals from growing without bound. */
  private trimDays(): void {
    const days = Object.keys(this.aggregates.focusedByDay);
    if (days.length <= MAX_TRACKED_DAYS) return;

    // Insertion order is the order the days were first seen, so the oldest
    // are at the front.
    for (const day of days.slice(0, days.length - MAX_TRACKED_DAYS)) {
      delete this.aggregates.focusedByDay[day];
    }
  }

  private updateStreak(): void {
    const today = this.aggregates.dayKey;
    if (this.aggregates.lastCompletedDay === today) return;

    const continues =
      this.aggregates.lastCompletedDay !== null &&
      this.aggregates.lastCompletedDay === previousDayKey(today);

    this.aggregates.streakDays = continues ? this.aggregates.streakDays + 1 : 1;
    this.aggregates.lastCompletedDay = today;
  }

  private trimSessions(): void {
    if (this.sessions.length > MAX_RECENT_SESSIONS) {
      this.sessions = this.sessions.slice(-MAX_RECENT_SESSIONS);
    }
  }
}

function countOr(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/**
 * Keep the configuration sane.
 *
 * These are safety bounds, not product rules: the product limits (focus 5 to
 * 120 minutes, and so on) are checked at the boundary, where the user can be
 * told why a value was refused. All the timer needs is a phase that is not
 * zero-length and a round count that is at least one.
 */
function safeConfig(config: FocusConfig): FocusConfig {
  const minutes = (value: number, fallback: number): number =>
    Number.isFinite(value) && value > 0 ? Math.min(1440, value) : fallback;

  return {
    workMin: minutes(config.workMin, FOCUS_DEFAULTS.workMin),
    shortBreakMin: minutes(config.shortBreakMin, FOCUS_DEFAULTS.shortBreakMin),
    longBreakMin: minutes(config.longBreakMin, FOCUS_DEFAULTS.longBreakMin),
    rounds:
      Number.isFinite(config.rounds) && config.rounds >= 1
        ? Math.min(50, Math.round(config.rounds))
        : FOCUS_DEFAULTS.rounds,
    autoStartBreak: config.autoStartBreak === true,
    autoStartWork: config.autoStartWork === true,
  };
}

function sanitiseDayTotals(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {};
  const totals: Record<string, number> = {};
  for (const [day, ms] of Object.entries(value as Record<string, unknown>)) {
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
      totals[day] = Math.round(ms);
    }
  }
  return totals;
}
