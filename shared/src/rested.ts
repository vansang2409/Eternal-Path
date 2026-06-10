// Sprint 219: Rested XP — players accrue a bonus-XP pool while offline.
// Monster-kill EXP drains the pool at +50% until it runs out (classic MMO
// retention mechanic: log back in, level faster for a while).

/** Pool points gained per hour offline (proportional below one hour). */
export const RESTED_XP_PER_HOUR = 200;
/** Pool cap — 24 hours of accrual. */
export const RESTED_XP_CAP = RESTED_XP_PER_HOUR * 24;
/** Bonus rate applied to kill EXP while the pool lasts. */
export const RESTED_BONUS_RATE = 0.5;

/** Rested pool earned for a given offline duration (ms), pre-cap. */
export function restedXpForOffline(offlineMs: number): number {
  if (!Number.isFinite(offlineMs) || offlineMs <= 0) return 0;
  return Math.min(RESTED_XP_CAP, Math.floor((offlineMs / 3_600_000) * RESTED_XP_PER_HOUR));
}

/** Bonus EXP for one kill given the current pool. */
export function restedBonusFor(pool: number, baseExp: number): number {
  if (pool <= 0 || baseExp <= 0) return 0;
  return Math.min(pool, Math.round(baseExp * RESTED_BONUS_RATE));
}
