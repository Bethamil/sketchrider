import { mulberry32 } from '../core/math';
import type { TrackLine } from '../lines/store';

/** Anything path segments can be appended to: a live 2D context or a cached Path2D. */
export type PathSink = Pick<CanvasRenderingContext2D, 'moveTo' | 'lineTo' | 'quadraticCurveTo'>;

/**
 * Hand-drawn stroke helpers. Every line is rendered as a slightly bowed
 * quadratic with jittered, overshooting endpoints — jitter is seeded per
 * line id so the sketch is stable frame to frame.
 */
export function addSketchStroke(
  ctx: PathSink,
  l: TrackLine,
  wobble = 1,
  seedOffset = 0,
): void {
  const rng = mulberry32(l.id * 7349 + seedOffset * 131);
  const j = () => (rng() - 0.5) * 1.5 * wobble;
  const over = Math.min(3, l.len * 0.12);
  const ax = l.x1 - l.dx * over + j();
  const ay = l.y1 - l.dy * over + j();
  const bx = l.x2 + l.dx * over + j();
  const by = l.y2 + l.dy * over + j();
  const bow = (rng() - 0.5) * Math.min(4, l.len * 0.09) * wobble;
  const mx = (ax + bx) / 2 + l.nx * bow;
  const my = (ay + by) / 2 + l.ny * bow;
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mx, my, bx, by);
}

/** Direction arrows drawn along boost lines. */
export function addChevrons(ctx: PathSink, l: TrackLine): void {
  const spacing = 26;
  const size = 4.5;
  const count = Math.max(1, Math.floor(l.len / spacing));
  for (let i = 1; i <= count; i++) {
    const t = (l.len * i) / (count + 1);
    const cx = l.x1 + l.dx * t + l.nx * 4;
    const cy = l.y1 + l.dy * t + l.ny * 4;
    const tipX = cx + l.dx * size * 0.7;
    const tipY = cy + l.dy * size * 0.7;
    ctx.moveTo(tipX - l.dx * size + l.nx * size * 0.8, tipY - l.dy * size + l.ny * size * 0.8);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - l.dx * size - l.nx * size * 0.8, tipY - l.dy * size - l.ny * size * 0.8);
  }
}
