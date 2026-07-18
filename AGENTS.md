# AGENTS.md — rules for working on SketchRider

SketchRider is a Line Rider-style browser game: sketch a track, a ragdoll on
a sled rides it under gravity alone. Vanilla TypeScript + canvas 2D, built
with Vite, installable PWA, fully client-side.

## Hard rules

- **pnpm only.** Never npm/yarn, never install anything globally.
- **Max 500 lines per source file.** Split a module before it grows past that.
- **No runtime dependencies, no frameworks.** Plain DOM for UI, canvas 2D for
  the game. Dev dependencies are fine.
- **Client-side only.** No backend, ever. Tracks live in localStorage and in
  shareable JSON files (import/export in the toolbar).
- **`pnpm smoke` must pass** before any commit that touches physics. It is the
  headless regression suite for ride/crash behavior (`scripts/smoke.ts`).
- Verify with `pnpm build` (runs icons + typecheck + vite build).

## Important decisions (don't re-litigate casually)

- **Physics is fixed-step Verlet at 60 Hz**, the same family as the original
  Line Rider: point masses, stick constraints, 6 solver iterations, one-sided
  swept line collision (no tunneling at speed). Constants live in
  `src/physics/engine.ts`.
- **Physics must be cross-browser deterministic.** Never use `Math.hypot`,
  trig, `Math.pow` or other non-correctly-rounded Math functions in any code
  that feeds the sim (engine, rider, line geometry in the store) — they
  differ between V8 and SpiderMonkey and the divergence compounds until the
  same track crashes in one browser and not the other. Use `len2d()` from
  `physics/engine.ts` (sqrt/mul/add are IEEE-exact everywhere). The smoke
  suite's "lerp determinism" test guards the render side of this.
- **Crashes are geometric, not jolt-based.** Compression never breaks the
  rider loose — bumps, kinks and hard flat landings are survivable by
  construction. Wipeouts: inverted landing, head-on slam where motion is
  mostly into the surface, or endurance overstretch as a backstop
  (`Rider.checkWipeout` in `src/physics/rider.ts`). This was tuned against
  the smoke matrix; change thresholds only with the suite green.
- **Line types are a registry.** A new type is one `registerLineType({...})`
  call in `src/lines/types.ts` — physics, color, toolbar chip, hotkey and
  persistence all derive from it. Current: normal, speed, turbo, slow,
  scenery.
- **Rewind is a tape**, not reverse simulation: every step snapshots the
  rider (`Rider.snapshot/restore`), rewind pops snapshots.
- **Rendering is decoupled from the 60 Hz sim.** The rider is drawn at
  positions interpolated between fixed steps (`Rider.beginLerp/endLerp`,
  alpha from the game loop accumulator) and the camera eases once per
  rendered frame, dt-corrected — this is what makes 120 Hz displays smooth
  and keeps browsers with slower canvases from drifting into slow motion.
  Never render raw step positions or move camera easing back into `step()`.
- **Track strokes are cached as `Path2D`** per line type (renderer), rebuilt
  only when `LineStore.version` changes; the grid is one repeating pattern
  fill. Don't reintroduce per-frame path building — it was the main perf
  cost (and the cause of Firefox running slower than Chrome).
- **UI layout:** the transport bar lives top right and is always shown in
  full — the red main button is play in edit mode and pause/resume during
  a run, run-only controls disable while editing. The bottom edit bar stays
  visible while riding so tracks can be edited mid-run; rare file actions
  live in the "⋯" menu.
- **World units = px at zoom 1, y grows downward.** Lines are one-sided:
  ridable side up when drawn left-to-right.
- **Sketch aesthetic is deterministic**: stroke jitter is seeded per line id
  (`src/render/sketch.ts`) so nothing boils frame to frame. No network
  fonts — the handwriting look comes from a local font stack.
- **Icons and logo are static artwork**, checked into git: the source logo
  lives in `docs/logo.png` (also used in the README), the favicon and PWA
  icons in `public/favicon.png` + `public/icons/`. They were cut from
  hand-picked artwork — don't regenerate them programmatically.
- **Deploy target is Netlify** (`netlify.toml`): build `pnpm build`,
  publish `dist/`.

## Layout

- `src/core/` — game loop/modes/tape (`game.ts`), camera, pointer + keyboard
  input, editing tools
- `src/physics/` — engine + collision, rider ragdoll + wipeout rules
- `src/lines/` — line-type registry, spatial-hash line store
- `src/render/` — renderer, sketchy strokes, rider drawing
- `src/state/` — undo/redo history, localStorage + file import/export
- `src/ui/` — DOM toolbar
- `scripts/` — icon generator, smoke suite
