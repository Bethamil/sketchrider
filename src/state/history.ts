import type { LineStore, TrackLine } from '../lines/store';

/** One undoable action: a batch of lines added and/or removed together. */
export interface Batch {
  added: TrackLine[];
  removed: TrackLine[];
}

const LIMIT = 300;

export class History {
  private undos: Batch[] = [];
  private redos: Batch[] = [];
  onChange: (() => void) | null = null;

  constructor(private store: LineStore) {}

  push(batch: Batch): void {
    if (batch.added.length === 0 && batch.removed.length === 0) return;
    this.undos.push(batch);
    if (this.undos.length > LIMIT) this.undos.shift();
    this.redos = [];
    this.onChange?.();
  }

  canUndo(): boolean {
    return this.undos.length > 0;
  }

  canRedo(): boolean {
    return this.redos.length > 0;
  }

  undo(): void {
    const b = this.undos.pop();
    if (!b) return;
    for (const l of b.added) this.store.remove(l.id);
    for (const l of b.removed) this.store.addExisting(l);
    this.redos.push(b);
    this.onChange?.();
  }

  redo(): void {
    const b = this.redos.pop();
    if (!b) return;
    for (const l of b.removed) this.store.remove(l.id);
    for (const l of b.added) this.store.addExisting(l);
    this.undos.push(b);
    this.onChange?.();
  }
}
