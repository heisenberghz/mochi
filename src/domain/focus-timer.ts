import { FOCUS_DEFAULTS } from '../shared/constants';
import type { FocusConfig, FocusPhase, FocusStatus, FocusView } from '../shared/types';

export interface FocusTickResult {
  state: FocusView;
  completedWork?: boolean;
  completedBreak?: boolean;
}

function durationForPhase(config: FocusConfig, phase: FocusPhase): number {
  const minutes =
    phase === 'work'
      ? config.workMin
      : phase === 'shortBreak'
        ? config.shortBreakMin
        : config.longBreakMin;
  return Math.max(1000, Math.round(minutes * 60_000));
}

/**
 * Pure focus timer. Time is injected; the main process drives it with a 1 Hz
 * tick and may pause/resume at any point.
 */
export class FocusTimer {
  private config: FocusConfig;
  private status: FocusStatus = 'idle';
  private phase: FocusPhase = 'work';
  private round = 1;
  private remainingMs: number;
  private endAt = 0;
  private completedToday = 0;

  constructor(config: Partial<FocusConfig> = {}) {
    this.config = { ...FOCUS_DEFAULTS, ...config };
    this.remainingMs = durationForPhase(this.config, 'work');
  }

  getConfig(): FocusConfig {
    return { ...this.config };
  }

  setConfig(patch: Partial<FocusConfig>): FocusConfig {
    if (this.status !== 'idle') return { ...this.config };
    this.config = { ...this.config, ...patch };
    this.remainingMs = durationForPhase(this.config, this.phase);
    return { ...this.config };
  }

  start(now: number): FocusView {
    if (this.status === 'running') return this.state();
    if (this.status === 'paused') return this.resume(now);
    this.status = 'running';
    this.phase = 'work';
    this.round = 1;
    this.remainingMs = durationForPhase(this.config, 'work');
    this.endAt = now + this.remainingMs;
    return this.state();
  }

  pause(now: number): FocusView {
    if (this.status !== 'running') return this.state();
    this.remainingMs = Math.max(0, this.endAt - now);
    this.status = 'paused';
    return this.state();
  }

  resume(now: number): FocusView {
    if (this.status !== 'paused') return this.state();
    this.status = 'running';
    this.remainingMs = Math.max(1000, this.remainingMs);
    this.endAt = now + this.remainingMs;
    return this.state();
  }

  stop(): FocusView {
    this.status = 'idle';
    this.phase = 'work';
    this.round = 1;
    this.remainingMs = durationForPhase(this.config, 'work');
    this.endAt = 0;
    return this.state();
  }

  tick(now: number): FocusTickResult {
    if (this.status !== 'running') return { state: this.state() };
    if (now < this.endAt) {
      this.remainingMs = this.endAt - now;
      return { state: this.state() };
    }

    if (this.phase === 'work') {
      this.completedToday += 1;
      const nextPhase: FocusPhase =
        this.round % this.config.rounds === 0 ? 'longBreak' : 'shortBreak';
      const nextDuration = durationForPhase(this.config, nextPhase);

      if (this.config.autoStartBreak) {
        this.phase = nextPhase;
        this.remainingMs = nextDuration;
        this.endAt = now + nextDuration;
        this.status = 'running';
      } else {
        this.phase = nextPhase;
        this.remainingMs = nextDuration;
        this.status = 'idle';
        this.endAt = 0;
      }

      return { state: this.state(), completedWork: true };
    }

    const nextRound = this.phase === 'longBreak' ? 1 : this.round + 1;
    const workDuration = durationForPhase(this.config, 'work');

    if (this.config.autoStartWork) {
      this.phase = 'work';
      this.round = nextRound;
      this.remainingMs = workDuration;
      this.endAt = now + workDuration;
      this.status = 'running';
    } else {
      this.phase = 'work';
      this.round = nextRound;
      this.remainingMs = workDuration;
      this.status = 'idle';
      this.endAt = 0;
    }

    return { state: this.state(), completedBreak: true };
  }

  state(): FocusView {
    const currentPhase = this.status === 'idle' ? this.phase : this.phase;
    return {
      status: this.status,
      phase: currentPhase,
      remainingMs: Math.max(0, Math.round(this.remainingMs)),
      phaseDurationMs: durationForPhase(this.config, currentPhase),
      round: this.round,
      totalRounds: this.config.rounds,
      completedToday: this.completedToday,
      config: { ...this.config },
    };
  }
}
