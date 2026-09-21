import { describe, expect, it } from "vitest";
import { Mob } from "../src/mobs.js";

describe("mob combat", () => {
  it("dies on the second hit, not the first", () => {
    const mob = new Mob("pig", 5, 12, 5, 2);
    expect(mob.hp).toBe(2);
    expect(mob.damage(1000)).toBe(false);
    expect(mob.damage(1000)).toBe(true);
  });
});
