// Crafting catalog: materials + recipes. Materials drop from monsters
// at a small rate (server-side), recipes are exchanged for epic/rare gear.

import type { EquipmentSlot, MaterialId, Rarity } from "./types.js";

export interface MaterialInfo {
  id: MaterialId;
  name: string;
  rarity: Rarity;
  // monster types that drop this material
  sources: string[];
  value: number;
}

export const MATERIAL_CATALOG: Record<MaterialId, MaterialInfo> = {
  slimeCore: {
    id: "slimeCore",
    name: "Slime Core",
    rarity: "common",
    sources: ["forestSlime", "mossCrawler"],
    value: 8
  },
  wolfFang: {
    id: "wolfFang",
    name: "Wolf Fang",
    rarity: "common",
    sources: ["wildBoar", "direWolf"],
    value: 12
  },
  goblinMark: {
    id: "goblinMark",
    name: "Goblin Mark",
    rarity: "common",
    sources: ["goblinScout", "caveBat"],
    value: 10
  },
  emberHeart: {
    id: "emberHeart",
    name: "Ember Heart",
    rarity: "rare",
    sources: ["stoneImp", "emberSprite", "desertScarab"],
    value: 22
  },
  cursedBark: {
    id: "cursedBark",
    name: "Cursed Bark",
    rarity: "rare",
    sources: ["cursedTreant", "bogWitch"],
    value: 26
  },
  frostShard: {
    id: "frostShard",
    name: "Frost Shard",
    rarity: "rare",
    sources: ["frostRevenant", "tundraYeti", "ashWraith"],
    value: 30
  },
  crystalShard: {
    id: "crystalShard",
    name: "Crystal Shard",
    rarity: "epic",
    sources: ["crystalGolem", "crystalLich"],
    value: 55
  },
  voidAsh: {
    id: "voidAsh",
    name: "Void Ash",
    rarity: "epic",
    sources: ["voidKnight", "bloodHarpy", "ancientDrake", "elderHydra"],
    value: 70
  },
  wardenHeart: {
    id: "wardenHeart",
    name: "Trái Tim Hộ Pháp",
    rarity: "epic",
    sources: ["eternalWarden"],
    value: 250
  }
};

export function materialDropForMonster(monsterType: string): MaterialId | undefined {
  for (const info of Object.values(MATERIAL_CATALOG)) {
    if (info.sources.includes(monsterType)) return info.id;
  }
  return undefined;
}

export interface Recipe {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  // monster level the crafted item is power-scaled against
  level: number;
  // monster type whose loot theme the item borrows
  themeFrom: string;
  cost: Partial<Record<MaterialId, number>>;
}

