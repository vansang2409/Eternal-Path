// Sprint 231: Piggy Bank — every monster kill drips gold into a piggy that
// can only be opened with gems (classic soft-monetization sink).

export const PIGGY_GOLD_PER_KILL = 2;
export const PIGGY_GOLD_CAP = 5_000;
export const PIGGY_BREAK_GEM_COST = 25;

/** Piggy balance after one kill (capped). */
export function piggyAfterKill(current: number): number {
  return Math.min(PIGGY_GOLD_CAP, Math.max(0, current) + PIGGY_GOLD_PER_KILL);
}

/** True when the piggy is worth breaking (UI hint). */
export function piggyIsFull(current: number): boolean {
  return current >= PIGGY_GOLD_CAP;
}
