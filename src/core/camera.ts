import { clamp } from './math';

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 8;

/**
 * World <-> screen mapping. (x, y) is the world point at the center of the
 * viewport; zoom is screen pixels per world unit. Screen coords are CSS px.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  viewW = 1;
  viewH = 1;

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  toWorldX(sx: number): number {
    return (sx - this.viewW / 2) / this.zoom + this.x;
  }

  toWorldY(sy: number): number {
    return (sy - this.viewH / 2) / this.zoom + this.y;
  }

  /** Pan by a screen-space delta (drag). */
  panScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /** Zoom by a factor, keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const wx = this.toWorldX(sx);
    const wy = this.toWorldY(sy);
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.x = wx - (sx - this.viewW / 2) / this.zoom;
    this.y = wy - (sy - this.viewH / 2) / this.zoom;
  }

  /** Set the canvas transform so subsequent drawing happens in world space. */
  applyTransform(ctx: CanvasRenderingContext2D, dpr: number): void {
    const s = this.zoom * dpr;
    ctx.setTransform(
      s,
      0,
      0,
      s,
      dpr * (this.viewW / 2) - s * this.x,
      dpr * (this.viewH / 2) - s * this.y,
    );
  }

  /** Visible world rectangle, for culling and grid drawing. */
  worldBounds(): { x1: number; y1: number; x2: number; y2: number } {
    return {
      x1: this.toWorldX(0),
      y1: this.toWorldY(0),
      x2: this.toWorldX(this.viewW),
      y2: this.toWorldY(this.viewH),
    };
  }
}
