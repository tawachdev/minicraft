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
import { Inventory } from "../src/inventory.js";
import { findLandColumn, makeWorld } from "./helpers.js";

describe("world edits", () => {
  it("records player edits and exports them for the save", () => {
    const { world } = makeWorld();
    const col = findLandColumn(world);
    world.setBlock(col.x, col.top, col.z, Block.Air);
    world.setBlock(col.x, col.top + 1, col.z, Block.Brick);
    const edits = world.exportEdits();
    expect(edits).toContainEqual([col.x, col.top, col.z, Block.Air]);
    expect(edits).toContainEqual([col.x, col.top + 1, col.z, Block.Brick]);
  });

  it("replays saved edits onto a fresh world", () => {
    const first = makeWorld();
    const col = findLandColumn(first.world);
    first.world.setBlock(col.x, col.top, col.z, Block.Brick);
    const edits = first.world.exportEdits();

    const second = makeWorld();
    expect(second.world.getBlock(col.x, col.top, col.z)).not.toBe(Block.Brick);
    second.world.loadEdits(edits);
    expect(second.world.getBlock(col.x, col.top, col.z)).toBe(Block.Brick);
    expect(second.world.exportEdits()).toEqual(edits);
  });
});

describe("save round trip through player and inventory", () => {
  it("restores position and orientation", () => {
    const { world } = makeWorld();
    const player = new Player(world, new THREE.Vector3(96, 40, 96), "survival");
    player.teleport(20, 45, 30);
    player.setOrientation(1.2, -0.4);
    const saved = { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.getYaw(), pitch: player.getPitch() };
    player.teleport(96, 40, 96);
    player.setOrientation(0, 0);
    player.teleport(saved.x, saved.y, saved.z);
    player.setOrientation(saved.yaw, saved.pitch);
    expect(player.pos.x).toBeCloseTo(20);
    expect(player.getYaw()).toBeCloseTo(1.2);
    expect(player.getPitch()).toBeCloseTo(-0.4);
  });

  it("clamps restored health to the valid range", () => {
    const { world } = makeWorld();
    const player = new Player(world, new THREE.Vector3(96, 40, 96), "survival");
    player.setHealth(999);
    expect(player.health).toBe(player.maxHealth);
    player.setHealth(-7);
    expect(player.health).toBe(0);
    player.setHealth(6.9);
    expect(player.health).toBe(6);
  });

  it("restores inventory counts", () => {
    const inv = new Inventory();
    inv.collect(Block.Dirt, 12);
    inv.collect(Block.Stone, 3);
    const saved = inv.entries();
    const fresh = new Inventory();
    fresh.restore(saved);
    expect(fresh.count(Block.Dirt)).toBe(12);
    expect(fresh.count(Block.Stone)).toBe(3);
    fresh.clear();
    expect(fresh.count(Block.Dirt)).toBe(0);
  });
});
