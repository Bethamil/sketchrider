import type { Rider } from '../physics/rider';

const INK = '#2a2e36';
const PAPER = '#f8f3e7';
const ACCENT = '#c8402f';
const SCARF_LIGHT = '#e2705c';

/** Draw the sketchy figure + toboggan from the live physics points. */
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
  drawBody(ctx, rider, dx, dy, ux, uy);
  drawHead(ctx, rider, ux, uy);
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

function drawScarf(ctx: CanvasRenderingContext2D, rider: Rider): void {
  const sh = rider.points.shoulder;
  // Tapered two-tone scarf: light under-stroke, bold red over-stroke.
  for (const [color, w0, off] of [
    [SCARF_LIGHT, 4.2, 1.1],
    [ACCENT, 3.4, 0],
  ] as const) {
    let ax = sh.x;
    let ay = sh.y + off;
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
}

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

  // Runner with a big curled nose.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(t.x - dx * 3, t.y - dy * 3);
  ctx.lineTo(n.x, n.y);
  ctx.quadraticCurveTo(
    n.x + dx * 7.5,
    n.y + dy * 7.5,
    n.x + dx * 5 + ux * 9,
    n.y + dy * 5 + uy * 9,
  );
  ctx.stroke();

  // Red tip on the curl.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(n.x + dx * 7 + ux * 5, n.y + dy * 7 + uy * 5);
  ctx.lineTo(n.x + dx * 5 + ux * 9, n.y + dy * 5 + uy * 9);
  ctx.stroke();

  // Deck above the runner, with little struts.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(t.x + ux * 4.5 + dx * 1, t.y + uy * 4.5 + dy * 1);
  ctx.lineTo(n.x + ux * 4.5 - dx * 3, n.y + uy * 4.5 - dy * 3);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const f of [0.18, 0.5, 0.82]) {
    const bx = t.x + (n.x - t.x) * f;
    const by = t.y + (n.y - t.y) * f;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + ux * 4.5, by + uy * 4.5);
  }
  ctx.stroke();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  rider: Rider,
  dx: number,
  dy: number,
  ux: number,
  uy: number,
): void {
  const p = rider.points;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;

  // Leg with a bent knee (bulges toward the sled nose).
  const knee = jointBulge(p.hip, p.foot, dx, dy, 4.5);
  ctx.beginPath();
  ctx.moveTo(p.hip.x, p.hip.y);
  ctx.quadraticCurveTo(knee.x, knee.y, p.foot.x, p.foot.y);
  // Boot along the sled direction.
  ctx.lineTo(p.foot.x + dx * 6, p.foot.y + dy * 6);
  ctx.stroke();

  // Torso, bowed slightly backward for that leaned-in ride.
  ctx.beginPath();
  ctx.moveTo(p.hip.x, p.hip.y);
  ctx.quadraticCurveTo(
    (p.hip.x + p.shoulder.x) / 2 - dx * 2.5,
    (p.hip.y + p.shoulder.y) / 2 - dy * 2.5,
    p.shoulder.x,
    p.shoulder.y,
  );
  ctx.stroke();

  // Arm with a drooping elbow (bulges away from sled "up").
  const elbow = jointBulge(p.shoulder, p.hand, -ux, -uy, 3.5);
  ctx.beginPath();
  ctx.moveTo(p.shoulder.x, p.shoulder.y);
  ctx.quadraticCurveTo(elbow.x, elbow.y, p.hand.x, p.hand.y);
  ctx.stroke();

  // Red mitten gripping the rope.
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(p.hand.x, p.hand.y, 2.3, 0, Math.PI * 2);
  ctx.fill();
  // Tow rope from mitten to the sled nose curl.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.hand.x, p.hand.y);
  ctx.lineTo(p.nose.x + dx * 2 + ux * 6, p.nose.y + dy * 2 + uy * 6);
  ctx.stroke();
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

function drawHead(ctx: CanvasRenderingContext2D, rider: Rider, ux: number, uy: number): void {
  const p = rider.points;
  const h = p.head;

  ctx.beginPath();
  ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Beanie: a thick cap arc on top, with a red pom.
  const capAngle = Math.atan2(uy, ux);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 4.8, capAngle - 1.25, capAngle + 1.25);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(h.x + ux * 6.8, h.y + uy * 6.8, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eye looking forward.
  const fx = p.hand.x - h.x;
  const fy = p.hand.y - h.y;
  const fl = Math.hypot(fx, fy) || 1;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(h.x + (fx / fl) * 2.4, h.y + (fy / fl) * 1.4, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawDizzyStars(ctx: CanvasRenderingContext2D, rider: Rider): void {
  const h = rider.points.head;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [ox, oy, r] of [
    [-7, -9, 2.6],
    [4, -12, 2],
    [9, -5, 1.6],
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
