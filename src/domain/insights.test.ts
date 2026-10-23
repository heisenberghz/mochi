import { describe, expect, it } from 'vitest';
import type { FocusAggregates } from './focus-timer';
import { computeInsights, focusMsForDay, longestStreakDays, previousDayKey } from './insights';

function aggregates(overrides: Partial<FocusAggregates> = {}): FocusAggregates {
  return {
    dayKey: '2026-03-10',
    completedToday: 0,
    focusedMsToday: 0,
    focusedByDay: {},
    completedByDay: {},
    breakByDay: {},
    breaksByDay: {},
    streakDays: 0,
    lastCompletedDay: null,
    ...overrides,
  };
}

describe('previousDayKey', () => {
  it('walks back over midnight, months and leap days', () => {
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDayKey('2024-03-01')).toBe('2024-02-29');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
  });
});

describe('focusMsForDay', () => {
  it('subtracts break time from chair time', () => {
    const agg = aggregates({
      focusedByDay: { '2026-03-10': 50 * 60_000 },
      breakByDay: { '2026-03-10': 10 * 60_000 },
    });

    expect(focusMsForDay(agg, '2026-03-10')).toBe(40 * 60_000);
  });

  it('never reports a negative day because of a bad record', () => {
    const agg = aggregates({
      focusedByDay: { '2026-03-10': 10 },
      breakByDay: { '2026-03-10': 100 },
    });

    expect(focusMsForDay(agg, '2026-03-10')).toBe(0);
  });
});

describe('longestStreakDays', () => {
  it('is zero when nothing was ever completed', () => {
    expect(longestStreakDays(aggregates())).toBe(0);
  });

  it('counts a run of consecutive days', () => {
    const agg = aggregates({
      completedByDay: { '2026-03-01': 1, '2026-03-02': 2, '2026-03-03': 1, '2026-03-05': 1 },
    });

    expect(longestStreakDays(agg)).toBe(3);
  });

  it('finds the longest run, not the last one', () => {
    const agg = aggregates({
      completedByDay: {
        '2026-01-02': 1,
        '2026-01-03': 1,
        '2026-01-04': 1,
        '2026-01-05': 1,
        '2026-03-08': 1,
        '2026-03-09': 1,
      },
    });

    expect(longestStreakDays(agg)).toBe(4);
  });
});

describe('computeInsights', () => {
  it('shows an honest empty state when nothing has happened', () => {
    const view = computeInsights({ aggregates: aggregates(), sessions: [], today: '2026-03-10' });

    expect(view.empty).toBe(true);
    expect(view.week.focusedMs).toBe(0);
    expect(view.month.blocks).toBe(0);
    expect(view.recent).toEqual([]);
  });

  it('sums seven days and thirty days of focus time', () => {
    const hour = 60 * 60_000;
    const agg = aggregates({
      dayKey: '2026-03-10',
      completedToday: 2,
      focusedMsToday: 2 * hour,
      focusedByDay: {
        '2026-03-10': 2 * hour, // today
        '2026-03-08': hour, // this week
        '2026-02-20': 5 * hour, // this month, not this week
        '2026-01-15': hour, // not this month
      },
      completedByDay: {
        '2026-03-08': 1,
        '2026-03-09': 1,
        '2026-03-10': 2,
        '2026-02-20': 3,
      },
      streakDays: 3,
      lastCompletedDay: '2026-03-10',
    });

    const view = computeInsights({ aggregates: agg, sessions: [], today: '2026-03-10' });

    expect(view.week.focusedMs).toBe(3 * hour);
    expect(view.month.focusedMs).toBe(8 * hour);
    expect(view.week.blocks).toBe(4);
    expect(view.month.blocks).toBe(7);
    // The current streak comes straight from the aggregates.
    expect(view.streakDays).toBe(3);
    // 03-08, 03-09, 03-10 — three days in a row, longer than the lone 02-20.
    expect(view.longestStreakDays).toBe(3);
  });

  it('picks the best day in the range', () => {
    const hour = 60 * 60_000;
    const agg = aggregates({
      focusedByDay: { '2026-03-09': hour, '2026-03-10': 3 * hour, '2026-03-05': 2 * hour },
    });

    const view = computeInsights({ aggregates: agg, sessions: [], today: '2026-03-10' });

    expect(view.month.bestDay).toEqual({ dayKey: '2026-03-10', focusedMs: 3 * hour });
    expect(view.week.bestDay).toEqual({ dayKey: '2026-03-10', focusedMs: 3 * hour });
  });

  it('counts breaks, newest first, for the recent list', () => {
    const agg = aggregates({
      focusedByDay: { '2026-03-10': 30 * 60_000 },
      breakByDay: { '2026-03-10': 8 * 60_000 },
      breaksByDay: { '2026-03-10': 1 },
      focusedMsToday: 30 * 60_000,
    });
    const sessions = [
      { dayKey: '2026-03-10', phase: 'work' as const, focusedMs: 30 * 60_000, completed: true },
      { dayKey: '2026-03-10', phase: 'shortBreak' as const, focusedMs: 8 * 60_000, completed: true },
    ];

    const view = computeInsights({ aggregates: agg, sessions, today: '2026-03-10' });

    expect(view.week.breaks).toBe(1);
    expect(view.week.focusedMs).toBe(22 * 60_000); // chair 30 minus break 8
    expect(view.recent[0]?.phase).toBe('shortBreak');
    expect(view.recent[1]?.phase).toBe('work');
  });

  it('shows every day of the range, including quiet ones', () => {
    const agg = aggregates({ focusedByDay: { '2026-03-10': 1000 } });

    const view = computeInsights({ aggregates: agg, sessions: [], today: '2026-03-10' });

    expect(view.week.days).toHaveLength(7);
    expect(view.month.days).toHaveLength(30);
    // Oldest first, newest last.
    expect(view.week.days[0]?.dayKey).toBe('2026-03-04');
    expect(view.week.days[6]?.dayKey).toBe('2026-03-10');
  });
});
