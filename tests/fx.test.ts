import { beforeEach, describe, expect, it, vi } from "vitest";

// BlockFx draws crack overlays on canvases: stub the 2d context for Node.
const stubCtx = {
  strokeStyle: "",
  lineWidth: 0,
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
};
const stubDocument = {
  createElement: (tag: string) =>
    tag === "canvas"
      ? { width: 0, height: 0, getContext: () => stubCtx }
      : {},
};
vi.stubGlobal("document", stubDocument);

import * as THREE from "three";
import { BlockFx } from "../src/fx.js";

describe("BlockFx lifecycle", () => {
  let fx: BlockFx;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    fx = new BlockFx(scene);
  });

  it("spawns burst particles that are visible immediately", () => {
    fx.burst(0, 0, 0, 0xff0000, 10);
    const visible = scene.children.filter((c) => c.visible).length;
    expect(visible).toBeGreaterThanOrEqual(10);
  });

  it("decays particles once their lifetime passes (regression: update was never called)", () => {
    fx.burst(0, 0, 0, 0xff0000, 10);
    for (let i = 0; i < 10; i++) fx.update(0.2); // 2s total > any particle lifetime
    const stillVisible = scene.children.filter((c) => c.visible).length;
    expect(stillVisible).toBe(0);
  });

  it("hides the crack overlay when mining stops", () => {
    fx.crack(0, 0, 0, 0.5);
    fx.hideCrack();
    const visible = scene.children.filter((c) => c.visible).length;
    expect(visible).toBe(0);
  });

  it("shows the place outline only while the pop is active", () => {
    fx.placePop(0, 0, 0);
    const visibleDuring = scene.children.filter((c) => c.visible).length;
    expect(visibleDuring).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) fx.update(0.1);
    const visibleAfter = scene.children.filter((c) => c.visible).length;
    expect(visibleAfter).toBe(0);
  });
});
