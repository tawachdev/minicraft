# Contributing to MiniCraft

Thanks for wanting to help! MiniCraft is a small, deliberate codebase: a voxel sandbox with no server, no assets, and no build magic. This guide gets you from clone to pull request in a few minutes.

## Setup

```sh
git clone https://github.com/tawachdev/minicraft.git
cd minicraft
npm ci
npm run dev
```

Open http://localhost:5173 — the world generates with a progress bar, then the menu appears.

Node 20.19+ is required (Vite 8). Check with `node --version`.

## Before you open a PR

All three must pass:

```sh
npm run typecheck
npm test
npm run build
```

The test suite runs in plain Node (no browser) and covers game logic: world generation determinism, edit persistence across chunk borders, raycast behavior, physics, inventory rules, and the command parser. If you add a behavior, add its test — see `tests/` for the pattern; pure logic belongs in `src/` modules that don't touch the DOM.

## Where things live

| Path | Owns |
|---|---|
| `src/world.ts` | Voxels, terrain generation, chunk meshing, save-file edits |
| `src/player.ts` | Physics, collision, health, flight, teleport |
| `src/commands.ts` | The `/command` parser — pure logic, wired via `CommandContext` |
| `src/inventory.ts` | Block counts, creative/survival economy |
| `src/mobs.ts` | Animal AI |
| `src/ui.ts` | Hotbar and hearts rendering |
| `src/main.ts` | Input wiring, the frame loop, and glue between everything |

Keep domain logic in the small modules (testable without a browser) and keep `main.ts` for wiring. One rule of thumb: if your change needs a browser to test, ask whether the logic could live in a module that doesn't.

## Pull requests

1. Branch from `main`.
2. One logical change per PR — same style as the commit history.
3. Commit messages follow `feat:`, `fix:`, `docs:`, `refactor:` and explain why.
4. Include the three checks above in the PR description, with results.

Good first targets are in the [Roadmap](README.md#roadmap) section of the README. For anything bigger (multiplayer, new game modes), open an issue first so we can agree on the shape.

## Ground rules

- No asset files — textures and sounds are generated in code (`textures.ts`, `audio.ts`).
- No comments explaining what code obviously does; constraints the code can't show are fine.
- Don't take shortcuts past validation, error handling, or the test suite.
