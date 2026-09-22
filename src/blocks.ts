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

type SoundKind = "grass" | "stone" | "wood" | "sand";

interface BlockDef {
  name: string;
  /** Tiles for [top, bottom, side]. */
  top: TileId;
  bottom: TileId;
  side: TileId;
  solid: boolean; // collides with the player
  opaque: boolean; // hides neighbouring faces
  /** Seconds of continuous mining needed to break (survival mode). */
  hardness: number;
  sound: SoundKind;
  /** Particle burst colour when the block breaks. */
  particle: number;
}

const DEF: Record<number, BlockDef> = {
  [Block.Grass]: { name: "Grass", top: Tile.GrassTop, bottom: Tile.Dirt, side: Tile.GrassSide, solid: true, opaque: true, hardness: 0.45, sound: "grass", particle: 0x5f9f35 },
  [Block.Dirt]: { name: "Dirt", top: Tile.Dirt, bottom: Tile.Dirt, side: Tile.Dirt, solid: true, opaque: true, hardness: 0.4, sound: "grass", particle: 0x7a5230 },
  [Block.Stone]: { name: "Stone", top: Tile.Stone, bottom: Tile.Stone, side: Tile.Stone, solid: true, opaque: true, hardness: 0.9, sound: "stone", particle: 0x888888 },
  [Block.Cobble]: { name: "Cobble", top: Tile.Cobble, bottom: Tile.Cobble, side: Tile.Cobble, solid: true, opaque: true, hardness: 0.9, sound: "stone", particle: 0x808080 },
  [Block.Log]: { name: "Wood Log", top: Tile.LogTop, bottom: Tile.LogTop, side: Tile.LogSide, solid: true, opaque: true, hardness: 0.7, sound: "wood", particle: 0x6e4e2c },
  [Block.Leaves]: { name: "Leaves", top: Tile.Leaves, bottom: Tile.Leaves, side: Tile.Leaves, solid: true, opaque: true, hardness: 0.2, sound: "grass", particle: 0x387028 },
  [Block.Sand]: { name: "Sand", top: Tile.Sand, bottom: Tile.Sand, side: Tile.Sand, solid: true, opaque: true, hardness: 0.35, sound: "sand", particle: 0xdcd29a },
  [Block.Planks]: { name: "Planks", top: Tile.Planks, bottom: Tile.Planks, side: Tile.Planks, solid: true, opaque: true, hardness: 0.7, sound: "wood", particle: 0xb5853f },
  [Block.Brick]: { name: "Bricks", top: Tile.Brick, bottom: Tile.Brick, side: Tile.Brick, solid: true, opaque: true, hardness: 0.9, sound: "stone", particle: 0x9c4a3a },
  [Block.Water]: { name: "Water", top: Tile.Water, bottom: Tile.Water, side: Tile.Water, solid: false, opaque: false, hardness: 999, sound: "grass", particle: 0x3a6ee0 },
};

export function blockName(id: BlockId): string {
  return DEF[id]?.name ?? "Air";
}

/** Seconds to mine and the particle colour of a block (creative mode ignores hardness). */
export function blockFx(id: BlockId): { hardness: number; sound: SoundKind; particle: number } {
  const def = DEF[id];
  return { hardness: def?.hardness ?? 0.5, sound: def?.sound ?? "stone", particle: def?.particle ?? 0x888888 };
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

/** What mining a block adds to the inventory, Minecraft rules; null = nothing. */
export function dropOf(id: BlockId): BlockId | null {
  if (id === Block.Grass) return Block.Dirt;
  if (id === Block.Stone) return Block.Cobble;
  if (id === Block.Leaves || id === Block.Water || id === Block.Air) return null;
  return id;
}
