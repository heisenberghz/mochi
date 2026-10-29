/**
 * Mochi, art contract v2 — the pixel sprite generator.
 *
 * This is the source of truth for what Mochi looks like: an 8px grid, a
 * one-cell ink outline ring, flat shading steps, big glossy eyes. Run it and
 * it writes `assets/pet/mochi.svg`; never draw on that SVG by hand — edit the
 * cells here and re-run, so the generated art and the code's anchors cannot
 * drift apart.
 *
 * Run from the repo root:
 *   node scripts/build-pixel-mochi.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET = join(HERE, '..', 'assets', 'pet', 'mochi.svg');
const CELL = 8;

const C = {
  ink: '#26160F',
  body: '#F7C585',
  light: '#FFE9C4',
  dark: '#DF9E5B',
  deep: '#B97E42',
  white: '#FFF7EA',
  blush: '#F6906E',
  mossL: '#7FA05E',
  mossD: '#5F8047',
  skyL: '#6FA0D8',
  skyD: '#4E7FB8',
  aurL: '#7EC8A9',
  aurD: '#9A7FD1',
  mug: '#E07A2B',
  bed: '#FFF6E6',
};

/** one output rect per call; class attribute is opt-in */
class Draw {
  constructor() { this.out = []; }
  /** adds a rect, optionally labelled with a css class */
  at(group, x, y, fill, opacity = 1, cls = '') {
    const clsAttr = cls ? ` class="${cls}"` : '';
    const opAttr = opacity === 1 ? '' : ` opacity="${opacity}"`;
    this.out.push({ group, text: `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${fill}"${opAttr}${clsAttr}/>` });
    return this;
  }
  rect(group, x0, y0, x1, y1, fill, opacity = 1, cls = '') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.at(group, x, y, fill, opacity, cls);
    return this;
  }
  /** a free-size rect in art pixels (for eye catches, mug frames, ...) */
  px(group, x, y, w, h, fill, opacity = 1, cls = '') {
    const clsAttr = cls ? ` class="${cls}"` : '';
    const opAttr = opacity === 1 ? '' : ` opacity="${opacity}"`;
    this.out.push({ group, text: `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opAttr}${clsAttr}/>` });
    return this;
  }
  /** all rect strings for one group, in insertion order */
  g(group) { return this.out.filter((o) => o.group === group).map((o) => o.text); }
  /** rect strings for every group that starts with the given prefix */
  gp(prefix) { return this.out.filter((o) => o.group.startsWith(prefix)).map((o) => o.text); }
}

const d = new Draw();

/** cells whose centre is inside an ellipse */
function insideEllipse(cx, cy, rx, ry, x0, x1, y0, y1) {
  const set = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) set.push([x, y]);
  }
  return set;
}
/** true when no cell of `set` exists at that spot */
const free = (set) => (x, y) => !set.some(([ax, ay]) => ax === x && ay === y);
/** ink ring cells just OUTSIDE a filled region. `isFree` answers "is this
 * cell empty?" — the ring is every still-empty cell that touches the region. */
function ringOf(set, isFree) {
  const seen = new Set();
  const out = [];
  for (const [x, y] of set) {
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const k = `${nx},${ny}`;
      if (!seen.has(k) && isFree(nx, ny)) { seen.add(k); out.push([nx, ny]); }
    }
  }
  return out;
}

// ------------------------------------------------------------------ ground
d.at('contact-shadow', 0, 0, 'transparent', 0); // keeps group ordering stable
for (let x = 5; x <= 18; x++) d.at('contact-shadow', x, 26, C.ink, 0.2);

// ------------------------------------------------------------------- body
const bodySet = insideEllipse(12.5, 19.8, 5.9, 5.35, 5, 20, 13, 25);
const inBody = free(bodySet);
for (const [x, y] of bodySet) {
  const shade = x >= 16 || y >= 23;
  d.at(shade ? 'body-shade' : 'body', x, y, shade ? C.dark : C.body);
}
for (const [x, y] of ringOf(bodySet, inBody)) d.at('body', x, y, C.ink);
for (const [x, y] of [[9, 15], [8, 16], [8, 17]]) d.at('body-rim', x, y, C.light, 1, 'body-rim');
// belly patch (no ring)
for (const [x, y] of insideEllipse(12.5, 20, 3.3, 2.5, 8, 17, 17, 23)) d.at('belly', x, y, C.light);

