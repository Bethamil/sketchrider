import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { Game } from './core/game';
import { InputController } from './core/input';
import { DrawTool, EraserTool, PanTool, type Tool } from './core/tools';
import { allLineTypes } from './lines/types';
import { Renderer } from './render/renderer';
import { debounce, exportTrackFile, loadTrack, pickTrackFile, saveTrack } from './state/persist';
import { Toolbar, type UIActions } from './ui/toolbar';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;

const game = new Game();
const renderer = new Renderer(canvas, game.camera);

const drawTool = new DrawTool(game);
const tools: Record<string, Tool> = {
  draw: drawTool,
  erase: new EraserTool(game),
  pan: new PanTool(game),
};
let activeTool: Tool = drawTool;

// ---- restore the last track, or seed a starter slope ---------------------

if (!loadTrack(game.store, game.camera)) {
  seedStarterTrack();
  game.camera.x = 170;
  game.camera.y = 90;
  game.camera.zoom = 1;
}

const persist = debounce(() => saveTrack(game.store, game.camera), 600);
game.store.onMutate = persist;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveTrack(game.store, game.camera);
});

function seedStarterTrack(): void {
  const n = 22;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([-120 + t * 760, 34 + t * 250 - Math.sin(t * Math.PI) * 62]);
  }
  for (let i = 0; i < n; i++) {
    game.store.add('normal', pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
}

/** Replace the current track with an imported one, as one undoable action. */
function applyImportedTrack(data: unknown): void {
  const d = data as { lines?: unknown; track?: { lines?: unknown } };
  const incoming = Array.isArray(d?.lines) ? d.lines : d?.track?.lines;
  if (!Array.isArray(incoming)) return;
  const removed = [...game.store.all()];
  game.store.clear();
  const added = [];
  for (const raw of incoming as Array<Record<string, number | string>>) {
    const line = game.store.add(
      String(raw.t),
      Number(raw.x1),
      Number(raw.y1),
      Number(raw.x2),
      Number(raw.y2),
    );
    if (line) added.push(line);
  }
  game.history.push({ added, removed });
}

// ---- UI + input wiring ----------------------------------------------------

const uiActions: UIActions = {
  setTool: (id) => {
    activeTool = tools[id] ?? activeTool;
    toolbar.refresh();
  },
  getToolId: () => activeTool.id,
  setLineType: (id) => {
    drawTool.lineType = id;
    activeTool = drawTool;
    toolbar.refresh();
  },
  getLineTypeId: () => drawTool.lineType,
  undo: () => game.history.undo(),
  redo: () => game.history.redo(),
  canUndo: () => game.history.canUndo(),
  canRedo: () => game.history.canRedo(),
  clearTrack: () => game.clearTrack(),
  exportTrack: () => exportTrackFile(game.store),
  importTrack: () => pickTrackFile(applyImportedTrack),
  play: () => game.play(),
  stop: () => game.stop(),
  togglePause: () => game.togglePause(),
  restart: () => game.restart(),
  toggleFast: () => game.toggleFast(),
  isFast: () => game.speed > 1,
  setRewinding: (on) => game.setRewinding(on),
  getMode: () => game.mode,
  isPaused: () => game.paused,
};

const toolbar = new Toolbar(ui, uiActions);

new InputController(canvas, game.camera, {
  getTool: () => activeTool,
  setTool: uiActions.setTool,
  setLineTypeByHotkey: (key) => {
    const def = allLineTypes().find((d) => d.hotkey === key);
    if (!def) return false;
    uiActions.setLineType(def.id);
    return true;
  },
  undo: uiActions.undo,
  redo: uiActions.redo,
  togglePlay: () => game.togglePlay(),
  togglePause: uiActions.togglePause,
  stop: uiActions.stop,
  restart: uiActions.restart,
  toggleFast: uiActions.toggleFast,
  setRewinding: uiActions.setRewinding,
});

game.onModeChange = () => toolbar.refresh();
game.history.onChange = () => toolbar.refresh();
game.renderFrame = () => renderer.render(game, activeTool);

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
game.start();

registerSW({ immediate: true });
