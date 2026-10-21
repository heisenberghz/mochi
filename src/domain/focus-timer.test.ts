import { describe, expect, it } from 'vitest';
import { FocusTimer, previousDayKey, type FocusClock } from './focus-timer';
import type { FocusConfig } from '../shared/types';

const MINUTE = 60_000;

/** A clock whose day can be moved forward on purpose. */
class FakeClock implements FocusClock {
  day = '2026-03-10';

  localDateKeyAt(): string {
    return this.day;
  }
}

function makeTimer(config: Partial<FocusConfig> = {}): {
  clock: FakeClock;
  timer: FocusTimer;
} {
  const clock = new FakeClock();
  return { clock, timer: new FocusTimer(config, clock) };
}

describe('FocusTimer', () => {
  it('starts idle with a full work phase showing', () => {
    const { timer } = makeTimer();
    const state = timer.state();

    expect(state.status).toBe('idle');
    expect(state.phase).toBe('work');
    expect(state.remainingMs).toBe(25 * MINUTE);
    expect(state.round).toBe(1);
  });

  it('starts a 25-minute work phase', () => {
    const { timer } = makeTimer();
    const state = timer.start(0);

    expect(state.status).toBe('running');
    expect(state.phase).toBe('work');
    expect(state.remainingMs).toBe(25 * MINUTE);
  });

  it('counts down', () => {
    const { timer } = makeTimer();
    timer.start(0);

    const midway = timer.tick(10 * MINUTE);
    expect(midway.state.remainingMs).toBe(15 * MINUTE);
    expect(midway.completedWork).toBeUndefined();
  });

  it('completes a work phase into a short break', () => {
    const { timer } = makeTimer();
    timer.start(0);

    const complete = timer.tick(25 * MINUTE);
    expect(complete.completedWork).toBe(true);
    expect(complete.state.phase).toBe('shortBreak');
    expect(complete.state.status).toBe('running');
    expect(complete.state.remainingMs).toBe(5 * MINUTE);
    expect(complete.state.completedToday).toBe(1);
  });

  it('reaches a long break after the configured rounds', () => {
    const { timer } = makeTimer({
      workMin: 1,
      shortBreakMin: 1,
      longBreakMin: 2,
      rounds: 2,
      autoStartBreak: true,
      autoStartWork: true,
    });

    timer.start(0);
    timer.tick(1 * MINUTE); // work one done
    timer.tick(2 * MINUTE); // break done, work two starts
    expect(timer.state().round).toBe(2);

    const completed = timer.tick(3 * MINUTE); // work two done
    expect(completed.completedWork).toBe(true);
    expect(completed.state.phase).toBe('longBreak');
    expect(completed.state.remainingMs).toBe(2 * MINUTE);
  });

  it('pauses and resumes without losing remaining time', () => {
    const { timer } = makeTimer();
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

  it('remembers why it is paused', () => {
    const { timer } = makeTimer();
    timer.start(0);

    expect(timer.pause(0, 'idle').pauseReason).toBe('idle');

    timer.resume(0);
    expect(timer.pause(0, 'lock').pauseReason).toBe('lock');

    timer.resume(0);
    expect(timer.pause(0, 'suspend').pauseReason).toBe('suspend');
  });

  it('does not let a suspend eat into the session', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(10 * MINUTE);

    // The machine sleeps for thirty minutes.
    timer.pause(10 * MINUTE, 'suspend');
    expect(timer.state().remainingMs).toBe(15 * MINUTE);

    // It wakes up. The clock has moved on; the session has not.
    timer.resume(40 * MINUTE);
    expect(timer.state().remainingMs).toBe(15 * MINUTE);

    timer.tick(55 * MINUTE);
    expect(timer.state().phase).toBe('shortBreak');
  });

  it('stops back to a fresh work phase', () => {
    const { timer } = makeTimer();
    timer.start(0);
    timer.pause(5 * MINUTE);

    const stopped = timer.stop();
    expect(stopped.status).toBe('idle');
    expect(stopped.phase).toBe('work');
    expect(stopped.remainingMs).toBe(25 * MINUTE);
    expect(stopped.round).toBe(1);
  });

  it('starting while a break is waiting starts the break', () => {
    const { timer } = makeTimer({ workMin: 25, autoStartBreak: false });
    timer.start(0);
    timer.tick(25 * MINUTE);

    expect(timer.state().status).toBe('idle');
    expect(timer.state().phase).toBe('shortBreak');

    timer.start(25 * MINUTE);
    expect(timer.state().status).toBe('running');
    expect(timer.state().phase).toBe('shortBreak');
    expect(timer.state().remainingMs).toBe(5 * MINUTE);
  });
});

describe('FocusTimer day and streak', () => {
  it('records the focus time of today', () => {
    const { timer } = makeTimer();
    timer.start(0);
    timer.tick(10 * MINUTE);

    expect(timer.state().focusedMsToday).toBe(10 * MINUTE);
  });

  it('resets the day counters at local midnight', () => {
    const { clock, timer } = makeTimer({ workMin: 1, autoStartBreak: false });
    timer.start(0);
    timer.tick(1 * MINUTE);
    expect(timer.state().completedToday).toBe(1);

    clock.day = '2026-03-11';
    timer.tick(2 * MINUTE);

    expect(timer.state().completedToday).toBe(0);
    expect(timer.state().focusedMsToday).toBe(0);
    // The time is not lost — it stays against the day it was spent on.
    expect(timer.serialize().aggregates.focusedByDay['2026-03-10']).toBe(1 * MINUTE);
  });

  it('rolls over to the new day even when no session is running', () => {
    const { clock, timer } = makeTimer();
    timer.start(0);
    timer.tick(1 * MINUTE);
    timer.stop();

    clock.day = '2026-03-11';
    const result = timer.tick(2 * MINUTE);

    expect(result.dayRolledOver).toBe(true);
    expect(timer.state().completedToday).toBe(0);
  });

  it('splits the minutes across a midnight boundary', () => {
    const { clock, timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(10 * MINUTE);

    clock.day = '2026-03-11';
    timer.tick(25 * MINUTE);

    const byDay = timer.serialize().aggregates.focusedByDay;
    expect(byDay['2026-03-10']).toBe(10 * MINUTE);
    expect(byDay['2026-03-11']).toBe(15 * MINUTE);
  });

  it('counts consecutive days as a streak', () => {
    const { clock, timer } = makeTimer({
      workMin: 1,
      shortBreakMin: 1,
      autoStartBreak: false,
      autoStartWork: false,
    });
    let t = 0;

    timer.start(t);
    t += MINUTE;
    timer.tick(t);
    expect(timer.state().streakDays).toBe(1);

    // Get back to a work phase.
    timer.start(t);
    t += MINUTE;
    timer.tick(t);
    expect(timer.state().phase).toBe('work');

    // The next day.
    clock.day = '2026-03-11';
    timer.start(t);
    t += MINUTE;
    timer.tick(t);

    expect(timer.state().streakDays).toBe(2);
  });

  it('starts a new streak after a gap', () => {
    const { clock, timer } = makeTimer({ workMin: 1, autoStartBreak: false });
    let t = 0;

    timer.start(t);
    t += MINUTE;
    timer.tick(t);
    expect(timer.state().streakDays).toBe(1);

    // Four days later.
    clock.day = '2026-03-14';
    timer.start(t);
    t += MINUTE;
    timer.tick(t);

    expect(timer.state().streakDays).toBe(1);
  });
});

describe('FocusTimer skip', () => {
  it('skipping a work phase earns nothing', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(10 * MINUTE);

    const result = timer.skip(10 * MINUTE);
    expect(result.skippedPhase).toBe('work');
    expect(result.state.phase).toBe('shortBreak');
    expect(result.state.completedToday).toBe(0);
    expect(result.state.streakDays).toBe(0);
  });

  it('skipping a break moves on to the next block of work', () => {
    const { timer } = makeTimer({ workMin: 25, shortBreakMin: 5 });
    timer.start(0);
    timer.skip(0);
    expect(timer.state().phase).toBe('shortBreak');

    const result = timer.skip(0);
    expect(result.skippedPhase).toBe('shortBreak');
    expect(result.state.phase).toBe('work');
    expect(result.state.round).toBe(2);
  });

  it('skipping when nothing is running does nothing', () => {
    const { timer } = makeTimer();
    const result = timer.skip(0);
    expect(result.state.status).toBe('idle');
  });
});

describe('FocusTimer abandon', () => {
  it('an abandoned session below half does not count', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(10 * MINUTE);

    const result = timer.abandon();
    expect(result.focusedMs).toBe(10 * MINUTE);
    expect(result.completionRatio).toBeCloseTo(0.4);
    expect(result.counts).toBe(false);
    expect(result.state.completedToday).toBe(0);
    expect(result.state.streakDays).toBe(0);
  });

  it('an abandoned session past half counts, but is not a completed block', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(15 * MINUTE);

    const result = timer.abandon();
    expect(result.focusedMs).toBe(15 * MINUTE);
    expect(result.completionRatio).toBeCloseTo(0.6);
    expect(result.counts).toBe(true);
    expect(result.state.completedToday).toBe(0);
    expect(result.state.streakDays).toBe(0);
  });

  it('keeps the time that was focused', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(15 * MINUTE);

    timer.abandon();
    expect(timer.state().focusedMsToday).toBe(15 * MINUTE);
  });

  it('does not record a break as a session', () => {
    const { timer } = makeTimer({ workMin: 1, shortBreakMin: 5 });
    timer.start(0);
    timer.tick(1 * MINUTE); // work done, break running
    expect(timer.state().phase).toBe('shortBreak');

    const result = timer.abandon();
    expect(result.counts).toBe(false);
    expect(timer.serialize().sessions).toHaveLength(1); // only the completed work
  });
});

