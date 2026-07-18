// Generates the PWA icons (PNG) without any dependencies: raw RGBA pixels,
// deflated with node's zlib, wrapped in hand-built PNG chunks.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const PAPER = [248, 243, 231];
const INK = [42, 46, 54];
const ACCENT = [200, 64, 47];

// ---- minimal PNG encoder --------------------------------------------------

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- tiny raster canvas ---------------------------------------------------

function makeCanvas(size) {
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = PAPER[0];
    data[i * 4 + 1] = PAPER[1];
    data[i * 4 + 2] = PAPER[2];
    data[i * 4 + 3] = 255;
  }
  const stamp = (cx, cy, rad, [r, g, b]) => {
    const x0 = Math.max(0, Math.floor(cx - rad - 1));
    const x1 = Math.min(size - 1, Math.ceil(cx + rad + 1));
    const y0 = Math.max(0, Math.floor(cy - rad - 1));
    const y1 = Math.min(size - 1, Math.ceil(cy + rad + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const a = Math.min(1, Math.max(0, rad - d + 0.5)); // 1px soft edge
        if (a <= 0) continue;
        const i = (y * size + x) * 4;
        data[i] = data[i] * (1 - a) + r * a;
        data[i + 1] = data[i + 1] * (1 - a) + g * a;
        data[i + 2] = data[i + 2] * (1 - a) + b * a;
      }
    }
  };
  return { data, stamp };
}

function quadPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

/** The icon: a sketched swoop of track with the red rider dot on top. */
function drawIcon(size, scale = 1) {
  const { data, stamp } = makeCanvas(size);
  const s = (v) => size / 2 + (v - 0.5) * size * scale;
  const p0 = [0.14, 0.38];
  const p1 = [0.5, 0.98];
  const p2 = [0.9, 0.42];
  const thickness = size * 0.032 * scale;
  const steps = 400;
  for (let i = 0; i <= steps; i++) {
    const [x, y] = quadPoint(p0, p1, p2, i / steps);
    stamp(s(x), s(y), thickness, INK);
  }
  // rider: red body dot + small ink head, sitting on the curve at t=0.78
  const t = 0.78;
  const [bx, by] = quadPoint(p0, p1, p2, t);
  const [ax, ay] = quadPoint(p0, p1, p2, t + 0.01);
  const dl = Math.hypot(ax - bx, ay - by) || 1;
  const nx = (ay - by) / dl;
  const ny = -(ax - bx) / dl;
  const lift = 0.075 * scale;
  stamp(s(bx + nx * lift), s(by + ny * lift), size * 0.062 * scale, ACCENT);
  stamp(s(bx + nx * lift * 1.9), s(by + ny * lift * 1.9), size * 0.034 * scale, INK);
  return data;
}

mkdirSync(OUT, { recursive: true });
const targets = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.72],
  ['apple-touch-icon.png', 180, 0.94],
];
for (const [name, size, scale] of targets) {
  writeFileSync(join(OUT, name), encodePNG(size, drawIcon(size, scale)));
}
console.log(`icons: wrote ${targets.length} PNGs to public/icons/`);
