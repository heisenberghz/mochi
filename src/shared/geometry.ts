import { HIT_HYSTERESIS, PET_WINDOW } from './constants';
import type { Behavior } from './types';

export interface HitRegion {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** The pet's art, in the art's own coordinate system. */
export const SPRITE_VIEWBOX = { width: 200, height: 220 } as const;

/** The box the art is drawn into, in window pixels. */
export const SPRITE_STAGE = { width: 200, height: 220, paddingBottom: 6 } as const;

/**
 * How far the art is allowed to drift from where the hit region expects it
 * before something is wrong.
 */
export const MAX_SPRITE_DRIFT_DIP = 4;

/** The speech bubble's box, in window pixels. */
export const BUBBLE_MAX_WIDTH = 272;
export const BUBBLE_MAX_HEIGHT = 96;
export const BUBBLE_TOP = 8;

/**
 * Where the speech bubble sits, in window pixels. It is centred under the
 * top of the window, and its height depends on how much there is to say.
 */
export const BUBBLE_REGION = {
  x: Math.round((PET_WINDOW.width - BUBBLE_MAX_WIDTH) / 2),
  y: BUBBLE_TOP,
  width: BUBBLE_MAX_WIDTH,
  height: BUBBLE_MAX_HEIGHT,
};

/** The body, as the art draws it.
 *
 * Taken from the pixel sprite's silhouette: the whisker dots reach x 36–172,
 * the tail's ring touches the right artboard edge, the ear tips start at y 8
 * and the contact shadow ends at y 216. A circle of rx 100 around x 100 is
 * the smallest one that covers x 0–200, and ry 104 covers y 8–216. */
const BODY: HitRegion = { cx: 100, cy: 112, rx: 100, ry: 104 };

/**
 * The region that counts as the pet, per behaviour, in the art's own units.
 *
 * The pet's shape changes — it curls up to sleep, hangs when it is carried,
 * and grows sparkles when it celebrates — so the clickable area follows it.
 */
export const HIT_REGION_SVG: Record<Behavior, HitRegion> = {
  idle: BODY,
  walk: BODY,
  wake: BODY,
  wave: BODY,
  // The small things the pet does of its own.
  lookLeft: BODY,
  lookRight: BODY,
  earFlick: BODY,
  stretch: BODY,
  yawn: BODY,
  // The glasses reach a little past the face.
  focus: { cx: 100, cy: 112, rx: 102, ry: 104 },
  // The sparkles reach further still, and the body lifts as it springs.
  celebrate: { cx: 100, cy: 110, rx: 104, ry: 106 },
  // Curled up, it is lower and smaller: x 24–168, y 152–208.
  sleep: { cx: 100, cy: 160, rx: 84, ry: 64 },
  // Hanging by the scruff, it swings about the head top.
  drag: { cx: 100, cy: 104, rx: 84, ry: 112 },
};

/**
 * Where the art sits inside the pet window, in window pixels.
 *
 * Derived from the stage rather than typed in, so the art and the hit region
 * cannot drift apart by accident.
 */
export const SPRITE_OFFSET = {
  x: Math.round((PET_WINDOW.width - SPRITE_STAGE.width) / 2),
  y: Math.round(PET_WINDOW.height - SPRITE_STAGE.paddingBottom - SPRITE_STAGE.height),
};

/** The clickable region for a behaviour, in window pixels. */
export function hitRegionFor(behavior: Behavior): HitRegion {
  const region = HIT_REGION_SVG[behavior];
  return {
    cx: SPRITE_OFFSET.x + region.cx,
    cy: SPRITE_OFFSET.y + region.cy,
    rx: region.rx,
    ry: region.ry,
  };
}

/**
 * Is a point inside the pet?
 *
 * Entering uses a slightly larger region than leaving does, so the pet does
 * not flicker when the cursor sits exactly on its edge.
 */
export function isInsideHitRegion(
  x: number,
  y: number,
  behavior: Behavior,
  expanded: boolean,
): boolean {
  const region = hitRegionFor(behavior);
  const rx = region.rx + (expanded ? HIT_HYSTERESIS : 0);
  const ry = region.ry + (expanded ? HIT_HYSTERESIS : 0);

  const nx = (x - region.cx) / rx;
  const ny = (y - region.cy) / ry;
  return nx * nx + ny * ny <= 1;
}

/**
 * How far the art has moved from where the hit region expects it.
 *
 * A non-zero value means the CSS and the art have drifted apart, and the
 * clickable area no longer matches what the user sees.
 */
export function spriteOffsetDrift(measured: { left: number; top: number }): number {
  return Math.max(
    Math.abs(measured.left - SPRITE_OFFSET.x),
    Math.abs(measured.top - SPRITE_OFFSET.y),
  );
}
