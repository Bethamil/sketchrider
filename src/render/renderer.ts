import type { Camera } from '../core/camera';
import type { Game } from '../core/game';
import type { Tool } from '../core/tools';
import { allLineTypes } from '../lines/types';
import type { TrackLine } from '../lines/store';
import { addChevrons, addSketchStroke } from './sketch';
import { drawRider } from './riderDraw';

const PAPER = '#f8f3e7';
const HAND_FONT = '"Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private buckets = new Map<string, TrackLine[]>();

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.setViewport(w, h);
  }

  render(game: Game, tool: Tool): void {
    const { ctx, camera } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    camera.applyTransform(ctx, this.dpr);

    this.drawGrid();
    this.drawLines(game);
    if (game.mode === 'edit') this.drawSpawnMarker(game);
    drawRider(ctx, game.rider);
    if (game.rider.crashed) this.drawOof(game);
    tool.drawOverlay?.(ctx, camera.zoom);
  }

  /** Faint graph-paper dots, spacing adapted to zoom. */
  private drawGrid(): void {
    const { ctx, camera } = this;
    const b = camera.worldBounds();
    let s = 32;
    while (s * camera.zoom < 34) s *= 2;
    while (s * camera.zoom > 90) s /= 2;
    const r = 1.1 / camera.zoom;
    ctx.fillStyle = 'rgba(42, 46, 54, 0.10)';
    const x0 = Math.floor(b.x1 / s) * s;
    const y0 = Math.floor(b.y1 / s) * s;
    for (let x = x0; x <= b.x2; x += s) {
      for (let y = y0; y <= b.y2; y += s) {
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }

  private drawLines(game: Game): void {
    const { ctx, camera } = this;
    const b = camera.worldBounds();
    const pad = 60;

    for (const arr of this.buckets.values()) arr.length = 0;
    for (const l of game.store.all()) {
      if (
        Math.max(l.x1, l.x2) < b.x1 - pad ||
        Math.min(l.x1, l.x2) > b.x2 + pad ||
        Math.max(l.y1, l.y2) < b.y1 - pad ||
        Math.min(l.y1, l.y2) > b.y2 + pad
      ) {
        continue;
      }
      let arr = this.buckets.get(l.type);
      if (!arr) {
        arr = [];
        this.buckets.set(l.type, arr);
      }
      arr.push(l);
    }

    const defs = allLineTypes();
    const ordered = [...defs.filter((d) => !d.collidable), ...defs.filter((d) => d.collidable)];
    const rough = camera.zoom > 0.35;

    for (const def of ordered) {
      const arr = this.buckets.get(def.id);
      if (!arr || arr.length === 0) continue;
      ctx.strokeStyle = def.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const l of arr) addSketchStroke(ctx, l);
      ctx.stroke();

      if (rough && arr.length < 2500) {
        // Faint offset second pass sells the pencil "double stroke" look.
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const l of arr) addSketchStroke(ctx, l, 3, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (def.chevrons) {
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (const l of arr) addChevrons(ctx, l);
        ctx.stroke();
      }
    }
  }

  private drawSpawnMarker(game: Game): void {
    const { ctx } = this;
    const s = game.spawn;
    ctx.strokeStyle = 'rgba(42, 46, 54, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(s.x, s.y - 16, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawOof(game: Game): void {
    const { ctx } = this;
    const h = game.rider.points.head;
    ctx.fillStyle = '#c8402f';
    ctx.font = `16px ${HAND_FONT}`;
    ctx.fillText('oof!', h.x + 10, h.y - 12);
  }
}
