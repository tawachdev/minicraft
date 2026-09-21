import { vi } from "vitest";

vi.hoisted(() => {
  (globalThis as unknown as { window?: { innerWidth: number; innerHeight: number } }).window = {
    innerWidth: 1280,
    innerHeight: 720,
  };
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Block } from "../src/blocks.js";
import { HEIGHT, SEA_LEVEL } from "../src/world.js";
import { findLandColumn, makeWorld } from "./helpers.js";

interface MeshLike {
  position: { x: number; z: number };
  geometry: { attributes: { position: { count: number } } };
}

/** Vertex count of the largest mesh based at a chunk origin (the opaque mesh). */
function vertexCountAt(scene: THREE.Scene, baseX: number, baseZ: number): number {
  let max = 0;
  for (const child of scene.children) {
    const mesh = child as unknown as MeshLike;
    if (mesh.position.x === baseX && mesh.position.z === baseZ) {
      const count = mesh.geometry.attributes.position.count;
      if (count > max) max = count;
    }
  }
  return max;
}

function sampleSurfaceHeights(world: ReturnType<typeof makeWorld>["world"]): number[] {
  const samples: number[] = [];
  for (const x of [0, 17, 48, 77, 95]) {
    for (const z of [0, 33, 95]) {
      let top = 0;
      for (let y = HEIGHT - 1; y > 0; y--) {
        if (world.getBlock(x, y, z) !== Block.Air) {
          top = y;
          break;
        }
      }
      samples.push(top);
    }
  }
  return samples;
}

describe("world generation", () => {
  it(
    "is deterministic for the same seed",
    () => {
      const a = sampleSurfaceHeights(makeWorld(1337).world);
      const b = sampleSurfaceHeights(makeWorld(1337).world);
      expect(b).toEqual(a);
    },
  );

  it(
    "produces different terrain for a different seed",
    () => {
      const a = sampleSurfaceHeights(makeWorld(1337).world);
      const b = sampleSurfaceHeights(makeWorld(1338).world);
      expect(b).not.toEqual(a);
    },
  );
});

describe("block get/set", () => {
  it(
    "round-trips a placed block in open air",
    () => {
      const { world } = makeWorld();
      const { x, z, top } = findLandColumn(world);
      const y = top + 5;
      expect(world.getBlock(x, y, z)).toBe(Block.Air);
      world.setBlock(x, y, z, Block.Brick);
      expect(world.getBlock(x, y, z)).toBe(Block.Brick);
      world.setBlock(x, y, z, Block.Air);
      expect(world.getBlock(x, y, z)).toBe(Block.Air);
    },
  );

  it(
    "rebuilds chunk meshes on edit and re-culls the shared face across a border",
    () => {
      const { world, scene } = makeWorld();
      const y = SEA_LEVEL + 20;

      // stream the two chunks around the edit point first (lazy meshing)
      for (let i = 0; i < 20; i++) world.update(new THREE.Vector3(24, 30, 8));
      const chunkOneBase = vertexCountAt(scene, 16, 0);
      expect(chunkOneBase).toBeGreaterThan(0);

      world.setBlock(16, y, 5, Block.Brick);
      const chunkOneWithBrick = vertexCountAt(scene, 16, 0);
      expect(chunkOneWithBrick).toBe(chunkOneBase + 24); // floating brick: 6 faces

      world.setBlock(15, y, 5, Block.Brick);
      expect(vertexCountAt(scene, 0, 0)).toBeGreaterThan(0);
      expect(vertexCountAt(scene, 16, 0)).toBe(chunkOneWithBrick - 4); // shared face culled

      world.setBlock(15, y, 5, Block.Air);
      world.setBlock(16, y, 5, Block.Air);
      expect(world.getBlock(16, y, 5)).toBe(Block.Air);
    },
  );
});
