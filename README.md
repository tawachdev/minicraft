# MiniCraft

<p align="center">
  <img src="docs/screenshot-gameplay.png" alt="MiniCraft in-game: generated terrain with trees, the hotbar and the crosshair" width="800" />
</p>

**Play it now: <https://tawachdev.github.io/minicraft/>** — no install needed.

[Architecture](#architecture) · [Development](#scripts) · [Testing](#testing) · [Limitations](#known-limitations)

A voxel sandbox that runs entirely in your browser: explore a generated 96×96×48 world, break blocks, place blocks. No server, no account, no asset files — every texture is drawn pixel by pixel in code at startup.

- Terrain, beaches, water and trees from layered simplex noise
- Chunked meshing (16×16×48 chunks) — only exposed faces are uploaded to the GPU
- Pointer-lock mouse look, with a drag-to-look fallback where pointer lock is unavailable (embedded previews)

## Quick start

You need Node.js 20.19 or newer (22 works too).

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Click to Play**.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Space | Jump (hold Shift to sprint) |
| Mouse | Look |
| Left click | Break block |
| Right click | Place block |
| 1–9 or scroll | Select block |
| Esc | Pause |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload at http://localhost:5173 |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm test` | Behavioral test suite in plain Node (vitest) |

## Architecture

```
input (keyboard / mouse)
        │
        ▼
     Player ── physics: axis-separated AABB collision, gravity, jump
        │      raycast: voxel stepping for break / place
        │ world queries: getBlock / setBlock
        ▼
      World
      ├─ Chunk data (16×16×48 cells, one Uint8Array per chunk)
      ├─ Terrain generation (layered simplex noise, fixed seed)
      └─ Mesh generation (exposed faces only → BufferGeometry)
        │
        ▼
    Three.js ── scene, materials, camera; the render loop lives in main.ts
```

Why this split: `blocks.ts` is the single source of truth for what a block is (ids, atlas tiles, solid/opaque flags) — `World` reads it while meshing, `ui.ts` reads it to draw the hotbar. `World` owns all voxel state and never touches the DOM. `Player` owns physics and the camera and only asks `World` for block queries. `textures.ts` is the only file that draws to a canvas. That boundary is what makes the game logic testable in plain Node.

| Piece | File | Notes |
| --- | --- | --- |
| World generation | `src/world.ts` | Three octaves of simplex noise over a fixed seed (1337), so every visitor gets the same world |
| Chunk renderer | `src/world.ts` | Chunked face-culling meshing — only exposed faces are uploaded to the GPU; editing a block rebuilds only its chunk (and neighbors when on a border) |
| Physics | `src/player.ts` | Axis-separated AABB collision, gravity, jump, 5.5-block reach raycast |
| Textures | `src/textures.ts` | Procedural 16×16 tiles composited into a 4×4 atlas on a `<canvas>`, nearest-neighbor filtered |
| Blocks & hotbar | `src/blocks.ts`, `src/ui.ts` | 9 placeable block types, each defined by tiles and solid/opaque flags |

## Testing

```bash
npm test
```

The suite runs in plain Node — no browser — and covers the behavior that breaks silently: world generation is deterministic for a seed, block edits survive chunk borders and re-cull the shared face, the raycast returns the hit block and its placement cell, gravity settles the player on the ground, a wall stops movement, and a block cannot be placed inside the player's body. Rendering itself stays covered by typecheck and build, since the render loop needs a real browser.

## Known limitations

- **No saving.** Edits are lost when you refresh the page.
- **Fixed world.** 96×96×48 blocks, generated once at load; the seed is constant.
- **Desktop only.** There are no touch controls.
- **Water is a surface.** It renders from above only; swimming and underwater faces are not modeled.
- **Esc and pointer lock.** The browser intercepts Esc to release the mouse; click Play again to recapture.

## Troubleshooting

**The mouse doesn't lock and I can't look around.** You are probably inside an embedded preview where the browser blocks pointer lock. Drag with the mouse to look; clicks still break and place blocks.

**`npm run dev` fails with a Node version error.** Vite 8 requires Node 20.19+. Check with `node --version` and upgrade.

## License

[MIT](LICENSE) — Mohamed Taaouach