// ------------------------------------------------------------------- tail
// A fat curl (two cells thick, no inner pores) hugging the body's right ring
// at rows 18–20, tucked down beside her hip; pale tip at the curl's end.
// The fill carries both classes: the ink ring lives under the body's own
// ring, so one element speaks for the tail and its outline.
const tailSet = [
  [19, 18], [19, 19], [19, 20],
  [20, 16], [20, 17], [20, 18], [20, 19],
  [21, 16], [21, 17], [21, 18], [21, 19],
  [22, 16], [22, 17], [22, 18], [22, 19],
  [23, 17], [23, 18], [23, 19],
];
for (const [x, y] of tailSet) d.at('tail', x, y, C.body, 1, 'tail tail-outline');
for (const [x, y] of tailSet) {
  for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
    if (free(tailSet)(nx, ny) && !inBody(nx, ny)) d.at('tail-ring', nx, ny, C.ink);
  }
}
d.at('tail-tip', 23, 18, C.light);

// --------------------------------------------------------------- far paws
d.rect('paw far-l', 7, 24, 8, 25, C.dark, 0.9, 'paw paw-far-left');
d.rect('paw far-r', 16, 24, 17, 25, C.dark, 0.9, 'paw paw-far-right');

// ------------------------------------------------------------------- head
// A wide round head with a FLAT top (row 4 clip), so the ears weld onto a
// solid top edge instead of floating beside a narrow bump
const headSet = insideEllipse(12.5, 9.6, 6.2, 5.2, 5, 20, 3, 15).filter(([, y]) => y >= 5);
const inHead = free(headSet);
for (const [x, y] of headSet) d.at('head', x, y, C.body);
for (const [x, y] of ringOf(headSet, inHead)) d.at('head-ring', x, y, C.ink);
// light band hugging the top-left of the flat head
for (const [x, y] of headSet) {
  if ((y === 5 && x <= 10) || (y === 6 && x === 9)) d.at('head-rim', x, y, C.light);
}
// ears: slim triangles rising off the flat top edge; the head's own ring
// provides the base line, so only the outer edges get their ink
const earL = [[8, 1], [7, 2], [8, 2], [9, 2], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3]];
const earR = [[16, 1], [15, 2], [16, 2], [17, 2], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3]];
for (const [x, y] of earL) d.at('ear-l', x, y, C.body, 1, 'ear ear-left');
for (const [x, y] of earR) d.at('ear-r', x, y, C.body, 1, 'ear ear-right');
for (const [x, y] of earL) { for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
  if (free(earL)(nx, ny) && !inHead(nx, ny)) d.at('ear-l-ring', nx, ny, C.ink);
}}
for (const [x, y] of earR) { for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
  if (free(earR)(nx, ny) && !inHead(nx, ny)) d.at('ear-r-ring', nx, ny, C.ink);
}}
for (const [x, y] of [[8, 2], [8, 3]]) d.at('inner-ear-l', x, y, C.blush, 1, 'inner-ear inner-ear-left');
for (const [x, y] of [[16, 2], [16, 3]]) d.at('inner-ear-r', x, y, C.blush, 1, 'inner-ear inner-ear-right');

