import type { BlockId } from "./blocks.js";

/**
 * Blocks the player has collected. Creative mode ignores counts: every
 * placement succeeds and mining adds nothing. Survival placements consume.
 */
export class Inventory {
  private readonly counts = new Map<BlockId, number>();
  creative = false;

  collect(id: BlockId, n = 1): void {
    this.counts.set(id, (this.counts.get(id) ?? 0) + n);
  }

  count(id: BlockId): number {
    if (this.creative) return Number.POSITIVE_INFINITY;
    return this.counts.get(id) ?? 0;
  }

  tryTake(id: BlockId): boolean {
    if (this.creative) return true;
    const have = this.counts.get(id) ?? 0;
    if (have <= 0) return false;
    this.counts.set(id, have - 1);
    return true;
  }
}
