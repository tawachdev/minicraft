import { HOTBAR, blockName, tileForKind, type BlockId } from "./blocks.js";
import { makeTileCanvas } from "./textures.js";

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
