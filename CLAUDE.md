# SketchRider

All project rules, conventions and architectural decisions live in
**[AGENTS.md](AGENTS.md)** — read that first.

Quick reference:

- pnpm only, nothing global; every source file < 500 lines
- `pnpm smoke` must pass before committing physics changes
- `pnpm build` = typecheck + production build
