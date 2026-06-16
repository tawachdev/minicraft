/** Block definitions and the texture-atlas tile mapping. */

export const Block = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Cobble: 4,
  Log: 5,
  Leaves: 6,
  Sand: 7,
  Planks: 8,
  Brick: 9,
  Water: 10,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

/** Atlas tiles (index into the 4-column atlas). */
export const Tile = {
  GrassTop: 0,
  GrassSide: 1,
  Dirt: 2,
  Stone: 3,
  Cobble: 4,
  LogTop: 5,
  LogSide: 6,
  Leaves: 7,
  Sand: 8,
  Planks: 9,
  Brick: 10,
  Water: 11,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;
export const TILE_PX = 16;

interface BlockDef {
  name: string;
  /** Tiles for [top, bottom, side]. */
  top: TileId;
  bottom: TileId;
  side: TileId;
  solid: boolean; // collides with the player
  opaque: boolean; // hides neighbouring faces
}

const DEF: Record<number, BlockDef> = {
  [Block.Grass]: { name: "Grass", top: Tile.GrassTop, bottom: Tile.Dirt, side: Tile.GrassSide, solid: true, opaque: true },
  [Block.Dirt]: { name: "Dirt", top: Tile.Dirt, bottom: Tile.Dirt, side: Tile.Dirt, solid: true, opaque: true },
  [Block.Stone]: { name: "Stone", top: Tile.Stone, bottom: Tile.Stone, side: Tile.Stone, solid: true, opaque: true },
  [Block.Cobble]: { name: "Cobblestone", top: Tile.Cobble, bottom: Tile.Cobble, side: Tile.Cobble, solid: true, opaque: true },
  [Block.Log]: { name: "Wood Log", top: Tile.LogTop, bottom: Tile.LogTop, side: Tile.LogSide, solid: true, opaque: true },
  [Block.Leaves]: { name: "Leaves", top: Tile.Leaves, bottom: Tile.Leaves, side: Tile.Leaves, solid: true, opaque: true },
  [Block.Sand]: { name: "Sand", top: Tile.Sand, bottom: Tile.Sand, side: Tile.Sand, solid: true, opaque: true },
  [Block.Planks]: { name: "Planks", top: Tile.Planks, bottom: Tile.Planks, side: Tile.Planks, solid: true, opaque: true },
  [Block.Brick]: { name: "Bricks", top: Tile.Brick, bottom: Tile.Brick, side: Tile.Brick, solid: true, opaque: true },
  [Block.Water]: { name: "Water", top: Tile.Water, bottom: Tile.Water, side: Tile.Water, solid: false, opaque: false },
};

export function blockName(id: BlockId): string {
  return DEF[id]?.name ?? "Air";
}

export function isSolid(id: BlockId): boolean {
  return id !== Block.Air && (DEF[id]?.solid ?? false);
}

export function isOpaque(id: BlockId): boolean {
  return id !== Block.Air && (DEF[id]?.opaque ?? false);
}

export function isWater(id: BlockId): boolean {
  return id === Block.Water;
}

export type FaceKind = "top" | "bottom" | "side";

export function tileForKind(id: BlockId, kind: FaceKind): TileId {
  const def = DEF[id];
  if (!def) return Tile.Stone;
  if (kind === "top") return def.top;
  if (kind === "bottom") return def.bottom;
  return def.side;
}

/** Blocks available in the hotbar, in order. */
export const HOTBAR: BlockId[] = [
  Block.Grass,
  Block.Dirt,
  Block.Stone,
  Block.Cobble,
  Block.Log,
  Block.Planks,
  Block.Leaves,
  Block.Sand,
  Block.Brick,
];
