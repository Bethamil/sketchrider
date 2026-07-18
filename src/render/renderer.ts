import type { Camera } from '../core/camera';
import type { Game } from '../core/game';
import type { Tool } from '../core/tools';
import { allLineTypes } from '../lines/types';
import { addChevrons, addSketchStroke } from './sketch';
import { drawRider } from './riderDraw';

const PAPER = '#f8f3e7';
const HAND_FONT = '"Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive';

/** One line type's cached stroke geometry, in world coordinates. */
interface TrackLayer {
  color: string;
  count: number;
  main: Path2D;
  rough: Path2D;
  chevrons: Path2D | null;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;

  // The sketchy stroke paths are deterministic per line, so they are cached
  // as Path2D and only rebuilt when the track mutates. Stroking a cached
  // path is native-side work — this is what keeps slow canvases (Firefox)
  // at full frame rate instead of clamping the physics into slow motion.
  private trackVersion = -1;
  private layers: TrackLayer[] = [];

  // The dot grid is a repeating pattern tile: one fill instead of thousands
  // of fillRect calls. Regenerated only when the screen-space spacing changes.
  private gridTile = document.createElement('canvas');
  private gridPattern: CanvasPattern | null = null;
  private gridTileSize = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    this.drawGrid();
    camera.applyTransform(ctx, this.dpr);

    this.drawLines(game);
    if (game.mode === 'edit') this.drawSpawnMarker(game);
    drawRider(ctx, game.rider);
    if (game.rider.crashed) this.drawOof(game);
    tool.drawOverlay?.(ctx, camera.zoom);
  }

  /** Faint graph-paper dots, spacing adapted to zoom. Drawn in screen space
   *  as one pattern fill, phase-locked to the world grid. */
  private drawGrid(): void {
    const { ctx, camera } = this;
    let s = 32;
    while (s * camera.zoom < 34) s *= 2;
    while (s * camera.zoom > 90) s /= 2;
    const tile = Math.max(8, Math.round(s * camera.zoom * this.dpr));

    if (tile !== this.gridTileSize || !this.gridPattern) {
      this.gridTileSize = tile;
      this.gridTile.width = this.gridTile.height = tile;
      const tctx = this.gridTile.getContext('2d')!;
      const r = 1.1 * this.dpr;
      tctx.fillStyle = 'rgba(42, 46, 54, 0.10)';
      tctx.fillRect(tile / 2 - r, tile / 2 - r, r * 2, r * 2);
      this.gridPattern = ctx.createPattern(this.gridTile, 'repeat');
    }
    if (!this.gridPattern) return;

    // Device-pixel position of world (0, 0); the pattern repeats from there.
    const ox = (camera.viewW / 2 - camera.x * camera.zoom) * this.dpr;
    const oy = (camera.viewH / 2 - camera.y * camera.zoom) * this.dpr;
    const px = ((ox % tile) + tile) % tile;
    const py = ((oy % tile) + tile) % tile;
    ctx.setTransform(1, 0, 0, 1, px, py);
    ctx.fillStyle = this.gridPattern;
    ctx.fillRect(-px - tile, -py - tile, this.canvas.width + tile * 2, this.canvas.height + tile * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawLines(game: Game): void {
    const { ctx, camera } = this;
    if (game.store.version !== this.trackVersion) this.rebuildTrackCache(game);
    const rough = camera.zoom > 0.35;

    for (const layer of this.layers) {
      ctx.strokeStyle = layer.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.stroke(layer.main);

      if (rough && layer.count < 2500) {
        // Faint offset second pass sells the pencil "double stroke" look.
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.stroke(layer.rough);
        ctx.globalAlpha = 1;
      }

      if (layer.chevrons) {
        ctx.lineWidth = 1.3;
        ctx.stroke(layer.chevrons);
      }
    }
  }

  private rebuildTrackCache(game: Game): void {
    this.trackVersion = game.store.version;
    this.layers = [];
    const byType = new Map<string, TrackLayer>();
    const defs = allLineTypes();
    // Scenery under collidable lines, same as the old per-frame ordering.
    for (const def of [...defs.filter((d) => !d.collidable), ...defs.filter((d) => d.collidable)]) {
      const layer: TrackLayer = {
        color: def.color,
        count: 0,
        main: new Path2D(),
        rough: new Path2D(),
        chevrons: def.chevrons ? new Path2D() : null,
      };
      byType.set(def.id, layer);
      this.layers.push(layer);
    }
    for (const l of game.store.all()) {
      const layer = byType.get(l.type);
      if (!layer) continue;
      layer.count++;
      addSketchStroke(layer.main, l);
      addSketchStroke(layer.rough, l, 3, 7);
      if (layer.chevrons) addChevrons(layer.chevrons, l);
    }
    this.layers = this.layers.filter((layer) => layer.count > 0);
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
