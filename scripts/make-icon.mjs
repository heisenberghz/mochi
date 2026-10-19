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
  scarf: [217, 137, 69],
  highlight: [255, 253, 248],
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

function roundRect(x0, y0, x1, y1, r, color) {
  for (let y = Math.floor(y0 * SS); y <= Math.ceil(y1 * SS); y += 1) {
    for (let x = Math.floor(x0 * SS); x <= Math.ceil(x1 * SS); x += 1) {
      const px = x / SS;
      const py = y / SS;
      const nx = Math.min(Math.max(px, x0 + r), x1 - r);
      const ny = Math.min(Math.max(py, y0 + r), y1 - r);
      if (Math.hypot(px - nx, py - ny) <= r) put(x, y, color);
    }
  }
}

// Tail (behind the body), drawn as a chain of circles.
for (let i = 0; i <= 20; i += 1) {
  const t = i / 20;
  const x = 188 + 26 * Math.sin(t * Math.PI * 0.85);
  const y = 166 + 34 * t;
  ellipse(x, y, 15, 15, colors.ink);
}
for (let i = 0; i <= 20; i += 1) {
  const t = i / 20;
  const x = 188 + 26 * Math.sin(t * Math.PI * 0.85);
  const y = 166 + 34 * t;
  ellipse(x, y, 11, 11, colors.cream);
}

// Ears.
triangle([96, 94], [76, 38], [124, 72], colors.ink);
triangle([160, 94], [180, 38], [132, 72], colors.ink);
triangle([99, 86], [85, 50], [117, 72], colors.cream);
triangle([157, 86], [171, 50], [139, 72], colors.cream);
triangle([99, 79], [91, 58], [109, 71], colors.innerEar);
triangle([157, 79], [165, 58], [147, 71], colors.innerEar);

// Body with a thin ink outline.
ellipse(128, 150, 84, 78, colors.ink);
ellipse(128, 150, 80, 74, colors.cream);
ellipse(128, 172, 54, 46, colors.shadow);

// Scarf.
roundRect(48, 162, 208, 184, 11, colors.ink);
roundRect(50, 164, 206, 182, 9, colors.scarf);
ellipse(196, 190, 14, 12, colors.scarf);
ellipse(208, 202, 10, 9, colors.shadow);

// Face.
ellipse(106, 140, 7, 9, colors.ink);
ellipse(150, 140, 7, 9, colors.ink);
ellipse(104, 137, 2.4, 2.8, colors.highlight);
ellipse(148, 137, 2.4, 2.8, colors.highlight);
triangle([128, 151], [123, 157], [133, 157], colors.ink);
ellipse(92, 156, 7, 4, colors.innerEar);
ellipse(164, 156, 7, 4, colors.innerEar);

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
