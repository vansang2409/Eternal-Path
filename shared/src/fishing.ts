// Sprint 221: Fishing — a relaxing gold/material faucet with a cooldown.
// rollFishing is pure (rng injected) so the loot table is unit-testable.

import type { MaterialId } from "./types.js";

export const FISHING_COOLDOWN_MS = 5_000;

export interface FishingResult {
  id: string;
  label: string;
  /** Weight in percent — all entries sum to 100. */
  weight: number;
  gold?: number;
  materialId?: MaterialId;
  /** Server announces giant catches to everyone. */
  announce?: boolean;
}

export const FISHING_TABLE: FishingResult[] = [
  { id: "boot", label: "Chiếc Ủng Rách 🥾", weight: 10 },
  { id: "common-fish", label: "Cá Chép 🐟", weight: 45, gold: 25 },
  { id: "fine-fish", label: "Cá Hồi Vân 🐠", weight: 25, gold: 80 },
  { id: "treasure-weed", label: "Rong Biển Quấn Rương 💰", weight: 10, gold: 150 },
  { id: "ember-catch", label: "Cá Nham Thạch 🔥", weight: 8, materialId: "emberHeart" },
  { id: "giant-fish", label: "CÁ KHỔNG LỒ 🐋", weight: 2, gold: 800, announce: true }
];

/** Sprint 222: a fine-or-better catch is guaranteed on this cast count. */
export const FISHING_PITY_CASTS = 8;

/** Sprint 222: catches that count as "fine or better" (reset the pity). */
export function isFineCatch(id: string): boolean {
  return id === "fine-fish" || id === "treasure-weed" || id === "ember-catch" || id === "giant-fish";
}

/** Roll the fishing table with an injected rng in [0,1). */
export function rollFishing(rng: number): FishingResult {
  const total = FISHING_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let cursor = Math.min(0.999999, Math.max(0, rng)) * total;
  for (const entry of FISHING_TABLE) {
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return FISHING_TABLE[FISHING_TABLE.length - 1];
}