// ------------------------------------------------------------------- face
// Big glossy ink eyes at the real face anchors (rows 9–10), two cells wide
// like the screenshot pet's toy eyes, catches cut into the ink; blush on the
// cheeks; pixel nose + m-mouth; whisker dots just off the silhouette
for (const [cx, side] of [[9, 'left'], [14, 'right']]) {
  for (const [x, y] of [[cx, 9], [cx + 1, 9], [cx, 10], [cx + 1, 10]]) d.at(`eye-${side}`, x, y, C.ink);
  d.px(`eye-shine-${side}`, cx * CELL + 2, 9 * CELL + 2, 5, 4, C.white);
  d.px(`eye-shine-${side}`, (cx + 1) * CELL + 3, 10 * CELL + 5, 3, 3, C.white, 0.85);
}
d.at('blush-l', 7.5, 11, C.blush, 0.85);
d.at('blush-r', 17, 11, C.blush, 0.85);
d.at('nose', 12, 11, C.ink);
d.at('mouth-l', 11, 12, C.ink);
d.at('mouth-r', 13, 12, C.ink);
for (const [x, y] of [[4.5, 10], [4.5, 11], [20.5, 10], [20.5, 11]]) d.at('whisker', x, y, C.deep, 0.9, '');

// ------------------------------------------------------------------ paws
d.rect('pawfl', 9, 24, 10, 25, C.light, 1, 'paw paw-left');
d.rect('pawfr', 14, 24, 15, 25, C.light, 1, 'paw paw-right');
for (const [x, y] of [[10, 25], [15, 25]]) d.at('toe', x, y, C.deep, 0.9, '');

// ------------------------------------------------------------ accessories
// leaf hat at the head-top anchor
for (const [x, y] of [[12, 1], [11, 2], [12, 2], [13, 2]]) d.at('hat-a', x, y, C.mossL, 1, '');
for (const [x, y] of [[11, 3], [12, 3], [13, 3]]) d.at('hat-b', x, y, C.mossD, 1, '');
// mug at the paw anchor (153,174): a crisp orange box with an ink frame
d.px('mug-fill', 147, 169, 10, 10, C.mug);
d.px('mug', 145, 167, 14, 2, C.ink);
d.px('mug', 145, 179, 14, 2, C.ink);
d.px('mug', 145, 167, 2, 14, C.ink);
d.px('mug', 157, 167, 2, 14, C.ink);
d.px('mug-handle', 159, 170, 3, 7, C.ink);
d.at('mug-steam', 18, 18.6, C.white, 0.75);
// glasses: square pixel frames hugging each eye column + a bridge
for (const [ox, side] of [[0, 'l'], [5, 'r']]) {
  const F = (x, y) => d.at(`glass-frame-${side}`, ox + x, y, C.ink, 0.95, '');
  F(9, 8); F(10, 8);        // top bar
  F(9, 11); F(10, 11);      // bottom bar
  F(8.5, 9); F(8.5, 10);    // left post
  F(11, 9); F(11, 10);      // right post
}
for (const x of [11, 12, 13]) d.at('glass-bridge', x, 8, C.ink, 0.95, '');
// bed on the ground row
for (let x = 8; x <= 16; x++) d.at('bed-fill', x, 26, C.bed, 0.95, '');
d.at('bed-edge', 7, 26, C.ink, 0.95, ''); d.at('bed-edge', 17, 26, C.ink, 0.95, '');
d.rect('bed-edge', 8, 25, 9, 25, C.ink, 0.95, '');

// -------------------------------------------------------------- scarves
// back: the dark corners tucked behind the band's ends; band: the light
// wrapping; knot: the dark centre column at the knot anchor (cells 12×15/16);
// tail: the two hanging cells that swing under the knot
const scarfShapes = {
  back: [[8, 15], [8, 16], [16, 15], [16, 16]],
  band: [[9, 15], [10, 15], [11, 15], [13, 15], [14, 15], [15, 15], [9, 16], [10, 16], [11, 16], [14, 16], [15, 16]],
  knot: [[12, 15], [12, 16]],
  tail: [[13, 17], [12, 17]],
};
const scarves = [
  ['scarf-moss', C.mossL, C.mossD],
  ['scarf-sky', C.skyL, C.skyD],
  ['scarf-aurora', C.aurL, C.aurD],
];
for (const [cycle, light, dark] of scarves) {
  for (const [x, y] of scarfShapes.back) d.at(`sc-back-${cycle}`, x, y, dark, 1, '');
  for (const [x, y] of scarfShapes.band) d.at(`sc-band-${cycle}`, x, y, light, 1, '');
  for (const [x, y] of scarfShapes.knot) d.at(`sc-knot-${cycle}`, x, y, dark, 1, '');
  for (const [x, y] of scarfShapes.tail) d.at(`sc-tail-${cycle}`, x, y, light, 1, '');
}

