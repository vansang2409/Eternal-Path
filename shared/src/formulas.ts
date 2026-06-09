import type { AfkZone, Item, SkillId, Stats } from "./types.js";

export const TILE_SIZE = 32;
export const BASE_MAX_STAMINA = 100;
export const SPRINT_DRAIN_PER_SECOND = 32;
export const SPRINT_REGEN_PER_SECOND = 22;
export const SPRINT_MULTIPLIER = 1.8;
export const SPRINT_MIN_STAMINA_TO_START = 8;
export const SKILL_MAX_RANK = 3;
export const SKILL_RANK_BONUS_PER_RANK = 0.25; // +25% effectiveness per rank
export const TALENT_POINTS_PER_LEVEL = 1;

/**
 * Compute the multiplier applied to a skill's primary effect (damage,
 * heal percent, or lifesteal percent) given its current rank 0-3.
 */
export function skillRankMultiplier(rank: number | undefined): number {
  const r = Math.max(0, Math.min(SKILL_MAX_RANK, rank ?? 0));
  return 1 + r * SKILL_RANK_BONUS_PER_RANK;
}

// One in-game day takes 10 real minutes. Time of day = 0..1 where 0 is
// midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset.
export const WORLD_DAY_LENGTH_MS = 10 * 60 * 1000;
export function timeOfDay(serverNow: number): number {
  return (serverNow % WORLD_DAY_LENGTH_MS) / WORLD_DAY_LENGTH_MS;
}

export function dayPhaseAt(time01: number): "dawn" | "day" | "dusk" | "night" {
  // 0.20-0.30 dawn, 0.30-0.70 day, 0.70-0.80 dusk, rest night.
  if (time01 >= 0.2 && time01 < 0.3) return "dawn";
  if (time01 >= 0.3 && time01 < 0.7) return "day";
  if (time01 >= 0.7 && time01 < 0.8) return "dusk";
  return "night";
}
export const WORLD_WIDTH = 200;
export const WORLD_HEIGHT = 150;
export const WORLD_SEED = 1337;
export const PLAYER_SPEED = 165;
export const MONSTER_SPEED = 70;
export const PLAYER_ATTACK_RANGE = 64;
export const MONSTER_ATTACK_RANGE = 36;
export const PLAYER_ATTACK_COOLDOWN_MS = 650;
export const MONSTER_ATTACK_COOLDOWN_MS = 1100;
export const INVENTORY_CAPACITY = 30;
// Bag-slot expansion (Sprint 77 gold sink): buy +5 slots per pack, max +30.
export const BAG_SLOT_PACK = 5;
export const BAG_MAX_BONUS = 30;
/** Escalating gold cost for the next bag pack given the current bonus. */
export function bagUpgradeCost(currentBonus: number): number {
  const packsBought = Math.floor(Math.max(0, currentBonus) / BAG_SLOT_PACK);
  return 3000 * (packsBought + 1);
}
export function bagCapacity(bagBonus: number | undefined): number {
  return INVENTORY_CAPACITY + Math.max(0, Math.min(BAG_MAX_BONUS, bagBonus ?? 0));
}

// Gem → Gold exchange (Sprint 78): premium-currency gold convenience. Gem is
// the scarce/paid currency so this is a Gem sink, not free gold inflation.
export const GEM_TO_GOLD_RATE = 100;
// Personal gold boost potion (Sprint 79): premium +50% gold for 30 min.
export const GOLD_BOOST_GEM_COST = 40;
export const GOLD_BOOST_DURATION_MS = 30 * 60 * 1000;
export const GOLD_BOOST_MULTIPLIER = 1.5;
export function isGoldBoostActive(until: number | undefined, now: number = Date.now()): boolean {
  return typeof until === "number" && until > now;
}
export function gemsToGold(gems: number): number {
  return Math.max(0, Math.floor(gems)) * GEM_TO_GOLD_RATE;
}
// Personal XP boost potion (Sprint 153): premium +50% EXP for 30 min. Stacks
// multiplicatively with VIP and guild EXP perks, speeding up leveling.
export const XP_BOOST_GEM_COST = 40;
export const XP_BOOST_DURATION_MS = 30 * 60 * 1000;
export const XP_BOOST_MULTIPLIER = 1.5;
export function isXpBoostActive(until: number | undefined, now: number = Date.now()): boolean {
  return typeof until === "number" && until > now;
}
// Gold item enhancement (Sprint 155): "+N" upgrade. Cost scales with the next
// level; early levels are guaranteed (sink with certainty) and high levels get
// risky so gold keeps draining at the top end.
export function upgradeCost(plusLevel: number): number {
  return 800 * (Math.max(0, plusLevel) + 1);
}
export function upgradeSuccessChance(plusLevel: number): number {
  return Math.max(0.5, 1 - Math.max(0, plusLevel) * 0.07);
}
export const POWER_STRIKE_COOLDOWN_MS = 4000;
export const POWER_STRIKE_DAMAGE_MULTIPLIER = 2.2;
export const CLEAVE_COOLDOWN_MS = 8000;
export const CLEAVE_DAMAGE_MULTIPLIER = 1.3;
export const CLEAVE_RADIUS = 90;
export const SWIFT_STRIKE_COOLDOWN_MS = 2000;
export const SWIFT_STRIKE_DAMAGE_MULTIPLIER = 1.0;
export const HEAL_COOLDOWN_MS = 12000;
export const HEAL_PERCENT = 0.30;
export const PIERCING_STRIKE_COOLDOWN_MS = 5000;
export const PIERCING_STRIKE_DAMAGE_MULTIPLIER = 1.7;
export const WHIRLWIND_COOLDOWN_MS = 10000;
export const WHIRLWIND_DAMAGE_MULTIPLIER = 1.0;
export const WHIRLWIND_RADIUS = 130;
export const SKILL_LOADOUT_SIZE = 4;
export const DEFAULT_LEARNED_SKILLS: SkillId[] = ["powerStrike", "cleave", "swiftStrike"];
export const DEFAULT_EQUIPPED_SKILLS: SkillId[] = ["powerStrike", "cleave", "swiftStrike"];

