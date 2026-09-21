import * as THREE from "three";
import { World, HEIGHT, WORLD_BLOCKS } from "../src/world.js";
import { Block, isSolid, type BlockId } from "../src/blocks.js";

/** Build a real World. Generation and meshing are pure compute, so this runs in Node. */
export function makeWorld(seed = 1337): { world: World; scene: THREE.Scene } {
  const scene = new THREE.Scene();
  return { world: new World(scene, {} as unknown as THREE.Texture, seed), scene };
}

export interface SurfaceColumn {
  x: number;
  z: number;
  /** y of the highest solid block in this column; the player stands at top + 1. */
  top: number;
}

/** First column around the world center whose surface block is solid (not water/air). */
export function findLandColumn(world: World): SurfaceColumn {
  for (let ring = 0; ring < WORLD_BLOCKS / 2; ring++) {
    for (let x = 48 - ring; x <= 48 + ring; x++) {
      for (let z = 48 - ring; z <= 48 + ring; z++) {
        for (let y = HEIGHT - 1; y > 0; y--) {
          const id = world.getBlock(x, y, z) as BlockId;
          if (id !== Block.Air) {
            if (isSolid(id)) return { x, z, top: y };
            break;
          }
        }
      }
    }
  }
  throw new Error("no land column found");
}
