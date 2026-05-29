import type { AfkZone, Item, Stats } from "./types.js";

export const TILE_SIZE = 32;
export const WORLD_WIDTH = 48;
export const WORLD_HEIGHT = 32;
export const PLAYER_SPEED = 165;
export const MONSTER_SPEED = 70;
export const PLAYER_ATTACK_RANGE = 42;
export const MONSTER_ATTACK_RANGE = 36;
export const PLAYER_ATTACK_COOLDOWN_MS = 650;
export const MONSTER_ATTACK_COOLDOWN_MS = 1100;
export const INVENTORY_CAPACITY = 30;
export const POWER_STRIKE_COOLDOWN_MS = 4000;
export const POWER_STRIKE_DAMAGE_MULTIPLIER = 2.2;
export const CLEAVE_COOLDOWN_MS = 8000;
export const CLEAVE_DAMAGE_MULTIPLIER = 1.3;
export const CLEAVE_RADIUS = 90;
export const DEFAULT_AFK_ZONE: AfkZone = "greenwood";
export const OFFLINE_REWARD_MIN_MS = 5 * 60 * 1000;
export const OFFLINE_REWARD_MAX_MS = 8 * 60 * 60 * 1000;

// Offline rewards are intentionally lower than active farming: about a few
// kills per hour at the zone's effective level, enough to feel useful without
// replacing online play.
export const AFK_ZONE_DEFINITIONS: Array<{ id: AfkZone; effectiveLevel: number; expPerHour: number; goldPerHour: number }> = [
  { id: "greenwood", effectiveLevel: 2, expPerHour: 120, goldPerHour: 50 },
  { id: "midlands", effectiveLevel: 4, expPerHour: 240, goldPerHour: 100 },
  { id: "deeplands", effectiveLevel: 7, expPerHour: 420, goldPerHour: 175 }
];
const AFK_ZONE_IDS = new Set<AfkZone>(AFK_ZONE_DEFINITIONS.map((zone) => zone.id));

export function isAfkZone(value: unknown): value is AfkZone {
  return typeof value === "string" && AFK_ZONE_IDS.has(value as AfkZone);
}

export function afkZoneDefinition(zone: AfkZone): { id: AfkZone; effectiveLevel: number; expPerHour: number; goldPerHour: number } {
  return AFK_ZONE_DEFINITIONS.find((definition) => definition.id === zone) ?? AFK_ZONE_DEFINITIONS[0];
}

export function offlineRewardsFor(zone: AfkZone, elapsedMs: number): { exp: number; gold: number } {
  const definition = afkZoneDefinition(zone);
  const hours = Math.max(0, elapsedMs) / (60 * 60 * 1000);
  return {
    exp: Math.floor(definition.expPerHour * hours),
    gold: Math.floor(definition.goldPerHour * hours)
  };
}

export function expToNextLevel(level: number): number {
  return Math.floor(60 + level * level * 38);
}

export function baseStatsForLevel(level: number): Stats {
  return {
    level,
    exp: 0,
    maxHp: 110 + (level - 1) * 22,
    hp: 110 + (level - 1) * 22,
    attack: 12 + (level - 1) * 4,
    defense: 5 + (level - 1) * 2,
    gold: 0
  };
}

export function applyEquipmentStats(stats: Stats, items: Item[]): Stats {
  const boosted = { ...stats };
  for (const item of items) {
    if (item.kind !== "equipment") continue;
    boosted.attack += item.stats.attack ?? 0;
    boosted.defense += item.stats.defense ?? 0;
    boosted.maxHp += item.stats.maxHp ?? 0;
  }
  boosted.hp = Math.min(boosted.hp, boosted.maxHp);
  return boosted;
}

export function rollDamage(attack: number, defense: number, levelGap = 0): { damage: number; crit: boolean } {
  const variance = 0.85 + Math.random() * 0.3;
  const mitigated = Math.max(1, attack * variance - defense * 0.55);
  const critChance = Math.min(0.3, 0.06 + Math.max(0, levelGap) * 0.015);
  const crit = Math.random() < critChance;
  return { damage: Math.floor(mitigated * (crit ? 1.7 : 1)), crit };
}

export function grantExp(stats: Stats, amount: number): { stats: Stats; leveled: boolean } {
  const next = { ...stats, exp: stats.exp + amount };
  let leveled = false;
  while (next.exp >= expToNextLevel(next.level)) {
    next.exp -= expToNextLevel(next.level);
    next.level += 1;
    next.maxHp += 24;
    next.attack += 4;
    next.defense += 2;
    next.hp = next.maxHp;
    leveled = true;
  }
  return { stats: next, leveled };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clampToWorld(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(16, Math.min(WORLD_WIDTH * TILE_SIZE - 16, position.x)),
    y: Math.max(16, Math.min(WORLD_HEIGHT * TILE_SIZE - 16, position.y))
  };
}
