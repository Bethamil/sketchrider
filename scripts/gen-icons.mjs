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

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * The icon: graph-paper dots, a bold sketched swoop (with the faint offset
 * "double stroke" the game uses), and the scarfed rider on a sled.
 */
function drawIcon(size, scale = 1) {
  const { data, stamp } = makeCanvas(size);
  const s = (v) => size / 2 + (v - 0.5) * size * scale;

  // Background texture: faint grid dots over the full square, unscaled so
  // the maskable icon's safe-zone padding still looks like paper.
  const gridInk = mix(PAPER, INK, 0.13);
  for (let gx = 0.125; gx < 1; gx += 0.25) {
    for (let gy = 0.125; gy < 1; gy += 0.25) {
      stamp(gx * size, gy * size, size * 0.011, gridInk);
    }
  }

  const line = (x1, y1, x2, y2, rad, color) => {
    const steps = Math.max(2, Math.ceil((Math.hypot(x2 - x1, y2 - y1) / Math.max(1, rad)) * 3));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      stamp(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rad, color);
    }
  };

  // The swoop, with a thin offset ghost stroke for the pencil look.
  const p0 = [0.08, 0.3];
  const p1 = [0.5, 1.02];
  const p2 = [0.94, 0.34];
  const steps = 500;
  const ghost = mix(PAPER, INK, 0.32);
  for (let i = 0; i <= steps; i++) {
    const [x, y] = quadPoint(p0, p1, p2, i / steps);
    stamp(s(x + 0.012), s(y + 0.022), size * 0.011 * scale, ghost);
  }
  for (let i = 0; i <= steps; i++) {
    const [x, y] = quadPoint(p0, p1, p2, i / steps);
    stamp(s(x), s(y), size * 0.034 * scale, INK);
  }

  // Rider frame at t on the curve: tangent (dx, dy), upward normal (nx, ny).
  const t = 0.74;
  const [bx, by] = quadPoint(p0, p1, p2, t);
  const [ax, ay] = quadPoint(p0, p1, p2, t + 0.01);
  const dl = Math.hypot(ax - bx, ay - by) || 1;
  const dx = (ax - bx) / dl;
  const dy = (ay - by) / dl;
  const nx = dy;
  const ny = -dx;
  const at = (along, up) => [s(bx + dx * along + nx * up), s(by + dy * along + ny * up)];

  // Wind streaks trailing behind the rider, above the track.
  const streak = mix(PAPER, INK, 0.28);
  for (const [up, back, len] of [
    [0.19, -0.17, 0.13],
    [0.25, -0.15, 0.1],
  ]) {
    const [x1, y1] = at(back, up);
    const [x2, y2] = at(back - len, up + 0.012);
    line(x1, y1, x2, y2, size * 0.0075 * scale, streak);
  }

  // Sled runner: a short stretch of the curve itself, offset up along the
  // local normal so it hugs the track, ending in the red curled-nose tip.
  const sledUp = 0.064;
  for (let i = 0; i <= 48; i++) {
    const tt = 0.69 + 0.105 * (i / 48);
    const [x, y] = quadPoint(p0, p1, p2, tt);
    const tx = 2 * (1 - tt) * (p1[0] - p0[0]) + 2 * tt * (p2[0] - p1[0]);
    const ty = 2 * (1 - tt) * (p1[1] - p0[1]) + 2 * tt * (p2[1] - p1[1]);
    const tl = Math.hypot(tx, ty) || 1;
    stamp(s(x + (ty / tl) * sledUp), s(y - (tx / tl) * sledUp), size * 0.0125 * scale, INK);
  }
  const [cx, cy] = at(0.105, 0.1);
  stamp(cx, cy, size * 0.017 * scale, ACCENT);

  // Scarf streaming back, then the red body, ink head and beanie pom.
  const [q1x, q1y] = at(-0.065, 0.21);
  const [q2x, q2y] = at(-0.12, 0.2);
  stamp(q1x, q1y, size * 0.018 * scale, ACCENT);
  stamp(q2x, q2y, size * 0.013 * scale, ACCENT);
  const [bodyX, bodyY] = at(0, 0.138);
  stamp(bodyX, bodyY, size * 0.06 * scale, ACCENT);
  const [headX, headY] = at(0.04, 0.222);
  stamp(headX, headY, size * 0.036 * scale, INK);
  const [pomX, pomY] = at(0.05, 0.274);
  stamp(pomX, pomY, size * 0.016 * scale, ACCENT);

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
