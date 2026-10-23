import { describe, expect, it } from 'vitest';
import { isQuietHour, isQuietMinute } from './quiet-hours';

/** 2026-03-10 — a Tuesday, so minutes-of-day are unambiguous. */
function at(hour: number, minute: number): number {
  return new Date(2026, 2, 10, hour, minute).getTime();
}

const overnight = { enabled: true, startMin: 22 * 60, endMin: 7 * 60 };

describe('isQuietMinute', () => {
  it('does not bother anyone when it is off', () => {
    expect(isQuietMinute(23 * 60, { ...overnight, enabled: false })).toBe(false);
  });

  it('is quiet late at night and early in the morning, but not mid-day', () => {
    expect(isQuietMinute(23 * 60, overnight)).toBe(true);
    expect(isQuietMinute(2 * 60, overnight)).toBe(true);
    expect(isQuietMinute(12 * 60, overnight)).toBe(false);
  });

  it('treats the boundary as quiet from the start minute, awake from the end minute', () => {
    expect(isQuietMinute(22 * 60, overnight)).toBe(true);
    expect(isQuietMinute(7 * 60, overnight)).toBe(false);
    expect(isQuietMinute(21 * 60 + 59, overnight)).toBe(false);
  });

  it('handles a window that does not cross midnight', () => {
    const siesta = { enabled: true, startMin: 14 * 60, endMin: 15 * 60 };
    expect(isQuietMinute(14 * 60, siesta)).toBe(true);
    expect(isQuietMinute(15 * 60, siesta)).toBe(false);
  });

  it('a zero-length window is never quiet', () => {
    expect(isQuietMinute(22 * 60, { enabled: true, startMin: 22 * 60, endMin: 22 * 60 })).toBe(
      false,
    );
  });

  it('clamps nonsense times instead of going strange', () => {
    expect(isQuietMinute(99 * 60, overnight)).toBe(true);
    expect(isQuietMinute(-5, overnight)).toBe(true);
  });
});

describe('isQuietHour', () => {
  it('reads a real instant', () => {
    const config = { enabled: true, startMin: 1320, endMin: 420 };
    expect(isQuietHour(at(22, 30), config)).toBe(true);
    expect(isQuietHour(at(6, 59), config)).toBe(true);
    expect(isQuietHour(at(9, 0), config)).toBe(false);
    expect(isQuietHour(at(10, 0), { ...config, enabled: false })).toBe(false);
  });
});
