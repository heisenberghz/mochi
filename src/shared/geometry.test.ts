import { describe, expect, it } from 'vitest';
import { PET_SCALES, PET_WINDOW } from './constants';
import {
  HIT_REGION_SVG,
  MAX_SPRITE_DRIFT_DIP,
  SPRITE_OFFSET,
  SPRITE_STAGE,
  SPRITE_VIEWBOX,
  hitRegionFor,
  isInsideHitRegion,
  petWindowSize,
  spriteOffsetDrift,
} from './geometry';

/**
 * The measured bounds of the art, in the art's own units, taken from the
 * cells in `assets/pet/mochi.svg`: the whisker dots run x 36–172, the tail's
 * ring touches x 200, the ear tips start at y 8 and the shadow ends at
 * y 216.
 */
const ART_BOUNDS = { left: 36, right: 200, top: 8, bottom: 216 };

describe('the sprite geometry', () => {
  it('derives where the art sits in the window', () => {
    expect(SPRITE_OFFSET.x).toBe(60);
    expect(SPRITE_OFFSET.y).toBe(134);
  });

  it('places the art at the bottom of the window, above the padding', () => {
    expect(SPRITE_OFFSET.y + SPRITE_STAGE.height).toBe(
      PET_WINDOW.height - SPRITE_STAGE.paddingBottom,
    );
  });

  it('matches the size the art is actually drawn at', () => {
    expect(SPRITE_STAGE.width).toBe(SPRITE_VIEWBOX.width);
    expect(SPRITE_STAGE.height).toBe(SPRITE_VIEWBOX.height);
  });
});

describe('the hit region', () => {
  it('covers the whole of the art', () => {
    const region = HIT_REGION_SVG.idle;

    expect(region.cx - region.rx).toBeLessThanOrEqual(ART_BOUNDS.left);
    expect(region.cx + region.rx).toBeGreaterThanOrEqual(ART_BOUNDS.right);
    expect(region.cy - region.ry).toBeLessThanOrEqual(ART_BOUNDS.top);
    expect(region.cy + region.ry).toBeGreaterThanOrEqual(ART_BOUNDS.bottom);
  });

  it('keeps the click target where it has always been', () => {
    // The region used to be typed in by hand. Deriving it must not move the
    // pet's click target.
    const region = hitRegionFor('idle');
    expect(region).toEqual({ cx: 160, cy: 246, rx: 100, ry: 104 });
  });

  it('follows the pet when it curls up to sleep', () => {
    const awake = hitRegionFor('idle');
    const asleep = hitRegionFor('sleep');

    expect(asleep.ry).toBeLessThan(awake.ry);
    expect(asleep.cy).toBeGreaterThan(awake.cy);
  });

  it('reaches further when the pet is celebrating', () => {
    const celebrating = hitRegionFor('celebrate');
    const idle = hitRegionFor('idle');

    expect(celebrating.rx).toBeGreaterThan(idle.rx);
  });

  it('knows a point inside the pet', () => {
    const region = hitRegionFor('idle');

    expect(isInsideHitRegion(region.cx, region.cy, 'idle', false)).toBe(true);
  });

  it('knows a point outside the pet', () => {
    const region = hitRegionFor('idle');

    expect(isInsideHitRegion(region.cx + region.rx + 20, region.cy, 'idle', false)).toBe(false);
    expect(isInsideHitRegion(0, 0, 'idle', false)).toBe(false);
  });

  it('grows the region when the cursor moves onto the pet', () => {
    const region = hitRegionFor('idle');
    const justOutside = region.cx + region.rx + 2;

    expect(isInsideHitRegion(justOutside, region.cy, 'idle', false)).toBe(false);
    expect(isInsideHitRegion(justOutside, region.cy, 'idle', true)).toBe(true);
  });

  it('uses the behaviour the pet is actually in', () => {
    const awake = hitRegionFor('idle');

    // A point that is inside the awake pet but outside the sleeping one.
    const topOfAwake = awake.cy - awake.ry + 4;

    expect(isInsideHitRegion(awake.cx, topOfAwake, 'idle', false)).toBe(true);
    expect(isInsideHitRegion(awake.cx, topOfAwake, 'sleep', false)).toBe(false);
  });
});

describe('the pet window at a scale', () => {
  it('grows the whole window layer by the scale', () => {
    expect(petWindowSize(1)).toEqual({ width: 320, height: 360 });
    expect(petWindowSize(0.75)).toEqual({ width: 240, height: 270 });
    expect(petWindowSize(1.25)).toEqual({ width: 400, height: 450 });
    expect(petWindowSize(1.5)).toEqual({ width: 480, height: 540 });
  });

  it('grows by the same factor as the art, so nothing collides', () => {
    // The bubble needs the window to have room above the pet; the walk needs
    // room below her. Both are fractions of the window, so they scale with it.
    for (const scale of PET_SCALES) {
      const size = petWindowSize(scale);
      expect(size.width).toBe(Math.round(PET_WINDOW.width * scale));
      expect(size.height).toBe(Math.round(PET_WINDOW.height * scale));
    }
  });

  it('keeps every scaled window size a whole number of pixels', () => {
    for (const scale of PET_SCALES) {
      const size = petWindowSize(scale);
      expect(Number.isInteger(size.width)).toBe(true);
      expect(Number.isInteger(size.height)).toBe(true);
    }
  });
});

describe('the drift guard', () => {
  it('reports no drift when the art is where it should be', () => {
    expect(spriteOffsetDrift({ left: SPRITE_OFFSET.x, top: SPRITE_OFFSET.y })).toBe(0);
  });

  it('reports how far the art has moved', () => {
    expect(spriteOffsetDrift({ left: SPRITE_OFFSET.x + 7, top: SPRITE_OFFSET.y })).toBe(7);
  });

  it('allows a small wobble', () => {
    const drift = spriteOffsetDrift({ left: SPRITE_OFFSET.x + 1, top: SPRITE_OFFSET.y });

    expect(drift).toBeLessThanOrEqual(MAX_SPRITE_DRIFT_DIP);
  });
});
