import { makePoint, makeStick, type Contact, type PPoint, type Stick } from './engine';

/**
 * The rider: a sketchy figure on a sled. Two runner points touch the
 * track; the body is mounted on the sled with breakable sticks, so a hard
 * enough jolt tears the figure off and it ragdolls.
 */
const OFFSETS = {
  tail: { x: -22, y: 2, friction: 0 },
  nose: { x: 22, y: 2, friction: 0 },
  hip: { x: -6, y: -12, friction: 0.5 },
  shoulder: { x: -10, y: -28, friction: 0.5 },
  head: { x: -5, y: -40, friction: 0.25 },
  hand: { x: 12, y: -20, friction: 0.4 },
  foot: { x: 14, y: -2, friction: 0.4 },
} as const;

export type RiderPointName = keyof typeof OFFSETS;

const SCARF_NODES = 7;
const SCARF_REST = 6.5;
const SCARF_GRAVITY = 0.04;
const SCARF_DRAG = 0.92;

interface ScarfNode {
  x: number;
  y: number;
  px: number;
  py: number;
}

export class Rider {
  readonly points: Record<RiderPointName, PPoint>;
  readonly allPoints: PPoint[];
  readonly sticks: Stick[];
  readonly scarf: ScarfNode[] = [];
  crashed = false;

  constructor() {
    const p = {} as Record<RiderPointName, PPoint>;
    for (const name of Object.keys(OFFSETS) as RiderPointName[]) {
      const o = OFFSETS[name];
      p[name] = makePoint(o.x, o.y, o.friction);
    }
    this.points = p;
    this.allPoints = Object.values(p);

    this.sticks = [
      // Rigid skeleton.
      makeStick(p.tail, p.nose),
      makeStick(p.hip, p.shoulder),
      makeStick(p.shoulder, p.head),
      makeStick(p.shoulder, p.hand),
      makeStick(p.hip, p.foot),
      // Breakable mounts keep the figure on the sled. Only the long torso
      // mounts are endurance-checked (can trigger the dismount); the short
      // limb/posture mounts release when a checked one snaps.
      makeStick(p.hip, p.tail, true),
      makeStick(p.hip, p.nose, true),
      makeStick(p.shoulder, p.tail, true),
      makeStick(p.foot, p.nose, true, false),
      makeStick(p.hand, p.nose, true, false),
      makeStick(p.hip, p.head, true, false),
    ];

    for (let i = 0; i < SCARF_NODES; i++) {
      this.scarf.push({ x: 0, y: 0, px: 0, py: 0 });
    }
    this.reset(0, 0);
  }

  reset(x: number, y: number): void {
    this.crashed = false;
    for (const name of Object.keys(OFFSETS) as RiderPointName[]) {
      const o = OFFSETS[name];
      const pt = this.points[name];
      pt.x = x + o.x;
      pt.y = pt.py = y + o.y;
      // Like the original: the rider starts with a gentle nudge forward.
      pt.px = pt.x - 0.7;
    }
    for (const s of this.sticks) s.broken = false;
    const sh = this.points.shoulder;
    for (let i = 0; i < this.scarf.length; i++) {
      const n = this.scarf[i];
      n.x = n.px = sh.x - (i + 1) * SCARF_REST;
      n.y = n.py = sh.y + 2;
    }
  }

  /**
   * Geometric wipeout rules, checked against this step's line contacts
   * while mounted. Like the original game, crashes come from geometry:
   *  - the runner touches a line while the sled is upside-down
   *    (landed on your head), or
   *  - the runner slams a surface that faces against the direction of
   *    travel, fast (head-on into a wall).
   * Bumps, kinks and flat landings can never trigger either: their
   * contact normals point the survivable way.
   */
  checkWipeout(contacts: Contact[]): boolean {
    if (this.crashed) return false;
    const tail = this.points.tail;
    const nose = this.points.nose;
    let dx = nose.x - tail.x;
    let dy = nose.y - tail.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const ux = dy; // sled "up"
    const uy = -dx;
    for (const c of contacts) {
      if (c.p !== tail && c.p !== nose) continue;
      // Landed on the head: runner hits a floor-ish surface (normal points
      // up) while the sled is more than ~120° rotated, with real impact.
      if (c.ny < -0.35 && c.vn < -1 && ux * c.nx + uy * c.ny < -0.5) return true;
      // Head-on slam: the sled points into a surface that opposes travel,
      // and the motion is mostly INTO it (a nose-dive that keeps its
      // tangential speed pivots and rides on instead).
      const vAlong = (c.p.x - c.p.px) * dx + (c.p.y - c.p.py) * dy;
      const facing = (dx * c.nx + dy * c.ny) * (vAlong >= 0 ? 1 : -1);
      const vt = (c.p.x - c.p.px) * -c.ny + (c.p.y - c.p.py) * c.nx;
      if (facing < -0.6 && c.vn < -3.5 && Math.abs(c.vn) > 2 * Math.abs(vt)) return true;
    }
    return false;
  }

  /** Serialize the full dynamic state (for the rewind tape). */
  snapshot(): Float32Array {
    const n = this.allPoints.length * 4 + this.scarf.length * 4 + 1 + this.sticks.length;
    const out = new Float32Array(n);
    let i = 0;
    for (const p of this.allPoints) {
      out[i++] = p.x;
      out[i++] = p.y;
      out[i++] = p.px;
      out[i++] = p.py;
    }
    for (const s of this.scarf) {
      out[i++] = s.x;
      out[i++] = s.y;
      out[i++] = s.px;
      out[i++] = s.py;
    }
    out[i++] = this.crashed ? 1 : 0;
    for (const s of this.sticks) out[i++] = s.broken ? 1 : 0;
    return out;
  }

  restore(snap: Float32Array): void {
    let i = 0;
    for (const p of this.allPoints) {
      p.x = snap[i++];
      p.y = snap[i++];
      p.px = snap[i++];
      p.py = snap[i++];
    }
    for (const s of this.scarf) {
      s.x = snap[i++];
      s.y = snap[i++];
      s.px = snap[i++];
      s.py = snap[i++];
    }
    this.crashed = snap[i++] === 1;
    for (const s of this.sticks) s.broken = snap[i++] === 1;
  }

  /** Tear every mount: the figure separates from the sled. */
  crash(): void {
    if (this.crashed) return;
    this.crashed = true;
    for (const s of this.sticks) {
      if (s.breakable) s.broken = true;
    }
  }

  get comX(): number {
    return (this.points.tail.x + this.points.nose.x + this.points.hip.x) / 3;
  }

  get comY(): number {
    return (this.points.tail.y + this.points.nose.y + this.points.hip.y) / 3;
  }

  get velX(): number {
    const h = this.points.hip;
    return h.x - h.px;
  }

  get velY(): number {
    const h = this.points.hip;
    return h.y - h.py;
  }

  /** Purely visual verlet chain hanging from the shoulder. */
  updateScarf(): void {
    const sh = this.points.shoulder;
    for (const n of this.scarf) {
      const vx = (n.x - n.px) * SCARF_DRAG;
      const vy = (n.y - n.py) * SCARF_DRAG;
      n.px = n.x;
      n.py = n.y;
      n.x += vx;
      n.y += vy + SCARF_GRAVITY;
    }
    for (let pass = 0; pass < 2; pass++) {
      let ax = sh.x;
      let ay = sh.y;
      for (const n of this.scarf) {
        const dx = n.x - ax;
        const dy = n.y - ay;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - SCARF_REST) / d;
        n.x -= dx * diff;
        n.y -= dy * diff;
        ax = n.x;
        ay = n.y;
      }
    }
  }
}
