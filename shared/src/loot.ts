import type { EquipmentSlot, EquipmentItem, Item, ItemStats, Rarity, ShopItem } from "./types.js";
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

/** Sprint 237: a rare-or-better drop is guaranteed after this many dry kills. */
export const LOOT_PITY_KILLS = 30;

export function createLoot(monsterLevel: number, monsterType = "forestSlime", elite = false, guaranteed = false): Item | undefined {
  const monster = getMonsterDefinition(monsterType);
  const dropRate = elite ? Math.min(0.95, monster.dropRate + 0.35) : monster.dropRate;
  if (!guaranteed && Math.random() > dropRate) return undefined;

  const rarity = elite || guaranteed ? rollEliteRarity() : rollRarity();
  const slotPool = Math.random() < 0.72 ? monster.preferredSlots : slots;
  const slot = slotPool[Math.floor(Math.random() * slotPool.length)];
  const power = rarity === "epic" ? 3 : rarity === "rare" ? 2 : 1;
  const value = itemValue(monsterLevel, rarity, dropRate, power);
  const item: EquipmentItem = {
    id: cryptoRandomId(),
    kind: "equipment",
    rarity,
    slot,
    name: `${pick(prefixes[rarity])} ${monster.lootTheme} ${pick(names[slot])}`,
    stats: statsFromValue(slot, value, rarity, {
      attack: monster.attackMultiplier,
      defense: monster.defenseMultiplier,
      maxHp: monster.hpMultiplier
    }),
    value,
    themeId: monster.lootTheme
  };

  return item;
}

function rollEliteRarity(): Rarity {
  return Math.random() > 0.78 ? "epic" : "rare";
}

export function createShopStock(): ShopItem[] {
  const equipmentOffers = [
    ["shop-iron-sword", "Soldier", "weapon", "common", 1, 95],
    ["shop-guard-helm", "Guard", "helmet", "common", 1, 85],
    ["shop-town-mail", "Town", "armor", "common", 2, 140],
    ["shop-traveler-boots", "Traveler", "boots", "common", 2, 120],
    ["shop-signet-ring", "Signet", "ring", "rare", 3, 320],
    ["shop-knight-blade", "Knight", "weapon", "rare", 4, 520],
    ["shop-mythic-plate", "Mythic", "armor", "epic", 6, 1250]
  ] as const;

  const equipment = equipmentOffers.map(([shopId, theme, slot, rarity, level, value]) => ({
    shopId,
    id: cryptoRandomId(),
    kind: "equipment" as const,
    name: `${theme} ${pick(names[slot])}`,
    rarity,
    slot,
    value,
    stats: statsFromValue(slot, value, rarity, { attack: 1, defense: 1, maxHp: 1 + level * 0.04 })
  }));
  const potions: ShopItem[] = [
    {
      shopId: "shop-minor-potion",
      id: cryptoRandomId(),
      kind: "consumable",
      name: "Minor HP Potion",
      rarity: "common",
      value: 28,
      heal: 45
    },
    {
      shopId: "shop-major-potion",
      id: cryptoRandomId(),
      kind: "consumable",
      name: "Major HP Potion",
      rarity: "rare",
      value: 95,
      heal: 130
    }
  ];
  return [...equipment, ...potions];
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
): ItemStats {
  const rarityPower = rarity === "epic" ? 1.35 : rarity === "rare" ? 1.16 : 1;
  const budget = Math.sqrt(value) * rarityPower;
  const stats: ItemStats = {};
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
