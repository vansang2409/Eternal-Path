// Sprint 241: Treasure maps — rare kill drops that "dig up" instant riches
// when used. Factory + roll helpers are pure for tests.

import type { ConsumableItem } from "./types.js";

export const TREASURE_MAP_DROP_RATE = 0.02;
export const TREASURE_GOLD_MIN = 400;
export const TREASURE_GOLD_MAX = 900;

/** Gold dug up for an rng in [0,1). */
export function rollTreasureGold(rng: number): number {
  const r = Math.min(0.999999, Math.max(0, rng));
  return TREASURE_GOLD_MIN + Math.floor(r * (TREASURE_GOLD_MAX - TREASURE_GOLD_MIN + 1));
}

/** Build a fresh treasure-map inventory item. */
export function makeTreasureMapItem(): ConsumableItem {
  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "consumable",
    name: "Bản Đồ Kho Báu",
    rarity: "rare",
    heal: 0,
    treasureMap: true,
    value: 250
  };
}
