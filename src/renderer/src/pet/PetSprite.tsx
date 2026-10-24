import type { CSSProperties, RefObject } from 'react';
import { ANCHORS } from '../../../shared/art-anchors';
import { WALK_CYCLE_MS } from '../../../shared/constants';
import type { Emotion } from '../../../shared/emotion';
import type { Behavior } from '../../../shared/types';
import petArt from '../../../../assets/pet/mochi.svg?raw';

interface PetSpriteProps {
  behavior: Behavior;
  facing: -1 | 1;
  poked: boolean;
  interactive: boolean;
  /** The pet is settling after being put down. */
  settling: boolean;
  /** The pet's animation has stopped working, so it stands still. */
  animationPaused: boolean;
  /** Where the pet is looking, in degrees (-25 to 25). */
  lookAngle?: number;
  /** How the face should feel, from `emotionFor` in the shared thresholds. */
  emotion?: Emotion;
  /** The art itself, so it can be checked against the click target. */
  spriteRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The pet's artwork.
 *
 * It lives in `assets/pet/mochi.svg` so it can be opened in any drawing tool
 * and edited directly. It is injected rather than linked, because the
 * animations in `pet.css` reach inside it and a linked file would be sealed
 * off from them.
 */
export function PetSprite({
  behavior,
  facing,
  poked,
  interactive,
  settling,
  animationPaused,
  lookAngle,
  emotion,
  spriteRef,
}: PetSpriteProps) {
  const classes = [
    'pet-sprite',
    `behavior-${behavior}`,
    poked ? 'poked' : '',
    interactive ? 'interactive' : '',
    settling ? 'settling' : '',
    animationPaused ? 'paused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // The pet turns around the character anchor, which the stylesheet needs to
  // know about. The paw cycle is timed from the shared stride constant, so
  // the feet cover the ground the window glides.
  const style = {
    '--flip-origin': `${ANCHORS.character.x}px ${ANCHORS.character.y}px`,
    '--look-angle': `${lookAngle ?? 0}deg`,
    '--walk-cycle': `${WALK_CYCLE_MS}ms`,
  } as CSSProperties;

  return (
    <div
      className={classes}
      aria-hidden="true"
      ref={spriteRef}
      data-facing={facing}
      data-emotion={emotion}
      style={style}
      dangerouslySetInnerHTML={{ __html: petArt }}
    />
  );
}
