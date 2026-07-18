import type { LineStore } from '../lines/store';
import type { Camera } from '../core/camera';

const KEY = 'sketchrider.track.v1';

export function saveTrack(store: LineStore, camera: Camera): void {
  try {
    const payload = {
      track: store.toJSON(),
      camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — the game still works, just no autosave.
  }
}

/** Returns true if a saved track was restored. */
export function loadTrack(store: LineStore, camera: Camera): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    store.loadJSON(data.track);
    if (data.camera) {
      camera.x = Number(data.camera.x) || 0;
      camera.y = Number(data.camera.y) || 0;
      camera.zoom = Number(data.camera.zoom) || 1;
    }
    return store.size > 0;
  } catch {
    return false;
  }
}

/** Download the track as a shareable JSON file. */
export function exportTrackFile(store: LineStore): void {
  const payload = { app: 'sketchrider', ...store.toJSON() };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  a.href = url;
  a.download = `sketchrider-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Open a file picker and hand the parsed track JSON to the callback. */
export function pickTrackFile(onData: (data: unknown) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      onData(JSON.parse(await file.text()));
    } catch {
      // Not a valid track file — ignore.
    }
  };
  input.click();
}

export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
