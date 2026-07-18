import type { LineStore } from '../lines/store';
import { getLineType } from '../lines/types';

/**
 * Verlet physics, faithful to the original Line Rider: point masses that
 * remember their previous position, distance constraints between them, and
 * one-sided collision against track lines. Everything is gravity-driven —
 * there is no player input during a run.
 */
export interface PPoint {
  x: number;
  y: number;
  px: number;
  py: number;
  /** How much this point grips lines (sled runner ~0, limbs higher). */
  friction: number;
}

export interface Stick {
  a: PPoint;
  b: PPoint;
  rest: number;
  /** Breakable sticks mount the rider to the sled. */
  breakable: boolean;
  broken: boolean;
  /**
   * Only endurance-checked sticks can *trigger* a dismount. Short mounts
   * are breakable-but-unchecked: tiny absolute stretches read as huge
   * ratios on them, so they'd fire on harmless bumps.
   */
  checked: boolean;
}

export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

const GRAVITY = 0.12;
const ITERATIONS = 6;
const MAX_PENETRATION = 14;
const AIR_DRAG = 0.9995;

/**
 * Endurance is a backstop, not the main crash rule: a mount snaps only when
 * STRETCHED far past rest mid-solve (body violently folded away from the
 * sled). Compression never breaks anything — bumps, kinks and landings
 * press the rider into the sled harmlessly, like the original game. The
 * primary wipeout rules are geometric and live in Rider.checkWipeout().
 */
const ENDURANCE = 0.12;

/** A line contact recorded this step — consumed by the wipeout rules. */
export interface Contact {
  p: PPoint;
  nx: number;
  ny: number;
  /** Normal velocity at impact (negative = into the surface). */
  vn: number;
}

export function makePoint(x: number, y: number, friction: number): PPoint {
  return { x, y, px: x, py: y, friction };
}

export function makeStick(a: PPoint, b: PPoint, breakable = false, checked = breakable): Stick {
  return { a, b, rest: Math.hypot(b.x - a.x, b.y - a.y), breakable, broken: false, checked };
}

export class Engine {
  private snapped = false;
  /** Break threshold — exposed so the physics test rig can sweep it. */
  endurance = ENDURANCE;
  /** Line contacts of the last step, for the geometric wipeout rules. */
  readonly contacts: Contact[] = [];
  /** Per-stick peak mid-solve stretch ratio of the last step (tuning aid). */
  debugStretch: number[] = [];

  /**
   * Advance one fixed step. Returns true if a mount snapped this step
   * (i.e. the rider dismounted / crashed).
   */
  step(points: PPoint[], sticks: Stick[], store: LineStore): boolean {
    for (const p of points) {
      const vx = (p.x - p.px) * AIR_DRAG;
      const vy = (p.y - p.py) * AIR_DRAG;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + GRAVITY;
    }

    this.snapped = false;
    this.contacts.length = 0;
    this.debugStretch.length = sticks.length;
    this.debugStretch.fill(0);
    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < sticks.length; i++) {
        const s = sticks[i];
        if (s.broken) continue;
        this.solveStick(s, i);
      }
      for (const p of points) {
        this.collidePoint(p, store);
      }
    }
    return this.snapped;
  }

  private solveStick(s: Stick, index: number): void {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return;
    const diff = ((d - s.rest) / d) * 0.5;
    if (s.checked && diff > 0) {
      if (diff > this.debugStretch[index]) this.debugStretch[index] = diff;
      if (diff > this.endurance) {
        s.broken = true;
        this.snapped = true;
        return;
      }
    }
    const ox = dx * diff;
    const oy = dy * diff;
    s.a.x += ox;
    s.a.y += oy;
    s.b.x -= ox;
    s.b.y -= oy;
  }

  private collidePoint(p: PPoint, store: LineStore): void {
    // Query covers the whole motion path so fast points can't outrun it.
    const travel = Math.hypot(p.x - p.px, p.y - p.py);
    const nearby = store.query(p.x, p.y, MAX_PENETRATION + travel);
    for (const l of nearby) {
      const type = getLineType(l.type);
      if (!type.collidable) continue;

      const rx = p.x - l.x1;
      const ry = p.y - l.y1;

      // Signed distance from the surface; negative = sunk below the
      // ridable side. Lines are one-sided, like the original game.
      const perp = rx * l.nx + ry * l.ny;
      if (perp >= 0) continue;

      // Hit if we're within the contact band, or if we started the step in
      // front of the surface and ended behind it (swept test — prevents
      // tunneling through lines at high speed).
      const prevPerp = (p.px - l.x1) * l.nx + (p.py - l.y1) * l.ny;
      if (perp < -MAX_PENETRATION && prevPerp < 0) continue;

      let along = rx * l.dx + ry * l.dy;
      if (prevPerp >= 0 && prevPerp - perp > 1e-9) {
        // Evaluate the segment span at the crossing point, not the endpoint.
        const s = prevPerp / (prevPerp - perp);
        const prevAlong = (p.px - l.x1) * l.dx + (p.py - l.y1) * l.dy;
        along = prevAlong + s * (along - prevAlong);
      }
      if (along < 0 || along > l.len) continue;

      const vx = p.x - p.px;
      const vy = p.y - p.py;
      const vn = vx * l.nx + vy * l.ny;
      if (vn > 0) continue; // already separating

      if (this.contacts.length < 64) {
        this.contacts.push({ p, nx: l.nx, ny: l.ny, vn });
      }

      // Push the point back to the surface.
      p.x -= l.nx * perp;
      p.y -= l.ny * perp;

      // Friction: damp the tangential velocity.
      const fr = Math.min(1, p.friction * type.frictionMult + type.baseFriction);
      if (fr > 0) {
        const vt = vx * l.dx + vy * l.dy;
        p.px += l.dx * vt * fr;
        p.py += l.dy * vt * fr;
      }

      // Boost lines accelerate along their drawn direction.
      if (type.accel !== 0) {
        const a = type.accel / ITERATIONS;
        p.px -= l.dx * a;
        p.py -= l.dy * a;
      }
    }
  }
}
