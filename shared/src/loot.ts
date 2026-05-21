import type { EquipmentSlot, Item, Rarity, ShopItem } from "./types.js";
import { getMonsterDefinition } from "./monsters.js";

const slots: EquipmentSlot[] = ["weapon", "helmet", "armor", "boots", "ring"];
const prefixes: Record<Rarity, string[]> = {
  common: ["Worn", "Plain", "Sturdy", "Hunter's"],
  rare: ["Glinting", "Veteran", "Runed", "Moonlit"],
  epic: ["Ancient", "Dragonforged", "Celestial", "Mythic"]
};
const names: Record<EquipmentSlot, string[]> = {
  weapon: ["Blade", "Axe", "Staff"],
  helmet: ["Cap", "Helm", "Crown"],
  armor: ["Tunic", "Mail", "Plate"],
  boots: ["Boots", "Greaves", "Treads"],
  ring: ["Band", "Signet", "Loop"]
};

export function rollRarity(): Rarity {
  const roll = Math.random();
  if (roll > 0.965) return "epic";
  if (roll > 0.82) return "rare";
  return "common";
}

export function createLoot(monsterLevel: number, monsterType = "forestSlime"): Item | undefined {
  const monster = getMonsterDefinition(monsterType);
  if (Math.random() > monster.dropRate) return undefined;

  const rarity = rollRarity();
  const slotPool = Math.random() < 0.72 ? monster.preferredSlots : slots;
  const slot = slotPool[Math.floor(Math.random() * slotPool.length)];
  const power = rarity === "epic" ? 3 : rarity === "rare" ? 2 : 1;
  const value = itemValue(monsterLevel, rarity, monster.dropRate, power);
  const item: Item = {
    id: cryptoRandomId(),
    rarity,
    slot,
    name: `${pick(prefixes[rarity])} ${monster.lootTheme} ${pick(names[slot])}`,
    stats: {},
    value
  };

  item.stats = statsFromValue(slot, value, rarity, {
    attack: monster.attackMultiplier,
    defense: monster.defenseMultiplier,
    maxHp: monster.hpMultiplier
  });

  return item;
}

export function createShopStock(): ShopItem[] {
  const offers = [
    ["shop-iron-sword", "Soldier", "weapon", "common", 1, 95],
    ["shop-guard-helm", "Guard", "helmet", "common", 1, 85],
    ["shop-town-mail", "Town", "armor", "common", 2, 140],
    ["shop-traveler-boots", "Traveler", "boots", "common", 2, 120],
    ["shop-signet-ring", "Signet", "ring", "rare", 3, 320],
    ["shop-knight-blade", "Knight", "weapon", "rare", 4, 520],
    ["shop-mythic-plate", "Mythic", "armor", "epic", 6, 1250]
  ] as const;

  return offers.map(([shopId, theme, slot, rarity, level, value]) => ({
    shopId,
    id: cryptoRandomId(),
    name: `${theme} ${pick(names[slot])}`,
    rarity,
    slot,
    value,
    stats: statsFromValue(slot, value, rarity, { attack: 1, defense: 1, maxHp: 1 + level * 0.04 })
  }));
}

function itemValue(monsterLevel: number, rarity: Rarity, dropRate: number, power: number): number {
  const rarityValue = rarity === "epic" ? 90 : rarity === "rare" ? 42 : 14;
  const scarcity = Math.round((1 - dropRate) * 24);
  return Math.max(12, Math.floor(monsterLevel * 18 + rarityValue * power + scarcity + Math.random() * monsterLevel * 10));
}

function statsFromValue(
  slot: EquipmentSlot,
  value: number,
  rarity: Rarity,
  affinity: { attack: number; defense: number; maxHp: number }
): Item["stats"] {
  const rarityPower = rarity === "epic" ? 1.35 : rarity === "rare" ? 1.16 : 1;
  const budget = Math.sqrt(value) * rarityPower;
  const stats: Item["stats"] = {};
  if (slot === "weapon" || slot === "ring") stats.attack = Math.max(1, Math.round(budget * 0.9 * affinity.attack));
  if (slot !== "weapon") stats.defense = Math.max(1, Math.round(budget * 0.62 * affinity.defense));
  if (slot === "armor" || slot === "helmet" || slot === "ring") stats.maxHp = Math.max(8, Math.round(budget * 4.6 * affinity.maxHp));
  return stats;
}

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
