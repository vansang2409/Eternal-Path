// Daily login streak calendar (Sprint 61).
//
// Distinct from the 20h-cooldown daily Gem (cosmetics.ts) and the VIP daily.
// This is a 7-day escalating calendar: claim once per calendar day; claiming
// on consecutive days advances the streak (wrapping every 7 days), missing a
// day resets it to 1. The streak math is a pure function so it can be unit
// tested exhaustively without a server or real clock.

export interface StreakReward {
  day: number; // 1..7
  gold: number;
  gems: number;
  label: string;
}

export const STREAK_CYCLE_DAYS = 7;

export const STREAK_REWARDS: StreakReward[] = [
  { day: 1, gold: 200, gems: 0, label: "200 vàng" },
  { day: 2, gold: 400, gems: 0, label: "400 vàng" },
  { day: 3, gold: 0, gems: 20, label: "20 Gem" },
  { day: 4, gold: 600, gems: 0, label: "600 vàng" },
  { day: 5, gold: 0, gems: 40, label: "40 Gem" },
  { day: 6, gold: 1000, gems: 0, label: "1000 vàng" },
  { day: 7, gold: 0, gems: 100, label: "100 Gem 🎁" }
];

/** UTC date key (YYYY-MM-DD) for a timestamp — matches vipLastDailyDate. */
export function dateKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Add (or subtract) whole days to a YYYY-MM-DD key, returning a new key. */
export function dateKeyAddDays(key: string, delta: number): string {
  const ms = Date.parse(`${key}T00:00:00.000Z`);
  return new Date(ms + delta * 86_400_000).toISOString().slice(0, 10);
}

/** Reward for a given streak count (1-based), wrapping every 7 days. */
export function streakRewardFor(streak: number): StreakReward {
  const idx = ((Math.max(1, streak) - 1) % STREAK_CYCLE_DAYS);
  return STREAK_REWARDS[idx];
}

export interface StreakClaimResult {
  canClaim: boolean;
  /** "ok" | "alreadyClaimed" */
  reason: "ok" | "alreadyClaimed";
  /** Streak after a successful claim (unchanged if cannot claim). */
  newStreak: number;
  /** Reward granted on a successful claim. */
  reward?: StreakReward;
}

/**
 * Pure streak transition.
 * @param lastClaimDate  YYYY-MM-DD of the previous claim, or undefined.
 * @param todayKey       YYYY-MM-DD for "now".
 * @param currentStreak  the player's stored streak count.
 */
export function computeStreakClaim(
  lastClaimDate: string | undefined,
  todayKey: string,
  currentStreak: number
): StreakClaimResult {
  if (lastClaimDate === todayKey) {
    return { canClaim: false, reason: "alreadyClaimed", newStreak: currentStreak };
  }
  const yesterday = dateKeyAddDays(todayKey, -1);
  const continued = lastClaimDate === yesterday;
  const newStreak = continued ? Math.max(1, currentStreak) + 1 : 1;
  return { canClaim: true, reason: "ok", newStreak, reward: streakRewardFor(newStreak) };
}

/** Whether the player can claim today (for client button state). */
export function canClaimStreakToday(lastClaimDate: string | undefined, todayKey: string = dateKey()): boolean {
  return lastClaimDate !== todayKey;
}
