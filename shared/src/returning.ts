// Sprint 233: Returning-player reward — a warm welcome-back gift after a
// long absence (3+ days), bigger after a week. Pure for testability.

export interface ReturningReward {
  gold: number;
  gems: number;
  /** Days-away threshold this reward corresponds to. */
  days: number;
}

export const RETURNING_TIERS: ReturningReward[] = [
  { days: 7, gold: 4_000, gems: 50 },
  { days: 3, gold: 1_500, gems: 20 }
];

const DAY_MS = 86_400_000;

/** The reward for an absence, or undefined when away < 3 days. */
export function returningRewardFor(offlineMs: number): ReturningReward | undefined {
  if (!Number.isFinite(offlineMs) || offlineMs <= 0) return undefined;
  const days = offlineMs / DAY_MS;
  return RETURNING_TIERS.find((tier) => days >= tier.days);
}
