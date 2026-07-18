import type { Camera } from './camera';
import type { Tool } from './tools';

export interface InputActions {
  getTool(): Tool;
  setTool(id: string): void;
  setLineTypeByHotkey(key: string): boolean;
  undo(): void;
  redo(): void;
  togglePlay(): void;
  togglePause(): void;
  stop(): void;
  restart(): void;
  toggleFast(): void;
  setRewinding(on: boolean): void;
}

interface PointerInfo {
  x: number;
  y: number;
  type: string;
}

/**
 * Pointer + keyboard handling. One finger / pen / mouse drives the active
 * tool; two fingers always pinch-zoom and pan, whatever the tool. Touch
 * input is ignored while a pen is down (palm rejection for iPad).
 */
export class InputController {
  private pointers = new Map<number, PointerInfo>();
  private mode: 'none' | 'tool' | 'pan' | 'pinch' = 'none';
  private panLast = { x: 0, y: 0 };
  private pinchDist = 1;
  private pinchMid = { x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private actions: InputActions,
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') this.actions.setRewinding(false);
    });
  }

  private pos(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private hasPen(): boolean {
    for (const p of this.pointers.values()) if (p.type === 'pen') return true;
    return false;
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' && this.hasPen()) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.pointers.set(e.pointerId, { ...p, type: e.pointerType });

    if (this.pointers.size === 2) {
      if (this.mode === 'tool') this.actions.getTool().cancel();
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      this.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.mode = 'pinch';
    } else if (this.pointers.size === 1) {
      if (e.button === 1) {
        this.mode = 'pan';
        this.panLast = p;
      } else if (e.button === 0 || e.pointerType !== 'mouse') {
        this.mode = 'tool';
        this.actions.getTool().down(this.camera.toWorldX(p.x), this.camera.toWorldY(p.y), e);
      }
    } else {
      this.mode = 'none';
    }
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pos(e);
    if (!this.pointers.has(e.pointerId)) {
      this.actions.getTool().hover?.(this.camera.toWorldX(p.x), this.camera.toWorldY(p.y));
      return;
    }
    this.pointers.set(e.pointerId, { ...p, type: e.pointerType });

    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.camera.zoomAt(mid.x, mid.y, dist / this.pinchDist);
      this.camera.panScreen(mid.x - this.pinchMid.x, mid.y - this.pinchMid.y);
      this.pinchDist = dist;
      this.pinchMid = mid;
    } else if (this.mode === 'pan') {
      this.camera.panScreen(p.x - this.panLast.x, p.y - this.panLast.y);
      this.panLast = p;
    } else if (this.mode === 'tool') {
      const tool = this.actions.getTool();
      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ce of events) {
        const cp = this.pos(ce);
        tool.move(this.camera.toWorldX(cp.x), this.camera.toWorldY(cp.y), ce);
      }
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pointers.size === 0) {
      if (this.mode === 'tool') this.actions.getTool().up();
      this.mode = 'none';
    } else if (this.mode === 'pinch' && this.pointers.size === 1) {
      // The leftover finger must not start a stroke; wait for a full lift.
      this.mode = 'none';
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.pos(e);
    const intensity = e.ctrlKey || e.metaKey ? 0.012 : 0.0022;
    this.camera.zoomAt(p.x, p.y, Math.exp(-e.deltaY * intensity));
  };

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.actions.redo();
      else this.actions.undo();
      return;
    }
    if (e.metaKey || e.ctrlKey) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (!e.repeat) this.actions.togglePlay();
        break;
      case 'Escape':
        this.actions.stop();
        break;
      case 'p':
        this.actions.togglePause();
        break;
      case 'r':
        this.actions.restart();
        break;
      case 'f':
        this.actions.toggleFast();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (!e.repeat) this.actions.setRewinding(true);
        break;
      case 'd':
        this.actions.setTool('draw');
        break;
      case 'e':
        this.actions.setTool('erase');
        break;
      case 'h':
        this.actions.setTool('pan');
        break;
      default:
        this.actions.setLineTypeByHotkey(e.key);
    }
  };
}