export type StatusEffectKind = "burn" | "bleed" | "freeze";

export interface SkillStatusApply {
  kind: StatusEffectKind;
  durationMs: number;
  // For DOT effects: damage per tick (1s tick interval).
  tickDamage?: number;
  // For freeze: movement speed multiplier (e.g. 0.5 = 50% slow).
  slowMultiplier?: number;
}

export interface SkillInfo {
  id: SkillId;
  cooldownMs: number;
  effect: "damageSingle" | "damageAoe" | "healSelf" | "lifestealSingle";
  damageMultiplier?: number;
  aoeRadius?: number;
  healPercent?: number;
  lifestealPercent?: number;
  requiredLevel: number;
  appliesEffect?: SkillStatusApply;
}

export const SKILL_CATALOG: Record<SkillId, SkillInfo> = {
  powerStrike: { id: "powerStrike", cooldownMs: 4000, effect: "damageSingle", damageMultiplier: 2.2, requiredLevel: 1 },
  cleave: { id: "cleave", cooldownMs: 8000, effect: "damageAoe", damageMultiplier: 1.3, aoeRadius: 90, requiredLevel: 1 },
  swiftStrike: { id: "swiftStrike", cooldownMs: 2000, effect: "damageSingle", damageMultiplier: 1.0, requiredLevel: 1 },
  heal: { id: "heal", cooldownMs: 12000, effect: "healSelf", healPercent: 0.30, requiredLevel: 2 },
  piercingStrike: { id: "piercingStrike", cooldownMs: 5000, effect: "damageSingle", damageMultiplier: 1.7, requiredLevel: 3 },
  whirlwind: { id: "whirlwind", cooldownMs: 10000, effect: "damageAoe", damageMultiplier: 1.0, aoeRadius: 130, requiredLevel: 4 },
  swiftBlade: { id: "swiftBlade", cooldownMs: 2500, effect: "damageSingle", damageMultiplier: 1.2, requiredLevel: 4 },
  greaterHeal: { id: "greaterHeal", cooldownMs: 25000, effect: "healSelf", healPercent: 0.50, requiredLevel: 5 },
  lifedrain: { id: "lifedrain", cooldownMs: 8000, effect: "lifestealSingle", damageMultiplier: 1.4, lifestealPercent: 0.50, requiredLevel: 5 },
  flameBurst: { id: "flameBurst", cooldownMs: 9000, effect: "damageAoe", damageMultiplier: 1.6, aoeRadius: 100, requiredLevel: 6,
    appliesEffect: { kind: "burn", durationMs: 4000, tickDamage: 9 } },
  thunderStrike: { id: "thunderStrike", cooldownMs: 12000, effect: "damageSingle", damageMultiplier: 2.5, requiredLevel: 6 },
  icicleStorm: { id: "icicleStorm", cooldownMs: 11000, effect: "damageAoe", damageMultiplier: 1.2, aoeRadius: 140, requiredLevel: 7,
    appliesEffect: { kind: "freeze", durationMs: 2500, slowMultiplier: 0.45 } },
  shadowAssault: { id: "shadowAssault", cooldownMs: 7000, effect: "damageSingle", damageMultiplier: 2.3, requiredLevel: 8,
    appliesEffect: { kind: "bleed", durationMs: 4000, tickDamage: 7 } },
  healingWave: { id: "healingWave", cooldownMs: 18000, effect: "healSelf", healPercent: 0.40, requiredLevel: 8 },
  divineLight: { id: "divineLight", cooldownMs: 15000, effect: "damageSingle", damageMultiplier: 3.0, requiredLevel: 10 },
  voidNova: { id: "voidNova", cooldownMs: 14000, effect: "damageAoe", damageMultiplier: 1.5, aoeRadius: 160, requiredLevel: 12,
    appliesEffect: { kind: "burn", durationMs: 5000, tickDamage: 12 } }
};

export const SKILL_IDS = Object.keys(SKILL_CATALOG) as SkillId[];

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && value in SKILL_CATALOG;
}

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
    gold: 0,
    maxStamina: BASE_MAX_STAMINA,
    stamina: BASE_MAX_STAMINA
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
    // Level-up auto growth is intentionally modest now that players assign
    // three stat points per level on the authoritative server.
    next.maxHp += 12;
    next.attack += 2;
    next.defense += 1;
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
