/**
 * The local calendar date of a wall-clock instant, as `YYYY-MM-DD`.
 *
 * Local, not UTC: a session that runs past midnight belongs to the day the
 * user was living in.
 */
export function localDateKey(wallMs: number): string {
  const date = new Date(wallMs);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
