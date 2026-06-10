// Sprint 281: Trial Tower — a deterministic solo gear-check climb. Each
// floor compares the player's power score against a requirement curve; wins
// advance the floor and pay gold (gems every 5th floor). 3 tickets per day.

export const TOWER_TICKETS_PER_DAY = 3;
export const TOWER_GEM_EVERY = 5;
export const TOWER_GEM_REWARD = 10;

/** Aggregate power score used by the tower (mirrors visible stats). */
export function playerPowerScore(stats: { attack: number; defense: number; maxHp: number }): number {
  return Math.round(stats.attack * 3 + stats.defense * 2 + stats.maxHp / 10);
}

/** Power required to clear a floor (1-based). */
export function towerRequirement(floor: number): number {
  const f = Math.max(1, floor);
  return 60 + f * 25 + f * f * 3;
}

/** Gold paid for clearing a floor. */
export function towerRewardGold(floor: number): number {
  return 200 + Math.max(1, floor) * 60;
}
