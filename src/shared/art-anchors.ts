/**
 * Where everything is in the pet's art.
 *
 * This is the contract between the drawing and the code. The drawing hits
 * these numbers, and the code reads them, so the two cannot quietly drift
 * apart — which is exactly what happened to the old hand-written hit region.
 */

/** The artboard, in the art's own units. */
export const ART = {
  width: 200,
  height: 220,
  /** Where the pet's feet touch the ground. */
  ground: 212,
  /** Where the contact shadow sits. */
  shadow: 216,
  /** The character turns around this line. */
  centreX: 100,
} as const;

/**
 * The attachment points.
 *
 * Everything that can be added to the pet hangs off one of these, so a hat
 * always sits on the head and a mug always sits in the paw.
 */
export const ANCHORS = {
  /** The character's centre. */
  character: { x: 100, y: 140 },
  /** The head's centre, where the eyes are. */
  head: { x: 100, y: 78 },
  /** The body's centre, where the belly is. */
  body: { x: 100, y: 158 },
  /** The neck, where the scarf knot sits. */
  scarfKnot: { x: 100, y: 120 },
  /** The top of the head, where a hat would sit. */
  headAttach: { x: 100, y: 44 },
  /** The middle of the face, where glasses sit. */
  faceAttach: { x: 100, y: 76 },
  /** The right paw, where a mug would sit. */
  pawAttach: { x: 146, y: 176 },
  /** The ground, where a bed would sit. */
  groundAttach: { x: 100, y: 216 },
  /** Where the tail leaves the body. */
  tailRoot: { x: 156, y: 160 },
  /** The tip of the ears. */
  earTip: 34,
} as const;

/**
 * The colours the art is drawn in.
 *
 * These come from the design system's art palette, so the pet and the Den
 * are made of the same family of colours. The soft-real rule is that every
 * tone is derived from one of these — shading is a gradient between them,
 * never a new hue.
 */
export const ART_PALETTE = {
  body: '#F3E7D6',
  bodyLight: '#FBF3E6',
  /** The deep fur tone: paw pads, whiskers, the shading under the head. */
  furDeep: '#CBB69C',
  shadow: '#E4D2BB',
  innerEar: '#E8B7A6',
  ink: '#2A2622',
  highlight: '#FFFDF8',
  /** The leaf hat and the moss scarf. */
  moss: '#8FAE7C',
  /** The sky scarf. */
  sky: '#7FA3C7',
  /** The aurora scarf, at both ends of its wash. */
  auroraLight: '#7EC8A9',
  auroraDark: '#9A7FD1',
  /** A small warmth the pet earned: the mug. */
  warmAccent: '#D98C45',
} as const;

/**
 * The order the art is drawn in.
 *
 * The tail is behind the body, the scarf has a piece in front of the body and
 * a piece behind it, and the accessories sit on top of everything.
 */
export const ART_LAYERS = [
  'ground',
  'tail',
  'body',
  'scarfBack',
  'head',
  'face',
  'scarfFront',
  'accessory',
  'effects',
  'outline',
] as const;

export type ArtLayer = (typeof ART_LAYERS)[number];