// -------------------------------------------------------------- sleep curl
const curlSet = insideEllipse(12.5, 22.5, 6.0, 2.6, 6, 19, 20, 25);
const inCurl = free(curlSet);
for (const [x, y] of curlSet) d.at('curl', x, y, C.body, 1, '');
for (const [x, y] of ringOf(curlSet, inCurl)) d.at('curl-ring', x, y, C.ink);
const curlHeadSet = insideEllipse(6.9, 21.8, 2.6, 2.6, 4, 10, 19, 24);
const inCurlHead = free(curlHeadSet);
for (const [x, y] of curlHeadSet) d.at('curl-head', x, y, C.body, 1, '');
for (const [x, y] of ringOf(curlHeadSet, inCurlHead)) d.at('curl-head-ring', x, y, C.ink);
for (const [x, y] of [[5, 18], [6, 18], [5, 19]]) d.at('curl-ear-l', x, y, C.ink, 1, 'curl-ear curl-ear-left');
for (const [x, y] of [[8, 18], [7, 18], [9, 19]]) d.at('curl-ear-r', x, y, C.ink, 1, 'curl-ear curl-ear-right');
d.at('curl-eye-l', 5.5, 21.6, C.ink, 1, '');
d.at('curl-eye-r', 7.5, 21.6, C.ink, 1, '');
d.at('curl-nose', 6.5, 22.8, C.ink, 1, '');
for (const [x, y] of [[10, 25], [11, 25], [12, 25], [13, 25], [14, 25]]) d.at('curl-tail-front', x, y, C.dark, 1, '');
d.at('curl-tail-tip', 9, 25, C.light);

