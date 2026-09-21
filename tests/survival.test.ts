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

function survivalPlayer(): { player: Player; top: number } {
  const { world } = makeWorld();
  const { x, z, top } = findLandColumn(world);
  const player = new Player(world, new THREE.Vector3(x + 0.5, top + 1, z + 0.5), "survival");
  return { player, top };
}

describe("survival mode", () => {
  it(
    "deals fall damage on a long drop and never drops below zero hp",
    () => {
      const { player } = survivalPlayer();
      const startHp = player.health;

      player.pos.y += 12; // a long fall
      for (let i = 0; i < 240; i++) player.update(DT);

      expect(player.health).toBeLessThan(startHp);
      expect(player.health).toBeGreaterThanOrEqual(0);
    },
  );

  it(
    "respawns with full health at the spawn point after dying",
    () => {
      const { world } = makeWorld();
      const { x, z, top } = findLandColumn(world);
      const spawn = new THREE.Vector3(x + 0.5, top + 1, z + 0.5);
      const player = new Player(world, spawn.clone(), "survival");

      player.pos.y += 30; // a lethal drop
      let respawned = false;
      player.onRespawn = () => {
        respawned = true;
      };
      for (let i = 0; i < 600 && player.health > 0; i++) player.update(DT);
      expect(respawned).toBe(true);
      expect(player.health).toBe(player.maxHealth);
      expect(player.pos.x).toBeCloseTo(spawn.x, 3);
      expect(player.pos.z).toBeCloseTo(spawn.z, 3);
    },
  );

  it(
    "takes no fall damage in creative mode",
    () => {
      const { world } = makeWorld();
      const { x, z, top } = findLandColumn(world);
      const player = new Player(world, new THREE.Vector3(x + 0.5, top + 1, z + 0.5), "creative");

      player.pos.y += 40; // lethal in survival, harmless in creative
      for (let i = 0; i < 240; i++) player.update(DT);

      expect(player.health).toBe(player.maxHealth);
    },
  );
});
