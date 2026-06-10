// Sprint 235: kill-streak combo — chained kills inside a rolling window pay
// a growing gold bonus (+10% per 5 streak, capped at +50%).

export const KILL_STREAK_WINDOW_MS = 8_000;
export const KILL_STREAK_STEP = 5;
export const KILL_STREAK_BONUS_PER_STEP = 0.1;
export const KILL_STREAK_BONUS_CAP = 0.5;

/** Gold bonus rate for a streak count (0.1 per full 5, capped at 0.5). */
export function killStreakGoldBonus(streak: number): number {
  if (!Number.isFinite(streak) || streak < KILL_STREAK_STEP) return 0;
  return Math.min(KILL_STREAK_BONUS_CAP, Math.floor(streak / KILL_STREAK_STEP) * KILL_STREAK_BONUS_PER_STEP);
}
