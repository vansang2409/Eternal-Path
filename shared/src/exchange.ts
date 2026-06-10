// Sprint 227: material exchange — trade 5 of one material for 1 of the next
// tier. The chain follows the catalog's value progression.

import type { MaterialId } from "./types.js";

export const MATERIAL_UPGRADE_RATIO = 5;

/** Upgrade chain, cheapest → rarest. wardenHeart is the terminal tier. */
export const MATERIAL_UPGRADE_CHAIN: MaterialId[] = [
  "slimeCore",
  "wolfFang",
  "goblinMark",
  "emberHeart",
  "cursedBark",
  "frostShard",
  "crystalShard",
  "voidAsh",
  "wardenHeart"
];

/** The material one tier above, or undefined at the top of the chain. */
export function nextMaterialTier(id: MaterialId): MaterialId | undefined {
  const idx = MATERIAL_UPGRADE_CHAIN.indexOf(id);
  if (idx === -1 || idx === MATERIAL_UPGRADE_CHAIN.length - 1) return undefined;
  return MATERIAL_UPGRADE_CHAIN[idx + 1];
}
