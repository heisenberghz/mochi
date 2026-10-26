import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 256;
const SS = 4;
const W = SIZE * SS;

const pixels = new Uint8Array(W * W * 4);

const colors = {
  ink: [42, 38, 34],
  cream: [243, 231, 214],
  shadow: [228, 210, 187],
  innerEar: [232, 183, 166],
  // Cheeks sit at 55% opacity in the art; pre-blended over the cream here,
  // because the pixel plotter overwrites rather than composites.
  blush: [234, 197, 180],
  deep: [203, 182, 156],
  highlight: [255, 253, 248],
  // The small eye sparkle is 85% white over the ink eye.
  sparkle: [223, 223, 225],
};

function put(x, y, color, alpha = 255) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = alpha;
}

function ellipse(cx, cy, rx, ry, color) {
  const x0 = Math.floor((cx - rx) * SS);
  const x1 = Math.ceil((cx + rx) * SS);
  const y0 = Math.floor((cy - ry) * SS);
  const y1 = Math.ceil((cy + ry) * SS);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const nx = (x / SS - cx) / rx;
      const ny = (y / SS - cy) / ry;
      if (nx * nx + ny * ny <= 1) put(x, y, color);
    }
  }
}

function triangle(a, b, c, color) {
  const minX = Math.floor(Math.min(a[0], b[0], c[0]) * SS);
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]) * SS);
  const minY = Math.floor(Math.min(a[1], b[1], c[1]) * SS);
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]) * SS);
  const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const p = [x / SS, y / SS];
      const d1 = sign(p, a, b);
      const d2 = sign(p, b, c);
      const d3 = sign(p, c, a);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(hasNeg && hasPos)) put(x, y, color);
    }
  }
}

// The icon is a portrait: the head fills the frame, because that is what
// still reads at 16px. Geometry mirrors mochi.svg — head 53..147 x 40..116,
// shifted onto the 256 canvas through the mapping in each block below.

// Ears behind the head: cream triangles with pink inners that peek out.
triangle([74, 26], [120, 62], [56, 90], colors.cream);
triangle([182, 26], [136, 62], [200, 90], colors.cream);

// Head with a thin ink ring, so the cream reads on light docks.
ellipse(128, 104, 79, 65, colors.ink);
ellipse(128, 104, 75, 61, colors.cream);

// Inner ears, staying above the head's edge so they read as ear lining.
triangle([78, 36], [68, 58], [102, 50], colors.innerEar);
triangle([178, 36], [188, 58], [154, 50], colors.innerEar);

// Glossy eyes: ink ovals, a big top-left highlight and a small one below.
ellipse(96, 100.6, 11.2, 14.4, colors.ink);
ellipse(160, 100.6, 11.2, 14.4, colors.ink);
ellipse(92, 95, 4.8, 5.1, colors.highlight);
ellipse(156, 95, 4.8, 5.1, colors.highlight);
ellipse(100.5, 106.4, 2.1, 2.1, colors.sparkle);
ellipse(164.5, 106.4, 2.1, 2.1, colors.sparkle);

// Cheeks and the smile (the w-mouth simplified for icon scale).
ellipse(83.2, 118.2, 10.4, 5.8, colors.blush);
ellipse(172.8, 118.2, 10.4, 5.8, colors.blush);
ellipse(128, 133, 10.5, 2.3, colors.ink);

// The nose: the wide-top triangle from the art.
triangle([120, 115], [136, 115], [128.8, 124], colors.ink);

// Whiskers, in the deep fur tone, thin as wedges.
triangle([73.6, 109.5], [73.6, 110.9], [48, 103.8], colors.deep);
triangle([73.6, 117.5], [73.6, 118.9], [48, 118.2], colors.deep);
triangle([180.8, 109.5], [180.8, 110.9], [206, 103.8], colors.deep);
triangle([180.8, 117.5], [180.8, 118.9], [206, 118.2], colors.deep);

// Downsample with alpha-weighted colour so edges stay clean.
const output = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        const alpha = pixels[i + 3];
        r += pixels[i] * alpha;
        g += pixels[i + 1] * alpha;
        b += pixels[i + 2] * alpha;
        a += alpha;
      }
    }
    const o = (y * SIZE + x) * 4;
    if (a === 0) {
      output[o] = 0;
      output[o + 1] = 0;
      output[o + 2] = 0;
      output[o + 3] = 0;
    } else {
      output[o] = Math.round(r / a);
      output[o + 1] = Math.round(g / a);
      output[o + 2] = Math.round(b / a);
      output[o + 3] = Math.round(a / (SS * SS));
    }
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
