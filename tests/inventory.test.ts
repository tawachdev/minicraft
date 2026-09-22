import { describe, expect, it } from "vitest";
import { Block, dropOf } from "../src/blocks.js";
import { Inventory } from "../src/inventory.js";

describe("dropOf", () => {
  it("follows Minecraft drop rules", () => {
    expect(dropOf(Block.Grass)).toBe(Block.Dirt);
    expect(dropOf(Block.Stone)).toBe(Block.Cobble);
    expect(dropOf(Block.Leaves)).toBeNull();
    expect(dropOf(Block.Water)).toBeNull();
    expect(dropOf(Block.Dirt)).toBe(Block.Dirt);
    expect(dropOf(Block.Log)).toBe(Block.Log);
    expect(dropOf(Block.Sand)).toBe(Block.Sand);
  });
});

describe("Inventory", () => {
  it("starts empty and counts collected blocks", () => {
    const inv = new Inventory();
    expect(inv.count(Block.Dirt)).toBe(0);
    inv.collect(Block.Dirt);
    inv.collect(Block.Dirt, 3);
    expect(inv.count(Block.Dirt)).toBe(4);
    expect(inv.count(Block.Stone)).toBe(0);
  });

  it("consumes on take and refuses when empty", () => {
    const inv = new Inventory();
    expect(inv.tryTake(Block.Log)).toBe(false);
    inv.collect(Block.Log, 2);
    expect(inv.tryTake(Block.Log)).toBe(true);
    expect(inv.count(Block.Log)).toBe(1);
    expect(inv.tryTake(Block.Log)).toBe(true);
    expect(inv.count(Block.Log)).toBe(0);
    expect(inv.tryTake(Block.Log)).toBe(false);
    expect(inv.count(Block.Log)).toBe(0);
  });

  it("ignores counts in creative mode", () => {
    const inv = new Inventory();
    inv.creative = true;
    expect(inv.count(Block.Brick)).toBe(Number.POSITIVE_INFINITY);
    expect(inv.tryTake(Block.Brick)).toBe(true);
    expect(inv.tryTake(Block.Brick)).toBe(true);
    inv.collect(Block.Brick, 5);
    expect(inv.count(Block.Brick)).toBe(Number.POSITIVE_INFINITY);
  });

  it("survival placement consumes what was mined", () => {
    const inv = new Inventory();
    inv.collect(dropOf(Block.Grass)!);
    expect(inv.count(Block.Dirt)).toBe(1);
    expect(inv.tryTake(Block.Dirt)).toBe(true);
    expect(inv.tryTake(Block.Dirt)).toBe(false);
  });
});
