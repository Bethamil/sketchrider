import { allLineTypes } from '../lines/types';

export interface UIActions {
  setTool(id: string): void;
  getToolId(): string;
  setLineType(id: string): void;
  getLineTypeId(): string;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clearTrack(): void;
  exportTrack(): void;
  importTrack(): void;
  play(): void;
  stop(): void;
  togglePause(): void;
  restart(): void;
  toggleFast(): void;
  isFast(): boolean;
  setRewinding(on: boolean): void;
  getMode(): 'edit' | 'play';
  isPaused(): boolean;
}

const I = (paths: string, filled = false): string =>
  `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="${
    filled ? 'none' : 'currentColor'
  }" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONS = {
  pencil: I(
    '<path d="M4.5 19.5l1.2-4.4L16.3 4.5c.9-.9 3.1 1.3 2.2 2.2L7.9 17.3l-3.4 2.2z"/><path d="M14.5 6.5l2.9 2.9"/>',
  ),
  eraser: I(
    '<path d="M8.5 18l-4-4c-.8-.8-.8-1.6 0-2.4l6.6-6.8c.8-.8 1.7-.8 2.5 0l4.3 4.3c.8.8.8 1.6 0 2.4L11.5 18c-.9.9-2.1.9-3 0z"/><path d="M5 20.5h14"/>',
  ),
  hand: I(
    '<path d="M12 3.2v17.6M3.2 12h17.6"/><path d="M9.5 5.7L12 3.2l2.5 2.5M9.5 18.3l2.5 2.5 2.5-2.5M5.7 9.5L3.2 12l2.5 2.5M18.3 9.5l2.5 2.5-2.5 2.5"/>',
  ),
  undo: I('<path d="M7.5 6.5L4 10l3.5 3.5"/><path d="M4.5 10h9c3.3 0 6 2.7 6 6v1.5"/>'),
  redo: I('<path d="M16.5 6.5L20 10l-3.5 3.5"/><path d="M19.5 10h-9c-3.3 0-6 2.7-6 6v1.5"/>'),
  trash: I(
    '<path d="M5.5 7.5l1 12.2c.1.7.6 1.3 1.3 1.3h8.4c.7 0 1.2-.6 1.3-1.3l1-12.2"/><path d="M3.5 7h17M9.5 7V4.5c0-.6.4-1 1-1h3c.6 0 1 .4 1 1V7"/><path d="M10 11l.3 6M14 11l-.3 6"/>',
  ),
  save: I(
    '<path d="M12 3.5v10.5M8.5 10.5l3.5 3.7 3.5-3.7"/><path d="M4.5 15.5v3.2c0 1 .8 1.8 1.8 1.8h11.4c1 0 1.8-.8 1.8-1.8v-3.2"/>',
  ),
  load: I(
    '<path d="M12 14.5V3.7M8.5 7.2L12 3.5l3.5 3.7"/><path d="M4.5 15.5v3.2c0 1 .8 1.8 1.8 1.8h11.4c1 0 1.8-.8 1.8-1.8v-3.2"/>',
  ),
  play: I(
    '<path d="M8 5.5c0-.8.9-1.3 1.6-.9l10 6c.7.4.7 1.4 0 1.8l-10 6c-.7.4-1.6-.1-1.6-.9z"/>',
    true,
  ),
  pause: I('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>'),
  stop: I('<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>', true),
  restart: I('<path d="M18.8 11.5A7 7 0 1 1 16.2 6.1"/><path d="M16.3 2.6l-.3 3.9 3.9.3"/>'),
  rewind: I(
    '<path d="M11.5 6.5L6 12l5.5 5.5zM19 6.5L13.5 12l5.5 5.5z" fill="currentColor" stroke="none"/>',
    true,
  ),
  fast: I(
    '<path d="M5 6.5L10.5 12 5 17.5zM12.5 6.5L18 12l-5.5 5.5z" fill="currentColor" stroke="none"/>',
    true,
  ),
};

const squiggle = (color: string): string =>
  `<svg viewBox="0 0 32 12" fill="none"><path d="M2 8c5-5 8 3 13-2s8 2 15-3" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export class Toolbar {
  private bar!: HTMLDivElement;
  private toolBtns = new Map<string, HTMLButtonElement>();
  private chipBtns = new Map<string, HTMLButtonElement>();
  private editOnly: HTMLElement[] = [];
  private playOnly: HTMLElement[] = [];
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private trashBtn!: HTMLButtonElement;
  private playBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private fastBtn!: HTMLButtonElement;
  private confirmUntil = 0;

  constructor(
    private root: HTMLElement,
    private actions: UIActions,
  ) {
    this.build();
    this.refresh();
  }

  refresh(): void {
    const a = this.actions;
    const playing = a.getMode() === 'play';
    for (const el of this.editOnly) el.classList.toggle('gone', playing);
    for (const el of this.playOnly) el.classList.toggle('gone', !playing);
    for (const [id, btn] of this.toolBtns) {
      btn.classList.toggle('active', a.getToolId() === id);
    }
    for (const [id, btn] of this.chipBtns) {
      btn.classList.toggle('active', a.getLineTypeId() === id && a.getToolId() === 'draw');
    }
    this.undoBtn.disabled = !a.canUndo();
    this.redoBtn.disabled = !a.canRedo();
    this.pauseBtn.innerHTML = a.isPaused() ? ICONS.play : ICONS.pause;
    this.pauseBtn.title = a.isPaused() ? 'Resume (p)' : 'Pause (p)';
    this.fastBtn.classList.toggle('active', a.isFast());
    if (Date.now() > this.confirmUntil) this.trashBtn.classList.remove('confirm');
  }

  private build(): void {
    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.innerHTML =
      '<h1>Sketch<span class="ride">Rider</span></h1>' +
      '<div class="tagline">draw a track &middot; press play &middot; gravity does the rest</div>';
    this.root.appendChild(brand);

    this.bar = document.createElement('div');
    this.bar.className = 'bar';

    // Tools — always available, also while riding or paused.
    for (const [id, icon, title] of [
      ['draw', ICONS.pencil, 'Draw (d)'],
      ['erase', ICONS.eraser, 'Erase (e)'],
      ['pan', ICONS.hand, 'Pan (h) — or drag with two fingers'],
    ] as const) {
      const btn = this.btn(icon, title, () => this.actions.setTool(id));
      this.toolBtns.set(id, btn);
      this.bar.appendChild(btn);
    }

    this.divider();

    for (const def of allLineTypes()) {
      const btn = document.createElement('button');
      btn.className = 'tbtn chip';
      btn.title = `${def.label} line (${def.hotkey ?? ''})`;
      btn.innerHTML = squiggle(def.color) + `<span class="lbl">${def.label}</span>`;
      btn.addEventListener('click', () => {
        this.actions.setLineType(def.id);
        this.refresh();
      });
      this.chipBtns.set(def.id, btn);
      this.bar.appendChild(btn);
    }

    this.divider();

    this.undoBtn = this.btn(ICONS.undo, 'Undo (⌘Z)', () => this.actions.undo());
    this.redoBtn = this.btn(ICONS.redo, 'Redo (⇧⌘Z)', () => this.actions.redo());
    this.bar.append(this.undoBtn, this.redoBtn);

    this.trashBtn = this.btn(ICONS.trash, 'Clear track (tap twice)', () => this.confirmClear());
    this.trashBtn.classList.add('danger');
    const saveBtn = this.btn(ICONS.save, 'Save track to file', () => this.actions.exportTrack());
    const loadBtn = this.btn(ICONS.load, 'Load track from file', () => this.actions.importTrack());
    this.bar.append(this.trashBtn, saveBtn, loadBtn);
    this.editOnly.push(this.trashBtn, saveBtn, loadBtn);

    this.divider();

    // Transport: play in edit mode; stop/rewind/pause/fast/restart while riding.
    this.playBtn = this.btn(ICONS.play, 'Play (space)', () => this.actions.play());
    this.playBtn.classList.add('play');
    this.bar.appendChild(this.playBtn);
    this.editOnly.push(this.playBtn);

    const stopBtn = this.btn(ICONS.stop, 'Back to drawing (space)', () => this.actions.stop());
    const rewBtn = this.holdBtn(ICONS.rewind, 'Rewind — hold (←)');
    this.pauseBtn = this.btn(ICONS.pause, 'Pause (p)', () => this.actions.togglePause());
    this.fastBtn = this.btn(ICONS.fast, 'Fast-forward 2x (f)', () => this.actions.toggleFast());
    const restartBtn = this.btn(ICONS.restart, 'Restart run (r)', () => this.actions.restart());
    this.bar.append(stopBtn, rewBtn, this.pauseBtn, this.fastBtn, restartBtn);
    this.playOnly.push(stopBtn, rewBtn, this.pauseBtn, this.fastBtn, restartBtn);

    this.root.appendChild(this.bar);
  }

  private confirmClear(): void {
    if (Date.now() < this.confirmUntil) {
      this.confirmUntil = 0;
      this.actions.clearTrack();
      this.refresh();
      return;
    }
    this.confirmUntil = Date.now() + 2000;
    this.trashBtn.classList.add('confirm');
    setTimeout(() => this.refresh(), 2100);
  }

  private btn(icon: string, title: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'tbtn';
    b.title = title;
    b.innerHTML = icon;
    b.addEventListener('click', () => {
      onClick();
      this.refresh();
    });
    return b;
  }

  /** Press-and-hold button driving the rewind scrub. */
  private holdBtn(icon: string, title: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'tbtn';
    b.title = title;
    b.innerHTML = icon;
    const stop = () => {
      this.actions.setRewinding(false);
      this.refresh();
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      this.actions.setRewinding(true);
      this.refresh();
    });
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    return b;
  }

  private divider(): void {
    const d = document.createElement('span');
    d.className = 'divider';
    this.bar.appendChild(d);
  }
}
