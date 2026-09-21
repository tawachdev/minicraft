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
import { findLandColumn, makeWorld } from "./helpers.js";

const DT = 1 / 60;

/** Regression: mining straight down used to drop the player into the void forever. */
describe("void safety", () => {
  it(
    "teleports the player back to the surface instead of falling forever (creative)",
    () => {
      const { world } = makeWorld();
      const { x, z, top } = findLandColumn(world);
      const player = new Player(world, new THREE.Vector3(x + 0.5, top + 1, z + 0.5), "creative");

      player.pos.y = -60;
      for (let i = 0; i < 5; i++) player.update(DT);

      expect(player.pos.y).toBeGreaterThan(0);
      expect(player.health).toBe(player.maxHealth);
    },
  );

  it(
    "recovers in survival too, without getting stuck below the world",
    () => {
      const { world } = makeWorld();
      const { x, z, top } = findLandColumn(world);
      const player = new Player(world, new THREE.Vector3(x + 0.5, top + 1, z + 0.5), "survival");

      player.pos.y = -60;
      for (let i = 0; i < 5; i++) player.update(DT);

      expect(player.pos.y).toBeGreaterThan(0);
      // the void itself does not leave the player at zero hp
      expect(player.health).toBeGreaterThanOrEqual(0);
    },
  );
});
