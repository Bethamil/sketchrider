import { Camera } from './camera';
import { lerp } from './math';
import { LineStore } from '../lines/store';
import { Engine, STEP_MS } from '../physics/engine';
import { Rider } from '../physics/rider';
import { History } from '../state/history';

export type Mode = 'edit' | 'play';

/**
 * Owns the world (lines, rider, camera, history) and the fixed-timestep
 * game loop. Rendering is delegated through renderFrame so the game has
 * no knowledge of the canvas.
 */
export class Game {
  readonly store = new LineStore();
  readonly engine = new Engine();
  readonly rider = new Rider();
  readonly camera = new Camera();
  readonly history: History;
  readonly spawn = { x: 0, y: -4 };

  mode: Mode = 'edit';
  paused = false;
  /** Playback rate: 1 = normal, 2 = fast-forward. */
  speed = 1;
  /** While true, playback scrubs backwards through the tape. */
  rewinding = false;
  runTimeMs = 0;

  onModeChange: (() => void) | null = null;
  renderFrame: (() => void) | null = null;

  private acc = 0;
  private rewindAcc = 0;
  private lastT = 0;
  private editCam = { x: 0, y: 0, zoom: 1 };
  /** One rider snapshot per physics step, so rewind is a true scrub. */
  private tape: Float32Array[] = [];
  private static readonly TAPE_MAX = 5 * 60 * 60; // five minutes

  constructor() {
    this.history = new History(this.store);
    this.rider.reset(this.spawn.x, this.spawn.y);
  }

  start(): void {
    this.lastT = performance.now();
    requestAnimationFrame(this.tick);
  }

  play(): void {
    if (this.mode === 'edit') {
      this.editCam = { x: this.camera.x, y: this.camera.y, zoom: this.camera.zoom };
    }
    this.rider.reset(this.spawn.x, this.spawn.y);
    this.mode = 'play';
    this.paused = false;
    // Every run starts at normal speed — a sticky 2x from a previous run
    // reads as "the game is randomly faster today".
    this.speed = 1;
    this.rewinding = false;
    this.acc = 0;
    this.rewindAcc = 0;
    this.runTimeMs = 0;
    this.tape.length = 0;
    this.onModeChange?.();
  }

  stop(): void {
    if (this.mode === 'edit') return;
    this.mode = 'edit';
    this.paused = false;
    this.rider.reset(this.spawn.x, this.spawn.y);
    this.camera.x = this.editCam.x;
    this.camera.y = this.editCam.y;
    this.camera.zoom = this.editCam.zoom;
    this.onModeChange?.();
  }

  togglePlay(): void {
    if (this.mode === 'edit') this.play();
    else this.stop();
  }

  togglePause(): void {
    if (this.mode !== 'play') return;
    this.paused = !this.paused;
    this.onModeChange?.();
  }

  restart(): void {
    if (this.mode !== 'play') return;
    this.rider.reset(this.spawn.x, this.spawn.y);
    this.acc = 0;
    this.rewindAcc = 0;
    this.runTimeMs = 0;
    this.paused = false;
    this.rewinding = false;
    this.speed = 1;
    this.tape.length = 0;
    this.onModeChange?.();
  }

  toggleFast(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.onModeChange?.();
  }

  /** Hold-to-rewind: scrubs back through the tape, then leaves you paused. */
  setRewinding(on: boolean): void {
    if (this.mode !== 'play') return;
    this.rewinding = on;
    if (on) {
      this.paused = true;
      this.rewindAcc = 0;
    }
    this.onModeChange?.();
  }

  /** Remove every line as a single undoable action. */
  clearTrack(): void {
    const removed = [...this.store.all()];
    if (removed.length === 0) return;
    this.store.clear();
    this.history.push({ added: [], removed });
  }

  private tick = (t: number): void => {
    const dt = Math.min(t - this.lastT, 100);
    this.lastT = t;
    // How far we are between fixed steps; rendering interpolates with it so
    // motion stays smooth on displays faster (or slower) than 60 Hz.
    let alpha = 1;
    if (this.mode === 'play') {
      if (this.rewinding) {
        // Scrub backwards at 2x real time, whatever the display refresh rate.
        this.rewindAcc += dt * 2;
        while (this.rewindAcc >= STEP_MS) {
          this.rewindAcc -= STEP_MS;
          if (this.tape.length === 0) break;
          this.rider.restore(this.tape.pop()!);
          this.runTimeMs = Math.max(0, this.runTimeMs - STEP_MS);
        }
      } else if (!this.paused) {
        this.acc += dt * this.speed;
        const cap = STEP_MS * 5 * this.speed;
        if (this.acc > cap) this.acc = cap;
        while (this.acc >= STEP_MS) {
          this.acc -= STEP_MS;
          this.step();
        }
        alpha = this.acc / STEP_MS;
      }
      this.rider.beginLerp(alpha);
      this.followCamera(dt);
    }
    this.renderFrame?.();
    this.rider.endLerp();
    requestAnimationFrame(this.tick);
  };

  private step(): void {
    this.rider.capturePrev();
    this.tape.push(this.rider.snapshot());
    if (this.tape.length > Game.TAPE_MAX) this.tape.splice(0, 3600);
    const snapped = this.engine.step(this.rider.allPoints, this.rider.sticks, this.store);
    if (snapped || this.rider.checkWipeout(this.engine.contacts)) this.rider.crash();
    this.rider.updateScarf();
    this.runTimeMs += STEP_MS;
  }

  /** Ease toward the rider once per rendered frame, dt-corrected so the
   *  camera feel is identical at any frame rate. */
  private followCamera(dt: number): void {
    const r = this.rider;
    const tx = r.comX + r.velX * 14;
    const ty = r.comY + r.velY * 14;
    const k = 1 - Math.pow(0.9, dt / STEP_MS);
    this.camera.x = lerp(this.camera.x, tx, k);
    this.camera.y = lerp(this.camera.y, ty, k);
  }
}
