/**
 * Line storage with a uniform-grid spatial hash so physics and the eraser
 * only ever look at nearby segments.
 */
export interface TrackLine {
  id: number;
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Unit direction from (x1,y1) to (x2,y2). */
  dx: number;
  dy: number;
  len: number;
  /** Unit normal; the ridable side. Up when drawn left-to-right. */
  nx: number;
  ny: number;
}

const CELL = 96;

export function makeLine(
  id: number,
  type: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): TrackLine | null {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.25) return null;
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  return { id, type, x1, y1, x2, y2, dx, dy, len, nx: dy, ny: -dx };
}

export class LineStore {
  private lines = new Map<number, TrackLine>();
  private grid = new Map<string, TrackLine[]>();
  nextId = 1;
  /** Called after any mutation — used for autosave. */
  onMutate: (() => void) | null = null;

  get size(): number {
    return this.lines.size;
  }

  all(): IterableIterator<TrackLine> {
    return this.lines.values();
  }

  add(type: string, x1: number, y1: number, x2: number, y2: number): TrackLine | null {
    const line = makeLine(this.nextId, type, x1, y1, x2, y2);
    if (!line) return null;
    this.nextId++;
    this.insert(line);
    return line;
  }

  /** Re-add a line that existed before (undo/redo, loading a save). */
  addExisting(line: TrackLine): void {
    this.insert(line);
    if (line.id >= this.nextId) this.nextId = line.id + 1;
  }

  remove(id: number): TrackLine | undefined {
    const line = this.lines.get(id);
    if (!line) return undefined;
    this.lines.delete(id);
    for (const key of this.cellKeys(line)) {
      const bucket = this.grid.get(key);
      if (!bucket) continue;
      const i = bucket.indexOf(line);
      if (i >= 0) bucket.splice(i, 1);
      if (bucket.length === 0) this.grid.delete(key);
    }
    this.onMutate?.();
    return line;
  }

  clear(): void {
    this.lines.clear();
    this.grid.clear();
    this.onMutate?.();
  }

  /** All lines whose grid cells overlap the circle at (x, y) radius r. */
  query(x: number, y: number, r: number): TrackLine[] {
    const cx1 = Math.floor((x - r) / CELL);
    const cy1 = Math.floor((y - r) / CELL);
    const cx2 = Math.floor((x + r) / CELL);
    const cy2 = Math.floor((y + r) / CELL);
    const out: TrackLine[] = [];
    const seen = new Set<number>();
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        const bucket = this.grid.get(cx + ',' + cy);
        if (!bucket) continue;
        for (const line of bucket) {
          if (!seen.has(line.id)) {
            seen.add(line.id);
            out.push(line);
          }
        }
      }
    }
    return out;
  }

  /** Distance from a point to the line's segment. */
  static segDist(l: TrackLine, x: number, y: number): number {
    const rx = x - l.x1;
    const ry = y - l.y1;
    let t = rx * l.dx + ry * l.dy;
    t = t < 0 ? 0 : t > l.len ? l.len : t;
    return Math.hypot(rx - l.dx * t, ry - l.dy * t);
  }

  toJSON(): object {
    return {
      version: 1,
      nextId: this.nextId,
      lines: [...this.lines.values()].map((l) => ({
        id: l.id,
        t: l.type,
        x1: l.x1,
        y1: l.y1,
        x2: l.x2,
        y2: l.y2,
      })),
    };
  }

  loadJSON(data: any): void {
    this.lines.clear();
    this.grid.clear();
    if (!data || !Array.isArray(data.lines)) return;
    for (const raw of data.lines) {
      const line = makeLine(raw.id, raw.t, raw.x1, raw.y1, raw.x2, raw.y2);
      if (line) this.insert(line);
    }
    this.nextId = typeof data.nextId === 'number' ? data.nextId : this.lines.size + 1;
  }

  private insert(line: TrackLine): void {
    this.lines.set(line.id, line);
    for (const key of this.cellKeys(line)) {
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(line);
    }
    this.onMutate?.();
  }

  private cellKeys(line: TrackLine): string[] {
    const cx1 = Math.floor(Math.min(line.x1, line.x2) / CELL);
    const cy1 = Math.floor(Math.min(line.y1, line.y2) / CELL);
    const cx2 = Math.floor(Math.max(line.x1, line.x2) / CELL);
    const cy2 = Math.floor(Math.max(line.y1, line.y2) / CELL);
    const keys: string[] = [];
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        keys.push(cx + ',' + cy);
      }
    }
    return keys;
  }
}
