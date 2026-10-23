import type { FocusPhase, InsightsRange, InsightsView } from '../shared/types';
import type { FocusAggregates, FocusSessionRecord } from './focus-timer';

/**
 * The day before the given one, as `YYYY-MM-DD`.
 *
 * The same arithmetic the timer uses for the streak, so both agree on what a
 * day is.
 */
export function previousDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map((part) => Number(part));
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** How many days before today the short range covers. */
export const INSIGHTS_WEEK_DAYS = 7;

/** How many days before today the long range covers. */
export const INSIGHTS_MONTH_DAYS = 30;

/** How many sessions the recent list shows. */
export const INSIGHTS_RECENT_COUNT = 8;

/**
 * The chair time minus the break time for a day.
 *
 * `focusedByDay` counts everything that passed while a session ran, breaks
 * included. The break totals are kept alongside it, so the minutes the Den
 * shows are focused minutes, not chair minutes.
 */
export function focusMsForDay(aggregates: FocusAggregates, dayKey: string): number {
  const chair = aggregates.focusedByDay[dayKey] ?? 0;
  const breaks = aggregates.breakByDay[dayKey] ?? 0;
  return Math.max(0, chair - breaks);
}

function dayKeysBefore(today: string, count: number): string[] {
  const days: string[] = [];
  let key = today;
  for (let index = 0; index < count; index += 1) {
    days.push(key);
    key = previousDayKey(key);
  }
  days.reverse();
  return days;
}

/**
 * The day-count history for a range, oldest day first.
 *
 * A day with nothing in it shows for what it is — a quiet day.
 */
function buildRange(
  length: number,
  today: string,
  aggregates: FocusAggregates,
): InsightsRange {
  const days = dayKeysBefore(today, length);

  let focusedMs = 0;
  let blocks = 0;
  let activeDays = 0;
  let bestDay: { dayKey: string; focusedMs: number } | null = null;

  const perDay = days.map((dayKey) => {
    const ms = focusMsForDay(aggregates, dayKey);
    focusedMs += ms;
    blocks += aggregates.completedByDay[dayKey] ?? 0;
    if (ms > 0) activeDays += 1;
    if (!bestDay || ms > bestDay.focusedMs) bestDay = { dayKey, focusedMs: ms };
    return { dayKey, focusedMs: ms };
  });

  const breaks = days
    .map((dayKey) => perDayBreaks(aggregates, dayKey))
    .reduce((sum, count) => sum + count, 0);

  return { focusedMs, blocks, breaks, activeDays, bestDay, days: perDay };
}

function perDayBreaks(aggregates: FocusAggregates, dayKey: string): number {
  return aggregates.breaksByDay[dayKey] ?? 0;
}

/**
 * The longest run of consecutive block-days ever recorded.
 *
 * Built from the per-day completion history, which goes back as far as the
 * daily totals do — a little over two years — so it survives restarts.
 */
export function longestStreakDays(aggregates: FocusAggregates): number {
  const days = Object.keys(aggregates.completedByDay)
    .filter((key) => (aggregates.completedByDay[key] ?? 0) > 0)
    .sort();

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && previousDayKey(day) === previous ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }
  return longest;
}

export interface InsightsInput {
  aggregates: FocusAggregates;
  sessions: FocusSessionRecord[];
  /** Today's local day key. */
  today: string;
}

/**
 * Everything the Insights tab shows, worked out from the history.
 *
 * Pure and cheap: it runs against the persisted aggregates, every call, so
 * the numbers can never disagree with the save file.
 */
export function computeInsights(input: InsightsInput): InsightsView {
  const { aggregates, sessions, today } = input;

  const week = buildRange(INSIGHTS_WEEK_DAYS, today, aggregates);
  const month = buildRange(INSIGHTS_MONTH_DAYS, today, aggregates);

  const recent = sessions
    .slice(-INSIGHTS_RECENT_COUNT)
    .reverse()
    .map((session) => ({
      dayKey: session.dayKey,
      phase: session.phase as FocusPhase,
      focusedMs: Math.max(0, Math.round(session.focusedMs)),
      completed: session.completed === true,
    }));

  return {
    week,
    month,
    streakDays: Math.max(0, Math.round(aggregates.streakDays)),
    longestStreakDays: longestStreakDays(aggregates),
    recent,
    empty: month.focusedMs === 0 && month.blocks === 0 && recent.length === 0,
  };
}
