import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANCHORS, ART, ART_PALETTE } from './art-anchors';

const here = dirname(fileURLToPath(import.meta.url));
const artPath = join(here, '..', '..', 'assets', 'pet', 'mochi.svg');
const art = readFileSync(artPath, 'utf8');

/**
 * The class names the stylesheet reaches into. If one of these disappears the
 * animation quietly stops working, so they are checked here rather than found
 * out by wondering why the pet stopped breathing.
 */
const REQUIRED_CLASSES = [
  'pet-svg',
  'contact-shadow',
  'facing',
  'character',
  'tail-group',
  'tail-outline',
  'tail',
  'body',
  'belly',
  'scarf-back',
  'head',
  'ears',
  'ear-left',
  'ear-right',
  'inner-ear-left',
  'inner-ear-right',
  'head-shape',
  'face',
  'eye-open',
  'eye-left',
  'eye-right',
  'eye-closed',
  'mouth',
  'whiskers',
  'scarf',
  'scarf-band',
  'scarf-knot',
  'scarf-tail',
  'paws',
  'paw-left',
  'paw-right',
  'glasses',
  'zzz',
  'zzz-letter',
  'zzz-one',
  'zzz-two',
  'zzz-three',
  'sparkles',
  'sparkle-one',
  'sparkle-two',
  'sparkle-three',
  'sparkle-four',
  'sparkle-five',
];

describe('the artwork file', () => {
  it('is the size the artboard says it is', () => {
    expect(art).toContain(`viewBox="0 0 ${ART.width} ${ART.height}"`);
  });

  it('keeps every class the animations hook onto', () => {
    for (const className of REQUIRED_CLASSES) {
      expect(art, `the .${className} class is missing`).toContain(className);
    }
  });

  it('is drawn in the colours the design system says', () => {
    for (const [name, colour] of Object.entries(ART_PALETTE)) {
      expect(art, `${name} (${colour}) is not in the artwork`).toContain(colour);
    }
  });

  it('puts the contact shadow on the ground anchor', () => {
    expect(art).toContain(`cy="${ART.shadow}"`);
  });

  it('puts the eyes on the face anchor', () => {
    expect(art).toContain(`cy="${ANCHORS.faceAttach.y}"`);
  });

  it('ties the scarf at the knot anchor', () => {
    expect(art).toContain(`cx="${ANCHORS.scarfKnot.x}"`);
  });

  it('holds no text, because the design rules forbid it', () => {
    expect(art).not.toContain('<text');
  });

  it('stays inside the artboard', () => {
    // The furthest right anything reaches, plus the width of the tail's stroke.
    const widest = Math.max(...[...art.matchAll(/x="(\d+)"/g)].map((m) => Number(m[1])));
    expect(widest).toBeLessThanOrEqual(ART.width);
  });
});
