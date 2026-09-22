import { HOTBAR, blockName, tileForKind, type BlockId } from "./blocks.js";
import type { Inventory } from "./inventory.js";
import { makeTileCanvas } from "./textures.js";

const HEART_PATH = "M8 14.2 1.8 8.1a4 4 0 0 1 0-5.7 4 4 0 0 1 5.7 0L8 2.9l.5-.5a4 4 0 0 1 5.7 0 4 4 0 0 1 0 5.7Z";

/** Row of heart pips for survival mode; each pip is two hit points. */
export class Hearts {
  private readonly root: HTMLElement;
  private readonly pips: SVGSVGElement[] = [];

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "hearts";
    for (let i = 0; i < 10; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 16 15");
      svg.classList.add("heart");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", HEART_PATH);
      svg.appendChild(path);
      this.root.appendChild(svg);
      this.pips.push(svg);
    }
    container.appendChild(this.root);
  }

  set(hp: number): void {
    const full = Math.ceil(hp / 2);
    this.pips.forEach((pip, i) => pip.classList.toggle("off", i >= full));
  }
}

export class Hotbar {
  private selected = 0;
  private readonly slots: HTMLDivElement[] = [];
  private readonly counts: HTMLSpanElement[] = [];

  constructor(container: HTMLElement, private readonly inventory: Inventory) {
    HOTBAR.forEach((block, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";

      const icon = makeTileCanvas(tileForKind(block, "side"));
      slot.appendChild(icon);

      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);

      const count = document.createElement("span");
      count.className = "count";
      slot.appendChild(count);
      this.counts.push(count);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = blockName(block);
      slot.appendChild(name);

      slot.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.select(i);
      });

      container.appendChild(slot);
      this.slots.push(slot);
    });
    this.refresh();
  }

  private refresh(): void {
    this.slots.forEach((s, i) => s.classList.toggle("active", i === this.selected));
    this.slots.forEach((s, i) => {
      const n = this.inventory.count(HOTBAR[i]!);
      const count = this.counts[i]!;
      count.textContent = Number.isFinite(n) && n > 0 ? String(n) : "";
      s.classList.toggle("empty", Number.isFinite(n) && n <= 0);
    });
  }

  collect(id: BlockId, n = 1): void {
    this.inventory.collect(id, n);
    this.refresh();
  }

  /** Try to consume one block for a placement. */
  tryTake(id: BlockId): boolean {
    const taken = this.inventory.tryTake(id);
    if (taken) this.refresh();
    return taken;
  }

  /** Grant a stack (survival /give) and hold the block. */
  grant(id: BlockId, n: number): void {
    this.inventory.collect(id, n);
    this.selectId(id);
  }

  select(index: number): void {
    if (index < 0 || index >= HOTBAR.length) return;
    this.selected = index;
    this.refresh();
  }

  selectId(id: BlockId): void {
    this.select(HOTBAR.indexOf(id));
  }

  cycle(delta: number): void {
    const n = HOTBAR.length;
    this.selected = (this.selected + delta + n) % n;
    this.refresh();
  }

  get block(): BlockId {
    return HOTBAR[this.selected]!;
  }

  get name(): string {
    return blockName(this.block);
  }
}
