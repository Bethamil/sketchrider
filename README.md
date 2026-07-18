# SketchRider ✏️

A modern, hand-drawn take on the classic Line Rider. Sketch a track, press
play, and a ragdoll on a sled rides your line — powered by gravity alone.

- **Client-side only** — no backend, tracks autosave to localStorage
- **Installable PWA** — works offline, on phone, iPad (Apple Pencil supported)
  and desktop
- **Zero runtime dependencies** — vanilla TypeScript + canvas 2D, ~10 KB
  gzipped

## Play

| Action | Desktop | Touch |
| --- | --- | --- |
| Draw | drag (hold **shift** for a ruler-straight line) | one finger / pencil |
| Pan + zoom | scroll = zoom, middle-drag or **h** = pan | two-finger pinch/drag |
| Play / stop | **space** | ▶ button |
| Pause / restart | **p** / **r** | toolbar buttons |
| Rewind (hold) / fast 2x | **←** / **f** | toolbar buttons |
| Undo / redo | **⌘Z** / **⇧⌘Z** | toolbar buttons |
| Tools | **d** draw, **e** erase, **h** pan | toolbar buttons |
| Line types | **1**–**5** | toolbar chips |

Line types: **Line** (plain), **Speed** (boosts along its drawn direction —
note the chevrons), **Turbo** (much stronger boost), **Slow** (sandy drag),
**Scenery** (decoration only).

Lines are one-sided, like the original: the ridable side is on top when you
draw left-to-right. You can keep drawing while the run plays or is paused,
and hold rewind to scrub the rider back through time. Crashes follow the
original's spirit: bumps, kinks and big flat drops are survivable — landing
on your head or slamming a wall at speed tears the rider off the sled.

Tracks can be **saved to / loaded from JSON files** (toolbar) for sharing.

## Develop

```sh
pnpm install
pnpm dev        # dev server
pnpm build      # icons + typecheck + production build (dist/)
pnpm smoke      # headless physics regression tests
pnpm preview    # serve the production build
```

Deploys to Netlify out of the box (`netlify.toml`): build command
`pnpm build`, publish directory `dist`.

## Architecture

Everything is small, dependency-free modules (each < 500 lines):

```
src/
  core/      game loop + modes, camera, pointer/keyboard input, editing tools
  physics/   fixed-step Verlet engine, one-sided swept line collision,
             rider ragdoll with breakable sled mounts
  lines/     line-type registry + spatial-hash line store
  render/    canvas renderer, seeded sketchy strokes, rider drawing
  state/     undo/redo history, localStorage + file import/export
  ui/        DOM toolbar
scripts/
  gen-icons.mjs   dependency-free PNG icon generator (pure node zlib)
  smoke.ts        headless physics scenarios (slope, rest, boost, crash)
```

### Adding a new line type

One call in `src/lines/types.ts`:

```ts
registerLineType({
  id: 'bouncy',
  label: 'Bouncy',
  color: '#7a4fbe',
  collidable: true,
  frictionMult: 1,
  baseFriction: 0,
  accel: 0,        // or boost along the drawn direction
  hotkey: '5',
});
```

Physics, rendering color, toolbar chip, hotkey and persistence all pick it
up from the registry. For behavior beyond friction/accel, extend the
contact resolution in `src/physics/engine.ts` (`collidePoint`).
