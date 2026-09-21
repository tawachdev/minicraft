import { vi } from "vitest";

vi.hoisted(() => {
  (globalThis as unknown as { window?: { innerWidth: number; innerHeight: number } }).window = {
    innerWidth: 1280,
    innerHeight: 720,
  };
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Player } from "../src/player.js";
import { Block } from "../src/blocks.js";
import { findLandColumn, makeWorld } from "./helpers.js";

const DT = 1 / 60;

function standingPlayer(world: ReturnType<typeof makeWorld>["world"]): Player {
  const { x, z, top } = findLandColumn(world);
  const player = new Player(world, new THREE.Vector3(x + 0.5, top + 1, z + 0.5));
  return player;
}

describe("player physics", () => {
  it(
    "settles on the ground under gravity and stays there",
    () => {
      const { world } = makeWorld();
      const player = standingPlayer(world);
      const standY = player.pos.y;

      for (let i = 0; i < 120; i++) player.update(DT);

      expect(player.pos.y).toBeCloseTo(standY, 5);
      const before = player.pos.y;
      player.update(DT);
      expect(player.pos.y).toBe(before);
    },
  );

  it(
    "is stopped by a solid wall instead of walking through it",
    () => {
      const { world } = makeWorld();
      const player = standingPlayer(world);
      const { x, z, top } = findLandColumn(world);

      world.setBlock(x, top + 1, z - 1, Block.Brick);
      world.setBlock(x, top + 2, z - 1, Block.Brick);

      player.setKey("KeyW", true);
      const startZ = player.pos.z;
      for (let i = 0; i < 40; i++) player.update(DT);

      expect(player.pos.z).toBeLessThan(startZ);
      expect(player.pos.z).toBeGreaterThanOrEqual(z + 0.3 - 1e-9);
    },
  );
});

describe("player interaction", () => {
  it(
    "raycasts straight down to the block under the crosshair with its placement cell",
    () => {
      const { world } = makeWorld();
      const player = standingPlayer(world);
      const { x, z, top } = findLandColumn(world);

      player.look(0, 3000);
      player.update(DT);
      const hit = player.raycast();

      expect(hit).not.toBeNull();
      expect(hit?.block).toEqual({ x, y: top, z });
      expect(hit?.place).toEqual({ x, y: top + 1, z });
    },
  );

  it("refuses to place a block inside its own body", () => {
    const { world } = makeWorld();
    const player = standingPlayer(world);
    const feetCell = {
      x: Math.floor(player.pos.x),
      y: Math.floor(player.pos.y),
      z: Math.floor(player.pos.z),
    };
    expect(player.intersectsCell(feetCell.x, feetCell.y, feetCell.z)).toBe(true);
    expect(player.intersectsCell(feetCell.x + 5, feetCell.y, feetCell.z)).toBe(false);
  });
});
