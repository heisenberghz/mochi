import { describe, expect, it } from 'vitest';
import { ANCHORS, ART, ART_LAYERS, ART_PALETTE } from './art-anchors';

describe('the art anchors', () => {
  it('uses an artboard the window can hold', () => {
    expect(ART.width).toBe(200);
    expect(ART.height).toBe(220);
  });

  it('puts the head above the body', () => {
    expect(ANCHORS.head.y).toBeLessThan(ANCHORS.body.y);
  });

  it('puts the neck between the head and the body', () => {
    expect(ANCHORS.scarfKnot.y).toBeGreaterThan(ANCHORS.head.y);
    expect(ANCHORS.scarfKnot.y).toBeLessThan(ANCHORS.body.y);
  });

  it('puts the ground below the body', () => {
    expect(ART.ground).toBeGreaterThan(ANCHORS.body.y);
  });

  it('puts the contact shadow on the ground', () => {
    expect(ART.shadow).toBe(ART.ground + 4);
  });

  it('leaves room above the head for a hat', () => {
    expect(ANCHORS.headAttach.y).toBeLessThan(ANCHORS.head.y);
    expect(ANCHORS.headAttach.y).toBeGreaterThan(0);
  });

  it('puts the glasses on the face, at the eye line', () => {
    expect(ANCHORS.faceAttach.x).toBe(ANCHORS.head.x);
    expect(ANCHORS.faceAttach.y).toBe(ANCHORS.head.y - 2);
  });

  it('puts the mug to the right, in the right paw', () => {
    expect(ANCHORS.pawAttach.x).toBeGreaterThan(ART.centreX);
    expect(ANCHORS.pawAttach.y).toBeGreaterThan(ANCHORS.body.y);
  });

  it('puts the tail to the right of the character', () => {
    expect(ANCHORS.tailRoot.x).toBeGreaterThan(ART.centreX);
  });

  it('puts the bed on the ground', () => {
    expect(ANCHORS.groundAttach.y).toBe(ART.shadow);
  });

  it('keeps every anchor inside the artboard', () => {
    for (const [name, point] of Object.entries(ANCHORS)) {
      if (typeof point === 'number') continue;
      expect(point.x, `${name} is off the left of the artboard`).toBeGreaterThanOrEqual(0);
      expect(point.x, `${name} is off the right of the artboard`).toBeLessThanOrEqual(ART.width);
      expect(point.y, `${name} is off the top of the artboard`).toBeGreaterThanOrEqual(0);
      expect(point.y, `${name} is off the bottom of the artboard`).toBeLessThanOrEqual(ART.height);
    }
  });
});

describe('the art palette', () => {
  it('is drawn from the design system', () => {
    expect(ART_PALETTE.body).toBe('#F3E7D6');
    expect(ART_PALETTE.shadow).toBe('#E4D2BB');
    expect(ART_PALETTE.innerEar).toBe('#E8B7A6');
    expect(ART_PALETTE.scarf).toBe('#E9A15C');
    expect(ART_PALETTE.ink).toBe('#2A2622');
  });

  it('is all the same colour of hex', () => {
    for (const [name, colour] of Object.entries(ART_PALETTE)) {
      expect(colour, `${name} is not a hex colour`).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('the art layers', () => {
  it('draws the tail behind the body and the accessories in front', () => {
    expect(ART_LAYERS.indexOf('tail')).toBeLessThan(ART_LAYERS.indexOf('body'));
    expect(ART_LAYERS.indexOf('body')).toBeLessThan(ART_LAYERS.indexOf('head'));
    expect(ART_LAYERS.indexOf('head')).toBeLessThan(ART_LAYERS.indexOf('face'));
    expect(ART_LAYERS.indexOf('face')).toBeLessThan(ART_LAYERS.indexOf('accessory'));
  });
});
