// Mystery Box / gacha (Sprint 68).
//
// A Gem-purchased box rolls a weighted reward: gold, gems, a cosmetic, or a
// pet. The roll is a pure function with an injectable RNG so it can be unit
// tested deterministically. Duplicate cosmetic/pet rewards are converted to
// Gem by the server (see MYSTERY_DUP_GEMS).

import { COSMETICS } from "./cosmetics.js";
import { PET_CATALOG } from "./pets.js";

export const MYSTERY_BOX_GEM_COST = 50;
/** Gem compensation when a rolled cosmetic/pet is already owned. */
export const MYSTERY_DUP_GEMS = 30;

export type MysteryRewardKind = "gold" | "gems" | "cosmetic" | "pet";

export interface MysteryReward {
  kind: MysteryRewardKind;
  /** For gold/gems: the amount. */
  amount?: number;
  /** For cosmetic/pet: the catalog id. */
  id?: string;
  /** Human label for the reveal UI. */
  label: string;
}

/** Cosmetic/pet pools the box can award (Gem-priced entries only). */
export const MYSTERY_COSMETIC_POOL = COSMETICS.filter((c) => c.gemPrice > 0).map((c) => c.id);
export const MYSTERY_PET_POOL = PET_CATALOG.filter((p) => p.gemPrice > 0).map((p) => p.id);

const COSMETIC_NAME = new Map(COSMETICS.map((c) => [c.id, c.name]));
const PET_NAME = new Map(PET_CATALOG.map((p) => [p.id, p.name]));

/**
 * Roll a reward. `rng` should return [0,1). Two draws are used: one to pick
 * the category, one to pick the magnitude / specific item.
 * Weights: 40% gold, 25% gems, 25% cosmetic, 10% pet.
 */
export function rollMysteryBox(rng: () => number = Math.random): MysteryReward {
  const r = rng();
  const pick = rng();
  if (r < 0.4) {
    const amount = 1000 + Math.floor(pick * 9) * 500; // 1000..5000
    return { kind: "gold", amount, label: `${amount.toLocaleString("vi-VN")} vàng` };
  }
  if (r < 0.65) {
    const amount = 20 + Math.floor(pick * 5) * 10; // 20..60
    return { kind: "gems", amount, label: `${amount} 💎` };
  }
  if (r < 0.9 && MYSTERY_COSMETIC_POOL.length > 0) {
    const id = MYSTERY_COSMETIC_POOL[Math.floor(pick * MYSTERY_COSMETIC_POOL.length) % MYSTERY_COSMETIC_POOL.length];
    return { kind: "cosmetic", id, label: `Cosmetic: ${COSMETIC_NAME.get(id) ?? id}` };
  }
  if (MYSTERY_PET_POOL.length > 0) {
    const id = MYSTERY_PET_POOL[Math.floor(pick * MYSTERY_PET_POOL.length) % MYSTERY_PET_POOL.length];
    return { kind: "pet", id, label: `Linh thú: ${PET_NAME.get(id) ?? id}` };
  }
  // Fallback if pools are empty: gems.
  return { kind: "gems", amount: 30, label: "30 💎" };
}
