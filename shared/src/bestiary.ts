// Sprint 217: Bestiary — per-monster-type lifetime kill tracking with tiered
// rewards. Pure data + helpers so both server (reward grants) and client
// (progress UI) stay in sync.

export interface BestiaryTier {
  /** 1-based tier number (1 = Bronze, 2 = Silver, 3 = Gold). */
  tier: number;
  name: string;
  /** Lifetime kills of one monster type required to reach this tier. */
  kills: number;
  reward: { gold?: number; gems?: number };
}

export const BESTIARY_TIERS: BestiaryTier[] = [
  { tier: 1, name: "Đồng", kills: 10, reward: { gold: 300 } },
  { tier: 2, name: "Bạc", kills: 50, reward: { gems: 10 } },
  { tier: 3, name: "Vàng", kills: 200, reward: { gems: 25 } }
];

/** Highest tier number reached for a kill count (0 = none yet). */
export function bestiaryTierForKills(kills: number): number {
  let reached = 0;
  for (const tier of BESTIARY_TIERS) {
    if (kills >= tier.kills) reached = tier.tier;
  }
  return reached;
}

export function bestiaryTierByNumber(tier: number): BestiaryTier | undefined {
  return BESTIARY_TIERS.find((t) => t.tier === tier);
}

/** The next tier the player is working toward (undefined when maxed). */
export function nextBestiaryTier(kills: number): BestiaryTier | undefined {
  return BESTIARY_TIERS.find((t) => kills < t.kills);
}
