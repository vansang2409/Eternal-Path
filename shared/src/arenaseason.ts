// Sprint 271: Arena seasons — 7-day cycles. Kills accrue per season; when a
// new season starts, last season's haul converts into a gem payout on the
// next login/kill (no global ranking needed, purely personal milestones).

export const ARENA_SEASON_MS = 7 * 86_400_000;

export interface ArenaSeasonTier {
  kills: number;
  gems: number;
}

/** Personal milestone payouts for the FINISHED season (best tier wins). */
export const ARENA_SEASON_TIERS: ArenaSeasonTier[] = [
  { kills: 50, gems: 120 },
  { kills: 25, gems: 60 },
  { kills: 10, gems: 30 },
  { kills: 3, gems: 10 }
];

/** Index of the season containing `now`. */
export function arenaSeasonIndexFor(now: number = Date.now()): number {
  return Math.floor(now / ARENA_SEASON_MS);
}

/** Gem payout for a finished season's kill count (0 when below all tiers). */
export function arenaSeasonRewardGems(kills: number): number {
  for (const tier of ARENA_SEASON_TIERS) {
    if (kills >= tier.kills) return tier.gems;
  }
  return 0;
}
