/**
 * Quiet hours: the minutes per day when a toast or a sound would be a bother.
 *
 * The window may run overnight — a start later than the end, like
 * 22:00 → 07:00, is the normal case and is handled rather than rejected.
 * A start equal to the end is a zero-length window, which is no window.
 */
export interface QuietHoursConfig {
  enabled: boolean;
  /** Minutes past midnight. */
  startMin: number;
  /** Minutes past midnight. */
  endMin: number;
}

/** True when `now` (minutes past midnight) falls inside the quiet window. */
export function isQuietMinute(minuteOfDay: number, config: QuietHoursConfig): boolean {
  if (!config.enabled) return false;

  const clean = (value: number): number =>
    Number.isFinite(value) ? Math.min(24 * 60, Math.max(0, Math.round(value))) : 0;
  const start = clean(config.startMin) % (24 * 60);
  const end = clean(config.endMin) % (24 * 60);
  const minute = clean(minuteOfDay) % (24 * 60);

  if (start === end) return false;
  if (start < end) return minute >= start && minute < end;
  // Overnight: quiet from `start` to midnight, and midnight to `end`.
  return minute >= start || minute < end;
}

/** Minutes since the last midnight, from a wall-clock instant. */
export function minuteOfDay(at: number): number {
  const date = new Date(at);
  return date.getHours() * 60 + date.getMinutes();
}

/** True when a toast or a sound should stay silent right now. */
export function isQuietHour(at: number, config: QuietHoursConfig): boolean {
  return isQuietMinute(minuteOfDay(at), config);
}
