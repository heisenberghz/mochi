/**
 * The app icon: Mochi's head as a portrait, replayed from the sprite.
 *
 * The drawing is the same flat pixel cells as the production art (art
 * contract v2) — the head, the ears and the face, in the same order and the
 * same palette as `scripts/build-pixel-mochi.mjs`, the source of truth for
 * what Mochi looks like. Nothing is shaded or blurred: the icon is the
 * character, scaled onto a 256px canvas.
 *
 * Run: npm run icon
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 256;
const SS = 4;
const W = SIZE * SS;
const CELL = 8;

/** The palette: the same flat tokens as the sprite generator. */
const C = {
  ink: [38, 22, 15], // #26160F
  body: [247, 197, 133], // #F7C585
  light: [255, 233, 196], // #FFE9C4
  deep: [185, 126, 66], // #B97E42
  spark: [255, 247, 234], // #FFF7EA
  innerEar: [246, 144, 110], // #F6906E
  // Pre-blended mixes (the plotter overwrites rather than composites):
  blush: [246, 152, 113], // innerEar at 85% over the coat
  sparkSoft: [222, 213, 201], // spark at 85% over the ink eye
};

/**
 * The portrait's frame, in art units. The sprite's head — once its ink ring,
 * the ears and the whisker dots are counted — spans x 36..172 and y 0..128
 * (the ear tips' own ring cell is the top row). The frame squares that box
 * with a whisker of padding on every side.
 */
const FRAME = { x0: 34, y0: -6, size: 140 };
/** virtual (supersampled) pixels per art unit */
const VS = (SIZE / FRAME.size) * SS;

const pixels = new Uint8Array(W * W * 4);

function put(x, y, color) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = 255;
}

/** An art-unit rectangle — a whole cell, or a free-size detail. */
function fillArt(x0, y0, w, h, color) {
  const vx0 = Math.round((x0 - FRAME.x0) * VS);
  const vx1 = Math.round((x0 + w - FRAME.x0) * VS);
  const vy0 = Math.round((y0 - FRAME.y0) * VS);
  const vy1 = Math.round((y0 + h - FRAME.y0) * VS);
  for (let y = vy0; y < vy1; y++) for (let x = vx0; x < vx1; x++) put(x, y, color);
}

/** One grid cell; fractional coordinates allowed, as in the sprite. */
const at = (gx, gy, color) => fillArt(gx * CELL, gy * CELL, CELL, CELL, color);

// ------------------------------------------------------------- cell helpers
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

// ------------------------------------------------------- the head, replayed
// The same shapes the sprite generator computes: a wide round head with a
// flat top, ears welded onto it, the ink ring, and the toy face.

const headSet = insideEllipse(12.5, 9.6, 6.2, 5.2, 5, 20, 3, 15).filter(([, y]) => y >= 5);
const inHead = free(headSet);

// ears first (in the sprite they sit behind the head's ring)
const earL = [[8, 1], [7, 2], [8, 2], [9, 2], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3]];
const earR = [[16, 1], [15, 2], [16, 2], [17, 2], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3]];
for (const [x, y] of earL) at(x, y, C.body);
for (const [x, y] of earR) at(x, y, C.body);
/** the ink a part's own ring would paint, exactly as the generator does */
function earInk(ear) {
  for (const [x, y] of ear) {
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (free(ear)(nx, ny) && !inHead(nx, ny)) at(nx, ny, C.ink);
    }
  }
}
earInk(earL);
earInk(earR);
at(8, 2, C.innerEar); at(8, 3, C.innerEar); // inner ear, left
at(16, 2, C.innerEar); at(16, 3, C.innerEar); // inner ear, right

// head fill, ink ring, light band
for (const [x, y] of headSet) at(x, y, C.body);
for (const [x, y] of headSet) {
  for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
    if (inHead(nx, ny)) at(nx, ny, C.ink);
  }
}
for (const [x, y] of headSet) {
  if ((y === 5 && x <= 10) || (y === 6 && x === 9)) at(x, y, C.light);
}

// the toy face: two-cell glossy eyes with the catches cut into the ink
for (const cx of [9, 14]) {
  for (const [x, y] of [[cx, 9], [cx + 1, 9], [cx, 10], [cx + 1, 10]]) at(x, y, C.ink);
  fillArt(cx * CELL + 2, 9 * CELL + 2, 5, 4, C.spark); // the big catch
  fillArt((cx + 1) * CELL + 3, 10 * CELL + 5, 3, 3, C.sparkSoft); // the small one
}
at(8, 11, C.blush); at(17, 11, C.blush); // cheeks, tucked inside the ring
at(12, 11, C.ink); // nose
at(11, 12, C.ink); at(13, 12, C.ink); // the pixel M
// whisker dots, just off the silhouette, in the deep fur tone
for (const [x, y] of [[4.5, 10], [4.5, 11], [20.5, 10], [20.5, 11]]) at(x, y, C.deep);

// ------------------------------------------------- downsample and encode
const output = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
      }
    }
    const samples = SS * SS;
    const o = (y * SIZE + x) * 4;
    output[o] = Math.round(r / samples);
    output[o + 1] = Math.round(g / samples);
    output[o + 2] = Math.round(b / samples);
    output[o + 3] = 255;
  }
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0;
  output.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const resources = join(process.cwd(), 'resources');
mkdirSync(resources, { recursive: true });
const target = join(resources, 'icon.png');
writeFileSync(target, png);
console.log(`Wrote ${target} (${png.length} bytes)`);