describe('FocusTimer configuration', () => {
  it('refuses a configuration that makes no sense', () => {
    const { timer } = makeTimer();
    const config = timer.setConfig({
      workMin: 0,
      shortBreakMin: -5,
      longBreakMin: Number.NaN,
      rounds: 0,
    });

    // The product limits are checked at the boundary; the domain only keeps
    // itself from breaking.
    expect(config.workMin).toBe(25);
    expect(config.shortBreakMin).toBe(5);
    expect(config.longBreakMin).toBe(15);
    expect(config.rounds).toBe(4);
  });

  it('accepts a short configuration, so a phase is never zero length', () => {
    const { timer } = makeTimer({ workMin: 1 });
    expect(timer.getConfig().workMin).toBe(1);
    expect(timer.state().phaseDurationMs).toBe(MINUTE);
  });

  it('a change during a session applies to the next phase', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.setConfig({ workMin: 50 });

    // The phase in progress keeps the length it started with.
    expect(timer.state().phaseDurationMs).toBe(25 * MINUTE);
    expect(timer.state().remainingMs).toBe(25 * MINUTE);

    timer.tick(25 * MINUTE); // work done, break starts
    timer.tick(30 * MINUTE); // break done, next work phase

    expect(timer.state().phase).toBe('work');
    expect(timer.state().phaseDurationMs).toBe(50 * MINUTE);
  });

  it('a change while idle applies straight away', () => {
    const { timer } = makeTimer();
    timer.setConfig({ workMin: 50 });

    expect(timer.state().remainingMs).toBe(50 * MINUTE);
    expect(timer.state().phaseDurationMs).toBe(50 * MINUTE);
  });
});

