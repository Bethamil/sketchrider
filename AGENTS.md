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
- **World units = px at zoom 1, y grows downward.** Lines are one-sided:
  ridable side up when drawn left-to-right.
- **Sketch aesthetic is deterministic**: stroke jitter is seeded per line id
  (`src/render/sketch.ts`) so nothing boils frame to frame. No network
  fonts — the handwriting look comes from a local font stack.
- **PWA icons are generated**, not checked in: `scripts/gen-icons.mjs` is a
  dependency-free PNG encoder (node zlib), wired into `pnpm build`.
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