// ------------------------------------------------------------------ svg ---
/** a wrapper group around other groups' cells */
const wrap = (cls, inner = '') => `<g class="${cls}">${inner}</g>`;
const zPath = (ox, oy, s) => {
  const u = 4 * s;
  return `M ${ox} ${oy} h ${u * 2.5} l -${u * 1.75} ${u * 2} h ${u * 1.75} v ${u * 1.2} h -${u * 2.5} l ${u * 1.75} -${u * 2} h -${u * 1.75} Z`;
};
const svg = `<!--
  Mochi, art contract v2: the pixel sprite.
  This file is GENERATED by scripts/build-pixel-mochi.mjs — the cells are
  computed from the art anchors, so the drawing and the code cannot drift
  apart. To change a line: edit the generator, not this file, then re-run:
    node scripts/build-pixel-mochi.mjs
-->
<svg xmlns="http://www.w3.org/2000/svg" class="pet-svg" viewBox="0 0 200 220" width="200" height="220" shape-rendering="crispEdges">
<g class="facing"><g class="character">
${wrap('contact-shadow')}
<g class="accessory bed">${d.gp('bed').join('')}</g>
<g class="tail-group">${d.gp('tail').join('')}</g>
<g class="paw paw-far-left">${d.g('paw far-l').join('')}</g>
<g class="paw paw-far-right">${d.g('paw far-r').join('')}</g>
<g class="body">${d.g('body').join('')}${wrap('body-shade', d.g('body-shade').join(''))}${d.g('body-rim').join('')}${wrap('belly', d.g('belly').join(''))}</g>
<g class="accessory scarf scarf-moss">${wrap('scarf-back', d.gp('sc-back-scarf-moss').join(''))}${wrap('scarf-band', d.gp('sc-band-scarf-moss').join(''))}${wrap('scarf-knot', d.gp('sc-knot-scarf-moss').join(''))}${wrap('scarf-tail', d.gp('sc-tail-scarf-moss').join(''))}</g>
<g class="accessory scarf scarf-sky">${wrap('scarf-back', d.gp('sc-back-scarf-sky').join(''))}${wrap('scarf-band', d.gp('sc-band-scarf-sky').join(''))}${wrap('scarf-knot', d.gp('sc-knot-scarf-sky').join(''))}${wrap('scarf-tail', d.gp('sc-tail-scarf-sky').join(''))}</g>
<g class="accessory scarf scarf-aurora">${wrap('scarf-back', d.gp('sc-back-scarf-aurora').join(''))}${wrap('scarf-band', d.gp('sc-band-scarf-aurora').join(''))}${wrap('scarf-knot', d.gp('sc-knot-scarf-aurora').join(''))}${wrap('scarf-tail', d.gp('sc-tail-scarf-aurora').join(''))}</g>
<g class="head">
  <g class="ears">
    ${d.gp('ear-l').join('')}${d.g('inner-ear-l').join('')}
    ${d.gp('ear-r').join('')}${d.g('inner-ear-r').join('')}
  </g>
  <g class="head-shape">${d.g('head').join('')}${d.g('head-ring').join('')}${d.g('head-rim').join('')}</g>
  <g class="accessory leaf-hat">${d.gp('hat').join('')}</g>
</g>
<g class="face">
  ${wrap('eye-open eye-left', d.gp('eye-left').join('') + wrap('eye-bright', d.g('eye-shine-left').join('')))}
  ${wrap('eye-open eye-right', d.gp('eye-right').join('') + wrap('eye-bright', d.g('eye-shine-right').join('')))}
  <g class="eye-closed">
    <path d="M 72 78 Q 80 84 88 78" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M 112 78 Q 120 84 128 78" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  ${d.g('blush-l').join('')}${d.g('blush-r').join('')}
  ${wrap('mouth', d.g('nose').join('') + d.g('mouth-l').join('') + d.g('mouth-r').join(''))}
  <g class="whiskers">${d.g('whisker').join('')}</g>
</g>
<g class="paws">${d.g('pawfl').join('')}${d.g('pawfr').join('')}${d.g('toe').join('')}</g>
<g class="accessory mug">${d.gp('mug').join('')}</g>
<g class="glasses">${d.gp('glass').join('')}</g>
<g class="sleep-curl">
  ${wrap('curl-body', d.gp('curl-ring').join('') + d.g('curl').join(''))}
  <g class="curl-head">${d.gp('curl-ear').join('')}${d.g('curl-head-ring').join('')}${d.g('curl-head').join('')}${d.g('curl-eye-l').join('')}${d.g('curl-eye-r').join('')}${d.g('curl-nose').join('')}</g>
  ${wrap('curl-tail', d.gp('curl-tail').join(''))}
</g>
</g></g>
<g class="zzz">
  <path class="zzz-letter zzz-one" d="${zPath(146, 62, 0.75)}" fill="${C.ink}"/>
  <path class="zzz-letter zzz-two" d="${zPath(158, 44, 0.95)}" fill="${C.ink}"/>
  <path class="zzz-letter zzz-three" d="${zPath(172, 22, 1.15)}" fill="${C.ink}"/>
</g>
<g class="sparkles">
  <rect class="sparkle sparkle-one" x="45" y="73" width="6" height="6" fill="${C.white}"/>
  <rect class="sparkle sparkle-two" x="153" y="81" width="5" height="5" fill="${C.white}"/>
  <rect class="sparkle sparkle-three" x="39" y="124" width="4" height="4" fill="${C.white}"/>
  <rect class="sparkle sparkle-four" x="159" y="132" width="6" height="6" fill="${C.white}"/>
  <path class="sparkle sparkle-five" d="M 100 24 l 5 6 6 5 -6 5 -5 6 -5 -6 -6 -5 6 -5 Z" fill="${C.white}" transform="scale(0.55 0.55) translate(80 45)"/>
</g>
</svg>
`;

writeFileSync(ASSET, svg);
console.log('wrote', ASSET, d.out.length, 'cells');
