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
  'accessory',
  'scarf-moss',
  'scarf-sky',
  'scarf-aurora',
  'paws',
  'paw-left',
  'paw-right',
  'paw-far-left',
  'paw-far-right',
  'sleep-curl',
  'curl-body',
  'curl-head',
  'curl-tail',
  'leaf-hat',
  'mug',
  'bed',
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
    // In the pixel art the shadow is the row of cells that starts at the
    // pet's feet, so its top edge is the ground line itself.
    expect(art).toContain(`y="${ART.ground}"`);
  });

  it('puts the eyes on the face anchor', () => {
    // The toy eyes are two cells wide, opening at either side of the face
    // line: the left eye's cells start at head.x - 28, the right's at
    // head.x + 12.
    expect(art).toContain(`x="${ANCHORS.head.x - 28}"`);
    expect(art).toContain(`x="${ANCHORS.head.x + 12}"`);
  });

  it('ties the scarf at the knot anchor', () => {
    // The knot is the dark centre column of the band: it starts one cell
    // left of centre, at the top of the band's two rows.
    expect(art).toContain(`y="${ANCHORS.scarfKnot.y - 8}"`);
  });

  it('holds no text, because the design rules forbid it', () => {
    expect(art).not.toContain('<text');
  });

  it('stays inside the artboard', () => {
    // The furthest right anything reaches, plus the width of the tail's ring.
    const widest = Math.max(...[...art.matchAll(/x="(\d+)"/g)].map((m) => Number(m[1])));
    expect(widest).toBeLessThanOrEqual(ART.width);
  });
});
