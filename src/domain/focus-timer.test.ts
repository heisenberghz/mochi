import { describe, expect, it } from 'vitest';
import { FocusTimer } from './focus-timer';

const MINUTE = 60_000;

describe('FocusTimer', () => {
  it('starts a 25-minute work phase', () => {
    const timer = new FocusTimer();
    const state = timer.start(0);

    expect(state.status).toBe('running');
    expect(state.phase).toBe('work');
    expect(state.remainingMs).toBe(25 * MINUTE);
    expect(state.round).toBe(1);
  });

  it('counts down and completes work into a short break', () => {
    const timer = new FocusTimer();
    timer.start(0);

    const midway = timer.tick(10 * MINUTE);
    expect(midway.state.remainingMs).toBe(15 * MINUTE);
    expect(midway.completedWork).toBeUndefined();

    const complete = timer.tick(25 * MINUTE);
    expect(complete.completedWork).toBe(true);
    expect(complete.state.phase).toBe('shortBreak');
    expect(complete.state.status).toBe('running');
    expect(complete.state.remainingMs).toBe(5 * MINUTE);
    expect(complete.state.completedToday).toBe(1);
  });

  it('pauses and resumes without losing remaining time', () => {
    const timer = new FocusTimer();
    timer.start(0);
    const paused = timer.pause(10 * MINUTE);

    expect(paused.status).toBe('paused');
    expect(paused.remainingMs).toBe(15 * MINUTE);

    // Time passing while paused must not advance the timer.
    timer.tick(30 * MINUTE);
    expect(timer.state().remainingMs).toBe(15 * MINUTE);
    expect(timer.state().completedToday).toBe(0);

    timer.resume(30 * MINUTE);
    const complete = timer.tick(45 * MINUTE);
    expect(complete.completedWork).toBe(true);
  });

  it('runs multiple rounds and reaches a long break', () => {
    const timer = new FocusTimer({
      workMin: 1,
      shortBreakMin: 1,
      longBreakMin: 2,
      rounds: 2,
      autoStartBreak: true,
      autoStartWork: true,
    });

    timer.start(0);
    timer.tick(1 * MINUTE); // work 1 complete -> short break
    timer.tick(2 * MINUTE); // break complete -> work 2 starts
    expect(timer.state().round).toBe(2);
    expect(timer.state().phase).toBe('work');

    const completed = timer.tick(3 * MINUTE); // work 2 complete -> long break
    expect(completed.completedWork).toBe(true);
    expect(completed.state.phase).toBe('longBreak');
    expect(completed.state.remainingMs).toBe(2 * MINUTE);
  });

  it('stops back to a fresh work phase', () => {
    const timer = new FocusTimer();
    timer.start(0);
    timer.pause(5 * MINUTE);
    const stopped = timer.stop();

    expect(stopped.status).toBe('idle');
    expect(stopped.phase).toBe('work');
    expect(stopped.remainingMs).toBe(25 * MINUTE);
    expect(stopped.round).toBe(1);
  });

  it('does not change config while a session is running', () => {
    const timer = new FocusTimer();
    timer.start(0);
    const config = timer.setConfig({ workMin: 50 });
    expect(config.workMin).toBe(25);
  });
});
