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
import { HOTBAR, Block } from "../src/blocks.js";
import { runCommand, type CommandContext } from "../src/commands.js";
import type { Hotbar } from "../src/ui.js";
import { makeWorld } from "./helpers.js";

function makeCtx(mode: "creative" | "survival" = "creative") {
  const { world } = makeWorld();
  const player = new Player(world, new THREE.Vector3(96, 40, 96), mode);
  let selected = 0;
  let modeSwitches: string[] = [];
  let granted: Array<[number, number]> = [];
  const hotbar = {
    select: (i: number) => {
      selected = i;
    },
    selectId: (id: number) => {
      selected = HOTBAR.indexOf(id as (typeof HOTBAR)[number]);
    },
    grant: (id: number, n: number) => {
      granted.push([id, n]);
      selected = HOTBAR.indexOf(id as (typeof HOTBAR)[number]);
    },
    get name() {
      return HOTBAR[selected] ? String(HOTBAR[selected]) : "";
    },
  } as unknown as Hotbar;
  const ctx: CommandContext = {
    player,
    hotbar,
    setMode: (m) => {
      player.setMode(m);
      modeSwitches.push(m);
    },
  };
  return {
    player,
    ctx,
    hotbarIndex: () => selected,
    modeSwitches: () => modeSwitches,
    granted: () => granted,
  };
}

describe("runCommand", () => {
  it("lists every command in /help", () => {
    const { ctx } = makeCtx();
    const help = runCommand("/help", ctx);
    for (const cmd of ["gamemode", "give", "tp", "spawn", "heal", "kill", "fly"]) {
      expect(help).toContain(`/${cmd}`);
    }
  });

  it("switches game mode and reports it", () => {
    const { ctx, modeSwitches } = makeCtx("creative");
    expect(runCommand("/gm s", ctx)).toContain("survival");
    expect(modeSwitches()).toEqual(["survival"]);
    expect(runCommand("/gamemode creative", ctx)).toContain("creative");
    expect(modeSwitches()).toEqual(["survival", "creative"]);
  });

  it("rejects an unknown game mode", () => {
    const { ctx } = makeCtx();
    expect(runCommand("/gamemode hardcore", ctx)).toContain("Usage");
  });

  it("gives a block by name and by hotbar number", () => {
    const { ctx, hotbarIndex } = makeCtx();
    expect(runCommand("/give brick", ctx)).toContain("Now holding");
    expect(hotbarIndex()).toBe(8);
    expect(runCommand("/give 3", ctx)).toContain("Now holding");
    expect(hotbarIndex()).toBe(2);
  });

  it("grants a 64 stack in survival, only selects in creative", () => {
    const creative = makeCtx("creative");
    runCommand("/give stone", creative.ctx);
    expect(creative.granted()).toEqual([]);

    const survival = makeCtx("survival");
    expect(runCommand("/give dirt", survival.ctx)).toContain("Gave 64");
    expect(survival.granted()).toEqual([[Block.Dirt, 64]]);
    expect(survival.hotbarIndex()).toBe(1);
  });

  it("rejects unknown and ambiguous block names", () => {
    const { ctx } = makeCtx();
    expect(runCommand("/give diamond", ctx)).toContain("No block");
    expect(runCommand("/give s", ctx)).toContain("Ambiguous");
  });

  it("teleports and clamps to the world", () => {
    const { player, ctx } = makeCtx();
    expect(runCommand("/tp 20 45 30", ctx)).toContain("Teleported to 20 45 30");
    expect(player.pos.x).toBe(20);
    expect(player.pos.y).toBe(45);
    runCommand("/tp 9999 200 -50", ctx);
    expect(player.pos.x).toBeLessThanOrEqual(191);
    expect(player.pos.y).toBeLessThanOrEqual(46);
    expect(player.pos.z).toBeGreaterThanOrEqual(1);
  });

  it("rejects non-numeric teleport coordinates", () => {
    const { ctx } = makeCtx();
    expect(runCommand("/tp a b c", ctx)).toContain("numbers");
    expect(runCommand("/tp 1 2", ctx)).toContain("Usage");
  });

  it("heals after damage", () => {
    const { player, ctx } = makeCtx("survival");
    player.damage(6);
    expect(player.health).toBe(14);
    expect(runCommand("/heal", ctx)).toContain("Healed");
    expect(player.health).toBe(20);
  });

  it("respawns at the spawn point via /spawn and /kill", () => {
    const { player, ctx } = makeCtx();
    player.teleport(10, 30, 10);
    runCommand("/spawn", ctx);
    expect(player.pos.x).toBeCloseTo(96, 5);
    player.teleport(10, 30, 10);
    runCommand("/kill", ctx);
    expect(player.pos.z).toBe(96);
  });

  it("toggles flight in creative and refuses it in survival", () => {
    const creative = makeCtx("creative");
    expect(runCommand("/fly", creative.ctx)).toContain("on");
    expect(creative.player.flying).toBe(true);
    expect(runCommand("/fly", creative.ctx)).toContain("off");
    expect(creative.player.flying).toBe(false);

    const survival = makeCtx("survival");
    expect(runCommand("/fly", survival.ctx)).toContain("creative-only");
    expect(survival.player.flying).toBe(false);
  });

  it("drops flight when switching to survival", () => {
    const { player, ctx } = makeCtx("creative");
    runCommand("/fly", ctx);
    expect(player.flying).toBe(true);
    runCommand("/gm s", ctx);
    expect(player.flying).toBe(false);
  });

  it("reports unknown commands", () => {
    const { ctx } = makeCtx();
    expect(runCommand("/netherite", ctx)).toContain("Unknown command");
  });
});
