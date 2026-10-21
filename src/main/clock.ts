import type { FocusClock } from '../domain/focus-timer';
import { localDateKey } from '../shared/dates';

/**
 * The clock the focus timer runs on.
 *
 * `performance.now()` is monotonic: it never goes backwards and is not
 * affected by the user changing the system clock. `performance.timeOrigin` is
 * the wall-clock instant that the monotonic timeline started at, so adding the
 * two gives the wall-clock time of any monotonic instant — which is how a
 * moment on the monotonic timeline is turned into a calendar date.
 */
export const systemFocusClock: FocusClock = {
  localDateKeyAt(monotonicMs: number): string {
    return localDateKey(performance.timeOrigin + monotonicMs);
  },
};

/** The monotonic clock, in milliseconds. */
export function monotonicNow(): number {
  return performance.now();
}
