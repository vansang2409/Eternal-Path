// Sprint 285: Cảnh Giới (Paragon) — endless post-game grind. Every 100
// monster kills converts into one permanent point: +1 attack, +5 max HP.
// Points are baked straight into the persisted stat sheet (no re-apply).

export const PARAGON_KILLS_PER_POINT = 100;
export const PARAGON_ATTACK_PER_POINT = 1;
export const PARAGON_HP_PER_POINT = 5;
export const PARAGON_MAX_POINTS = 50;

/** Progress summary for the UI bar. */
export function paragonProgressView(points: number, progress: number): { points: number; into: number; needed: number; maxed: boolean } {
  const maxed = points >= PARAGON_MAX_POINTS;
  return { points, into: maxed ? 0 : progress, needed: maxed ? 0 : PARAGON_KILLS_PER_POINT, maxed };
}
