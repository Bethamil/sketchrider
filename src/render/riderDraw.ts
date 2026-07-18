import type { Rider } from '../physics/rider';

const INK = '#2a2e36';
const ACCENT = '#c8402f';
const ACCENT_DARK = '#a83226';

/**
 * Draw the sledder in the logo's style: chunky red-jacketed body, big ink
 * head with a white goggle eye, red beanie with an ink pom, red scarf
 * streaming behind, dark mittens and boots, on an ink sled with a big
 * curled nose. Everything hangs off the live physics points, so the same
 * drawing ragdolls naturally on a crash.
 */
export function drawRider(ctx: CanvasRenderingContext2D, rider: Rider): void {
  const p = rider.points;
  const sdx = p.nose.x - p.tail.x;
  const sdy = p.nose.y - p.tail.y;
  const sl = Math.hypot(sdx, sdy) || 1;
  const dx = sdx / sl;
  const dy = sdy / sl;
  const ux = dy; // sled "up"
  const uy = -dx;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawSpeedStreaks(ctx, rider, dx, dy, ux, uy);
  drawScarf(ctx, rider);
  drawSled(ctx, rider, dx, dy, ux, uy);
  drawLegs(ctx, rider, dx, dy);
  drawBody(ctx, rider, dx, dy);
  drawArm(ctx, rider, dx, dy, ux, uy);
  drawHead(ctx, rider, dx, dy, ux, uy);
  if (rider.crashed) drawDizzyStars(ctx, rider);
}

function drawSpeedStreaks(
  ctx: CanvasRenderingContext2D,
  rider: Rider,
  dx: number,
  dy: number,
  ux: number,
  uy: number,
): void {
  const speed = Math.hypot(rider.velX, rider.velY);
  if (speed < 9 || rider.crashed) return;
  const t = rider.points.tail;
  const len = Math.min(30, speed * 2);
  ctx.strokeStyle = INK;
  ctx.globalAlpha = Math.min(0.3, (speed - 9) * 0.04);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const ox = t.x - dx * (8 + i * 6) + ux * (3 + i * 9);
    const oy = t.y - dy * (8 + i * 6) + uy * (3 + i * 9);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox - dx * len, oy - dy * len);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Red ribbon scarf with a darker under-edge and a little forked tip. */
function drawScarf(ctx: CanvasRenderingContext2D, rider: Rider): void {
  for (const [color, w0, off] of [
    [ACCENT_DARK, 4.8, 1.1],
    [ACCENT, 4, 0],
  ] as const) {
    let ax = rider.neckX;
    let ay = rider.neckY + off;
    ctx.strokeStyle = color;
    for (let i = 0; i < rider.scarf.length; i++) {
      const n = rider.scarf[i];
      ctx.lineWidth = w0 * (1 - i / (rider.scarf.length + 2));
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(n.x, n.y + off);
      ctx.stroke();
      ax = n.x;
      ay = n.y + off;
    }
  }
  // Forked tail on the last segment.
  const a = rider.scarf[rider.scarf.length - 2];
  const b = rider.scarf[rider.scarf.length - 1];
  let fx = b.x - a.x;
  let fy = b.y - a.y;
  const fl = Math.hypot(fx, fy) || 1;
  fx /= fl;
  fy /= fl;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x + fx * 3.4 - fy * 2, b.y + fy * 3.4 + fx * 2);
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x + fx * 3.4 + fy * 2, b.y + fy * 3.4 - fx * 2);
  ctx.stroke();
}

/** Ink sled: runner with a big curled nose, slatted deck on little struts. */
function drawSled(
  ctx: CanvasRenderingContext2D,
  rider: Rider,
  dx: number,
  dy: number,
  ux: number,
  uy: number,
): void {
  const t = rider.points.tail;
  const n = rider.points.nose;

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(t.x - dx * 4, t.y - dy * 4);
  ctx.lineTo(n.x, n.y);
  // Big curl: sweep forward-up, then hook back in on itself.
  ctx.quadraticCurveTo(
    n.x + dx * 9.5 + ux * 1.5,
    n.y + dy * 9.5 + uy * 1.5,
    n.x + dx * 7.5 + ux * 9.5,
    n.y + dy * 7.5 + uy * 9.5,
  );
  ctx.quadraticCurveTo(
    n.x + dx * 5 + ux * 13.5,
    n.y + dy * 5 + uy * 13.5,
    n.x + dx * 1.5 + ux * 11,
    n.y + dy * 1.5 + uy * 11,
  );
  ctx.stroke();

  // Deck above the runner, with little struts.
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(t.x + ux * 4.5 + dx * 1, t.y + uy * 4.5 + dy * 1);
  ctx.lineTo(n.x + ux * 4.5 - dx * 2, n.y + uy * 4.5 - dy * 2);
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (const f of [0.16, 0.5, 0.84]) {
    const bx = t.x + (n.x - t.x) * f;
    const by = t.y + (n.y - t.y) * f;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + ux * 4.5, by + uy * 4.5);
  }
  ctx.stroke();
}