describe('FocusTimer persistence', () => {
  it('restores a session as paused, never running', () => {
    const { timer } = makeTimer({ workMin: 25 });
    timer.start(0);
    timer.tick(10 * MINUTE);

    const persisted = timer.serialize();
    expect(persisted.active?.status).toBe('running');

    const { timer: revived } = makeTimer();
    revived.restore(persisted);

    expect(revived.state().status).toBe('paused');
    expect(revived.state().pauseReason).toBe('recovered');
    expect(revived.state().remainingMs).toBe(15 * MINUTE);
  });

  it('round trips the aggregates', () => {
    const { timer } = makeTimer({ workMin: 1 });
    timer.start(0);
    timer.tick(1 * MINUTE);

    const { timer: revived } = makeTimer();
    revived.restore(timer.serialize());

    expect(revived.state().completedToday).toBe(1);
    expect(revived.state().streakDays).toBe(1);
  });

  it('ignores a rubbish payload', () => {
    const { timer } = makeTimer();

    timer.restore({});
    expect(timer.state().status).toBe('idle');

    timer.restore({
      config: { workMin: 9999 } as never,
      aggregates: { dayKey: 5, completedToday: 'lots' } as never,
      sessions: 'nope' as never,
    });

    expect(timer.state().completedToday).toBe(0);
    expect(timer.getConfig().workMin).toBe(1440);
  });
});

describe('previousDayKey', () => {
  it('handles the start of a month', () => {
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
  });

  it('handles the start of a year', () => {
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
  });

  it('handles a leap year', () => {
    expect(previousDayKey('2028-03-01')).toBe('2028-02-29');
  });

  it('handles an ordinary day', () => {
    expect(previousDayKey('2026-03-10')).toBe('2026-03-09');
  });
});