export const RECIPES: Recipe[] = [
  {
    id: "wanderer-boots",
    name: "Giày Lữ Khách",
    slot: "boots",
    rarity: "rare",
    level: 3,
    themeFrom: "forestSlime",
    cost: { slimeCore: 4, wolfFang: 2 }
  },
  {
    id: "spirit-ring",
    name: "Nhẫn Linh Khí",
    slot: "ring",
    rarity: "rare",
    level: 4,
    themeFrom: "caveBat",
    cost: { goblinMark: 3, cursedBark: 1 }
  },
  {
    id: "storm-helm",
    name: "Mũ Phong Bão",
    slot: "helmet",
    rarity: "rare",
    level: 5,
    themeFrom: "emberSprite",
    cost: { emberHeart: 2, frostShard: 1 }
  },
  {
    id: "ember-blade",
    name: "Kiếm Tàn Hỏa",
    slot: "weapon",
    rarity: "epic",
    level: 6,
    themeFrom: "emberSprite",
    cost: { emberHeart: 3, crystalShard: 1 }
  },
  {
    id: "frozen-armor",
    name: "Giáp Băng Vĩnh Cửu",
    slot: "armor",
    rarity: "epic",
    level: 7,
    themeFrom: "frostRevenant",
    cost: { frostShard: 4, wolfFang: 3 }
  },
  {
    id: "hex-ring",
    name: "Nhẫn Tà Chú",
    slot: "ring",
    rarity: "epic",
    level: 8,
    themeFrom: "cursedTreant",
    cost: { cursedBark: 3, voidAsh: 1 }
  },
  {
    id: "void-blade",
    name: "Kiếm Hư Vô",
    slot: "weapon",
    rarity: "epic",
    level: 9,
    themeFrom: "voidKnight",
    cost: { voidAsh: 5, crystalShard: 2 }
  },
  {
    id: "dragon-helm",
    name: "Mũ Long Vương",
    slot: "helmet",
    rarity: "epic",
    level: 10,
    themeFrom: "ancientDrake",
    cost: { voidAsh: 4, frostShard: 1 }
  },
  {
    id: "crystal-robe",
    name: "Áo Pha Lê",
    slot: "armor",
    rarity: "epic",
    level: 10,
    themeFrom: "crystalGolem",
    cost: { crystalShard: 3, cursedBark: 2, emberHeart: 1 }
  },
  // ───── Endgame tier — require Warden's Heart ─────
  {
    id: "warden-blade",
    name: "Kiếm Hộ Pháp",
    slot: "weapon",
    rarity: "epic",
    level: 12,
    themeFrom: "eternalWarden",
    cost: { wardenHeart: 1, voidAsh: 5, crystalShard: 3 }
  },
  {
    id: "warden-aegis",
    name: "Khiên Vĩnh Cửu",
    slot: "armor",
    rarity: "epic",
    level: 12,
    themeFrom: "eternalWarden",
    cost: { wardenHeart: 1, voidAsh: 4, frostShard: 3 }
  },
  {
    id: "warden-crown",
    name: "Vương Miện Hộ Pháp",
    slot: "helmet",
    rarity: "epic",
    level: 12,
    themeFrom: "eternalWarden",
    cost: { wardenHeart: 1, crystalShard: 4, cursedBark: 2 }
  },
  {
    id: "swift-boots",
    name: "Giày Phong Thần",
    slot: "boots",
    rarity: "epic",
    level: 11,
    themeFrom: "eternalWarden",
    cost: { wardenHeart: 1, frostShard: 4, wolfFang: 4 }
  },
  {
    id: "warden-ring",
    name: "Nhẫn Hộ Pháp",
    slot: "ring",
    rarity: "epic",
    level: 12,
    themeFrom: "eternalWarden",
    cost: { wardenHeart: 2, voidAsh: 3, crystalShard: 2 }
  },
  {
    id: "blood-ring",
    name: "Nhẫn Huyết Vũ",
    slot: "ring",
    rarity: "epic",
    level: 11,
    themeFrom: "bloodHarpy",
    cost: { voidAsh: 4, cursedBark: 3, emberHeart: 2 }
  },
  // Sprint 158: apex recipes — heavy sinks for top-tier salvage materials,
  // closing the salvage → craft → upgrade loop with the strongest gear.
  {
    id: "abyssal-greatsword",
    name: "Đại Kiếm Vực Thẳm",
    slot: "weapon",
    rarity: "epic",
    level: 13,
    themeFrom: "voidKnight",
    cost: { voidAsh: 5, crystalShard: 3, wardenHeart: 2 }
  },
  {
    id: "dragonscale-plate",
    name: "Giáp Vảy Rồng",
    slot: "armor",
    rarity: "epic",
    level: 13,
    themeFrom: "ancientDrake",
    cost: { wardenHeart: 2, emberHeart: 4, frostShard: 3 }
  },
  {
    id: "eternal-signet",
    name: "Ấn Vĩnh Hằng",
    slot: "ring",
    rarity: "epic",
    level: 13,
    themeFrom: "eternalWarden",
    cost: { wardenHeart: 3, voidAsh: 3, crystalShard: 3 }
  },
  // Sprint 192: complete the apex set with helmet + boots.
  {
    id: "abyssal-crown",
    name: "Vương Miện Vực Thẳm",
    slot: "helmet",
    rarity: "epic",
    level: 13,
    themeFrom: "voidKnight",
    cost: { wardenHeart: 2, voidAsh: 4, cursedBark: 3 }
  },
  {
    id: "dragonstride-boots",
    name: "Giày Long Bộ",
    slot: "boots",
    rarity: "epic",
    level: 13,
    themeFrom: "ancientDrake",
    cost: { wardenHeart: 2, frostShard: 4, emberHeart: 3 }
  }
];

// Alchemy brewing (Sprint 171): turn farmed materials into HP potions — a
// utility sink for the common materials that pile up.
export interface BrewRecipe {
  id: string;
  name: string;
  heal: number;
  value: number;
  cost: Partial<Record<MaterialId, number>>;
}
export const BREW_RECIPES: BrewRecipe[] = [
  { id: "minor-potion", name: "Tiểu Hồng Dược", heal: 120, value: 60, cost: { slimeCore: 2 } },
  { id: "greater-potion", name: "Đại Hồng Dược", heal: 280, value: 160, cost: { slimeCore: 3, wolfFang: 2 } }
];
export function getBrewRecipe(id: string): BrewRecipe | undefined {
  return BREW_RECIPES.find((r) => r.id === id);
}

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

// Salvage (Phân Giải): dismantle an equipment item into crafting materials by
// rarity. Yields are modest so salvaging is a way to convert unwanted gear into
// crafting progress, not a faster material faucet than farming.
export function salvageYield(rarity: Rarity): Partial<Record<MaterialId, number>> {
  if (rarity === "epic") return { voidAsh: 1, crystalShard: 1 };
  if (rarity === "rare") return { emberHeart: 1 };
  return { slimeCore: 1 };
}