/** Chunky tucked legs: ink thigh to the foot, boot along the sled. */
function drawLegs(ctx: CanvasRenderingContext2D, rider: Rider, dx: number, dy: number): void {
  const p = rider.points;
  const knee = jointBulge(p.hip, p.foot, dx, dy, 4.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(p.hip.x, p.hip.y);
  ctx.quadraticCurveTo(knee.x, knee.y, p.foot.x, p.foot.y);
  ctx.stroke();
  // Boot.
  ctx.lineWidth = 5.2;
  ctx.beginPath();
  ctx.moveTo(p.foot.x, p.foot.y);
  ctx.lineTo(p.foot.x + dx * 5, p.foot.y + dy * 5);
  ctx.stroke();
}

/** The chunky red jacket: a rounded egg between hip and shoulder. */
function drawBody(ctx: CanvasRenderingContext2D, rider: Rider, dx: number, dy: number): void {
  const p = rider.points;
  const cx = p.hip.x * 0.42 + p.shoulder.x * 0.58 + dx * 1.5;
  const cy = p.hip.y * 0.42 + p.shoulder.y * 0.58 + dy * 1.5;
  const rot = Math.atan2(p.shoulder.y - p.hip.y, p.shoulder.x - p.hip.x);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 11, 8.6, rot, 0, Math.PI * 2);
  ctx.fill();
  // Darker seam hinting at the jacket's front edge.
  ctx.strokeStyle = ACCENT_DARK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 11, 8.6, rot, -0.5, 1.25);
  ctx.stroke();
}

/** Ink arm reaching forward, a round mitten gripping the tow rope. */
function drawArm(
  ctx: CanvasRenderingContext2D,
  rider: Rider,
  dx: number,
  dy: number,
  ux: number,
  uy: number,
): void {
  const p = rider.points;

  // Tow rope from the mitten to the base of the sled's nose curl, with a
  // little sag — drawn first so the mitten grips over it.
  const nx = p.nose.x + dx * 4 + ux * 7;
  const ny = p.nose.y + dy * 4 + uy * 7;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.hand.x, p.hand.y);
  ctx.quadraticCurveTo(
    (p.hand.x + nx) / 2 - ux * 2.5,
    (p.hand.y + ny) / 2 - uy * 2.5,
    nx,
    ny,
  );
  ctx.stroke();

  const elbow = jointBulge(p.shoulder, p.hand, -ux, -uy, 4);
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(p.shoulder.x, p.shoulder.y);
  ctx.quadraticCurveTo(elbow.x, elbow.y, p.hand.x, p.hand.y);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(p.hand.x, p.hand.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Midpoint of a limb pushed perpendicular, on the side of (bx, by). */
function jointBulge(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bx: number,
  by: number,
  amount: number,
): { x: number; y: number } {
  let px = -(b.y - a.y);
  let py = b.x - a.x;
  const len = Math.hypot(px, py) || 1;
  px /= len;
  py /= len;
  if (px * bx + py * by < 0) {
    px = -px;
    py = -py;
  }
  return { x: (a.x + b.x) / 2 + px * amount, y: (a.y + b.y) / 2 + py * amount };
}

/** Big ink head with a white goggle eye, red beanie and ink pom. */
function drawHead(
  ctx: CanvasRenderingContext2D,
  rider: Rider,
  dx: number,
  dy: number,
  ux: number,
  uy: number,
): void {
  const p = rider.points;
  const h = p.head;
  const r = 7.4;

  // Head.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Beanie: red half-disc over the top, band edge, ink pom leaning back.
  const capAngle = Math.atan2(uy - dy * 0.12, ux - dx * 0.12);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(h.x + ux * 1.2, h.y + uy * 1.2, r + 0.8, capAngle - Math.PI * 0.52, capAngle + Math.PI * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ACCENT_DARK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(h.x + ux * 1.2, h.y + uy * 1.2, r + 0.8, capAngle - Math.PI * 0.52, capAngle + Math.PI * 0.52);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(
    h.x + ux * (r + 2.6) - dx * 1.8,
    h.y + uy * (r + 2.6) - dy * 1.8,
    3.2,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Goggle eye looking forward: white oval, ink pupil.
  const ex = h.x + dx * 3.2 - ux * 0.6;
  const ey = h.y + dy * 3.2 - uy * 0.6;
  const eyeRot = Math.atan2(dy, dx);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ex, ey, 3.4, 2.7, eyeRot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(ex + dx * 1.4, ey + dy * 1.4, 1.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawDizzyStars(ctx: CanvasRenderingContext2D, rider: Rider): void {
  const h = rider.points.head;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [ox, oy, r] of [
    [-9, -11, 2.6],
    [4, -14, 2],
    [11, -6, 1.6],
  ] as const) {
    ctx.moveTo(h.x + ox - r, h.y + oy);
    ctx.lineTo(h.x + ox + r, h.y + oy);
    ctx.moveTo(h.x + ox, h.y + oy - r);
    ctx.lineTo(h.x + ox, h.y + oy + r);
    ctx.moveTo(h.x + ox - r * 0.6, h.y + oy - r * 0.6);
    ctx.lineTo(h.x + ox + r * 0.6, h.y + oy + r * 0.6);
  }
  ctx.stroke();
}
