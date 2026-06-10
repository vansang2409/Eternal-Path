// Sprint 251: personal stash — town-only item storage separate from the bag.
// Sprint 253 sells extra slots for gems.

export const STASH_BASE_SLOTS = 10;
export const STASH_MAX_BONUS = 20;
export const STASH_SLOTS_PER_PURCHASE = 5;
export const STASH_SLOT_GEM_COST = 50;

export function stashCapacity(bonus: number | undefined): number {
  return STASH_BASE_SLOTS + Math.max(0, Math.min(STASH_MAX_BONUS, bonus ?? 0));
}
