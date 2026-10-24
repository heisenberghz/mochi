import { describe, expect, it } from 'vitest';
import {
  WALK_CYCLE_MS,
  WALK_SPEED_DIP_PER_SECOND,
  WALK_STRIDE_DIP,
} from './constants';

describe('the walk cycle', () => {
  it('times the paw cycle from the stride and the walk speed', () => {
    expect(WALK_CYCLE_MS).toBe(
      Math.round((WALK_STRIDE_DIP / WALK_SPEED_DIP_PER_SECOND) * 1000),
    );
  });

  it('keeps the cycle in the range a step can be seen at', () => {
    // Much faster than this and the trot flickers; much slower and the
    // paws drag behind the gliding window.
    expect(WALK_CYCLE_MS).toBeGreaterThanOrEqual(600);
    expect(WALK_CYCLE_MS).toBeLessThanOrEqual(1400);
  });
});
