import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, TILE_PX, Tile, type TileId } from "./blocks.js";

/** Tiny seeded RNG so each tile looks textured but is deterministic. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];
const shade = (c: RGB, k: number): string => {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
};

/** Fill a tile with noisy variations of a base colour. */
function noisy(ctx: CanvasRenderingContext2D, x0: number, y0: number, base: RGB, seed: number, amp = 0.16): void {
  const r = rng(seed);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const k = 1 - amp / 2 + r() * amp;
      ctx.fillStyle = shade(base, k);
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, x0: number, y0: number, tile: TileId): void {
  switch (tile) {
    case Tile.GrassTop:
      noisy(ctx, x0, y0, [95, 159, 53], 11, 0.22);
      break;
    case Tile.Dirt:
      noisy(ctx, x0, y0, [122, 82, 48], 22, 0.2);
      break;
    case Tile.GrassSide: {
      noisy(ctx, x0, y0, [122, 82, 48], 22, 0.2);
      const r = rng(33);
      for (let x = 0; x < TILE_PX; x++) {
        const h = 3 + Math.floor(r() * 3);
        for (let y = 0; y < h; y++) {
          ctx.fillStyle = shade([95, 159, 53], 0.92 + r() * 0.16);
          ctx.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
      break;
    }
    case Tile.Stone:
      noisy(ctx, x0, y0, [136, 136, 136], 44, 0.14);
      break;
    case Tile.Cobble: {
      noisy(ctx, x0, y0, [128, 128, 128], 55, 0.1);
      const r = rng(56);
      ctx.fillStyle = "rgba(40,40,40,0.6)";
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(r() * (TILE_PX - 3));
        const y = Math.floor(r() * (TILE_PX - 3));
        ctx.fillRect(x0 + x, y0 + y, 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3));
      }
      break;
    }
    case Tile.LogTop: {
      noisy(ctx, x0, y0, [160, 120, 70], 66, 0.1);
      ctx.strokeStyle = "rgba(90,60,30,0.7)";
      for (let rr = 2; rr < TILE_PX / 2; rr += 2) {
        ctx.beginPath();
        ctx.arc(x0 + TILE_PX / 2, y0 + TILE_PX / 2, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case Tile.LogSide: {
      noisy(ctx, x0, y0, [110, 78, 44], 77, 0.16);
      const r = rng(78);
      ctx.fillStyle = "rgba(70,48,26,0.6)";
      for (let x = 0; x < TILE_PX; x += 3) {
        if (r() > 0.4) ctx.fillRect(x0 + x, y0, 1, TILE_PX);
      }
      break;
    }
    case Tile.Leaves: {
      noisy(ctx, x0, y0, [56, 110, 40], 88, 0.3);
      const r = rng(89);
      ctx.fillStyle = "rgba(20,50,20,0.5)";
      for (let i = 0; i < 24; i++) ctx.fillRect(x0 + Math.floor(r() * TILE_PX), y0 + Math.floor(r() * TILE_PX), 1, 1);
      break;
    }
    case Tile.Sand:
      noisy(ctx, x0, y0, [220, 210, 154], 99, 0.12);
      break;
    case Tile.Planks: {
      noisy(ctx, x0, y0, [181, 133, 63], 101, 0.12);
      ctx.fillStyle = "rgba(120,82,36,0.7)";
      for (let y = 0; y < TILE_PX; y += 4) ctx.fillRect(x0, y0 + y, TILE_PX, 1);
      ctx.fillRect(x0 + 8, y0, 1, TILE_PX);
      break;
    }
    case Tile.Brick: {
      noisy(ctx, x0, y0, [156, 74, 58], 111, 0.1);
      ctx.fillStyle = "rgba(220,220,220,0.85)";
      for (let y = 0; y < TILE_PX; y += 4) ctx.fillRect(x0, y0 + y, TILE_PX, 1);
      for (let y = 0; y < TILE_PX; y += 4) {
        const off = (y / 4) % 2 === 0 ? 0 : 8;
        for (let x = off; x < TILE_PX; x += 8) ctx.fillRect(x0 + x, y0 + y, 1, 4);
      }
      break;
    }
    case Tile.Water:
      noisy(ctx, x0, y0, [58, 110, 224], 121, 0.12);
      break;
    default:
      noisy(ctx, x0, y0, [136, 136, 136], 1);
  }
}

/** Build the texture atlas as a Three.js texture. */
export function makeAtlasTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  for (let t = 0; t < ATLAS_COLS * ATLAS_ROWS; t++) {
    const col = t % ATLAS_COLS;
    const row = Math.floor(t / ATLAS_COLS);
    drawTile(ctx, col * TILE_PX, row * TILE_PX, t as TileId);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PAD = 0.5 / (ATLAS_COLS * TILE_PX);

/** UV rectangle for a tile: [u0, v0, u1, v1] (inset to avoid bleeding). */
export function tileUV(tile: TileId): [number, number, number, number] {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  return [col / ATLAS_COLS + PAD, row / ATLAS_ROWS + PAD, (col + 1) / ATLAS_COLS - PAD, (row + 1) / ATLAS_ROWS - PAD];
}

/** Small canvas for a hotbar icon (CSS scales it up, pixelated). */
export function makeTileCanvas(tile: TileId): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE_PX;
  c.height = TILE_PX;
  const ctx = c.getContext("2d");
  if (ctx) drawTile(ctx, 0, 0, tile);
  return c;
}
