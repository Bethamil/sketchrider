import type { Game } from './game';
import type { Vec } from './math';
import { LineStore, type TrackLine } from '../lines/store';

/**
 * Editing tools. Coordinates arriving here are already in world space.
 * A tool can draw a world-space overlay (e.g. the eraser circle).
 */
export interface Tool {
  readonly id: string;
  down(x: number, y: number, e: PointerEvent): void;
  move(x: number, y: number, e: PointerEvent): void;
  up(): void;
  /** Abort mid-gesture (a second finger landed → it was a pinch). */
  cancel(): void;
  /** Pointer moved without being pressed (mouse hover). */
  hover?(x: number, y: number): void;
  drawOverlay?(ctx: CanvasRenderingContext2D, zoom: number): void;
}

export class DrawTool implements Tool {
  readonly id = 'draw';
  lineType = 'normal';

  private last: Vec | null = null;
  private anchor: Vec | null = null;
  private straight = false;
  private added: TrackLine[] = [];

  constructor(private game: Game) {}

  down(x: number, y: number, e: PointerEvent): void {
    this.last = { x, y };
    this.anchor = { x, y };
    this.added = [];
    this.straight = e.shiftKey;
  }

  move(x: number, y: number): void {
    if (!this.last || !this.anchor) return;
    const store = this.game.store;

    if (this.straight) {
      // Shift: one straight ruler line from the anchor, re-laid every move.
      for (const l of this.added) store.remove(l.id);
      this.added = [];
      const line = store.add(this.lineType, this.anchor.x, this.anchor.y, x, y);
      if (line) this.added.push(line);
      return;
    }

    const min = this.minSegment();
    if (Math.hypot(x - this.last.x, y - this.last.y) < min) return;
    const line = store.add(this.lineType, this.last.x, this.last.y, x, y);
    if (line) this.added.push(line);
    this.last = { x, y };
  }

  up(): void {
    if (this.added.length > 0) {
      this.game.history.push({ added: this.added, removed: [] });
    }
    this.added = [];
    this.last = null;
    this.anchor = null;
  }

  cancel(): void {
    for (const l of this.added) this.game.store.remove(l.id);
    this.added = [];
    this.last = null;
    this.anchor = null;
  }

  /** Segment length adapts to zoom: fine detail up close, coarse zoomed out. */
  private minSegment(): number {
    const z = this.game.camera.zoom;
    return Math.min(30, Math.max(2, 5 / z));
  }
}

export class EraserTool implements Tool {
  readonly id = 'erase';
  private static readonly SCREEN_RADIUS = 16;

  private removed: TrackLine[] = [];
  private cursor: Vec | null = null;
  private active = false;

  constructor(private game: Game) {}

  down(x: number, y: number): void {
    this.active = true;
    this.removed = [];
    this.eraseAt(x, y);
  }

  move(x: number, y: number): void {
    if (this.active) this.eraseAt(x, y);
    this.cursor = { x, y };
  }

  up(): void {
    this.active = false;
    if (this.removed.length > 0) {
      this.game.history.push({ added: [], removed: this.removed });
    }
    this.removed = [];
  }

  cancel(): void {
    // Erasing already happened; keep it undoable.
    this.up();
  }

  hover(x: number, y: number): void {
    this.cursor = { x, y };
  }

  drawOverlay(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.cursor) return;
    const r = EraserTool.SCREEN_RADIUS / zoom;
    ctx.beginPath();
    ctx.arc(this.cursor.x, this.cursor.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(42, 46, 54, 0.55)';
    ctx.lineWidth = 1.4 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private eraseAt(x: number, y: number): void {
    this.cursor = { x, y };
    const r = EraserTool.SCREEN_RADIUS / this.game.camera.zoom;
    for (const line of this.game.store.query(x, y, r)) {
      if (LineStore.segDist(line, x, y) <= r) {
        const gone = this.game.store.remove(line.id);
        if (gone) this.removed.push(gone);
      }
    }
  }
}

export class PanTool implements Tool {
  readonly id = 'pan';
  private grab: Vec | null = null;

  constructor(private game: Game) {}

  down(x: number, y: number): void {
    this.grab = { x, y };
  }

  move(x: number, y: number): void {
    if (!this.grab) return;
    // Keep the grabbed world point under the pointer.
    this.game.camera.x += this.grab.x - x;
    this.game.camera.y += this.grab.y - y;
  }

  up(): void {
    this.grab = null;
  }

  cancel(): void {
    this.grab = null;
  }
}
