import { HOTBAR, blockName, tileForKind, type BlockId } from "./blocks.js";
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

  constructor(container: HTMLElement) {
    HOTBAR.forEach((block, i) => {
      const slot = document.createElement("div");
      slot.className = "slot";

      const icon = makeTileCanvas(tileForKind(block, "side"));
      slot.appendChild(icon);

      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = blockName(block);
      slot.appendChild(name);

      container.appendChild(slot);
      this.slots.push(slot);
    });
    this.refresh();
  }

  private refresh(): void {
    this.slots.forEach((s, i) => s.classList.toggle("active", i === this.selected));
  }

  select(index: number): void {
    if (index < 0 || index >= HOTBAR.length) return;
    this.selected = index;
    this.refresh();
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
