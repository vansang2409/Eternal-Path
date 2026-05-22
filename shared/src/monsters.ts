import type { EquipmentSlot } from "./types.js";

export interface MonsterDefinition {
  type: string;
  name: string;
  level: number;
  tint: number;
  scale: number;
  hpMultiplier: number;
  attackMultiplier: number;
  defenseMultiplier: number;
  dropRate: number;
  preferredSlots: EquipmentSlot[];
  lootTheme: string;
}

export const MONSTER_DEFINITIONS: Record<string, MonsterDefinition> = {
  forestSlime: {
    type: "forestSlime",
    name: "Forest Slime",
    level: 1,
    tint: 0x75d66f,
    scale: 2.4,
    hpMultiplier: 0.8,
    attackMultiplier: 0.8,
    defenseMultiplier: 0.7,
    dropRate: 0.38,
    preferredSlots: ["boots", "ring"],
    lootTheme: "Forest"
  },
  wildBoar: {
    type: "wildBoar",
    name: "Wild Boar",
    level: 1,
    tint: 0xb97946,
    scale: 2.75,
    hpMultiplier: 1,
    attackMultiplier: 0.9,
    defenseMultiplier: 0.9,
    dropRate: 0.35,
    preferredSlots: ["helmet", "boots"],
    lootTheme: "Hide"
  },
  caveBat: {
    type: "caveBat",
    name: "Cave Bat",
    level: 2,
    tint: 0x6a5c93,
    scale: 2.25,
    hpMultiplier: 0.75,
    attackMultiplier: 1.25,
    defenseMultiplier: 0.65,
    dropRate: 0.36,
    preferredSlots: ["ring", "weapon"],
    lootTheme: "Echo"
  },
  goblinScout: {
    type: "goblinScout",
    name: "Goblin Scout",
    level: 2,
    tint: 0x8fd36b,
    scale: 2.8,
    hpMultiplier: 0.95,
    attackMultiplier: 1,
    defenseMultiplier: 0.85,
    dropRate: 0.44,
    preferredSlots: ["weapon", "boots"],
    lootTheme: "Raider"
  },
  direWolf: {
    type: "direWolf",
    name: "Dire Wolf",
    level: 3,
    tint: 0x9aa7b2,
    scale: 3,
    hpMultiplier: 1.05,
    attackMultiplier: 1.15,
    defenseMultiplier: 0.9,
    dropRate: 0.42,
    preferredSlots: ["weapon", "armor"],
    lootTheme: "Fang"
  },
  mossCrawler: {
    type: "mossCrawler",
    name: "Moss Crawler",
    level: 3,
    tint: 0x497c55,
    scale: 3.15,
    hpMultiplier: 1.3,
    attackMultiplier: 0.9,
    defenseMultiplier: 1.2,
    dropRate: 0.4,
    preferredSlots: ["armor", "helmet"],
    lootTheme: "Moss"
  },
  stoneImp: {
    type: "stoneImp",
    name: "Stone Imp",
    level: 4,
    tint: 0x8e8a7d,
    scale: 2.95,
    hpMultiplier: 1.1,
    attackMultiplier: 1,
    defenseMultiplier: 1.35,
    dropRate: 0.46,
    preferredSlots: ["helmet", "armor"],
    lootTheme: "Stone"
  },
  emberSprite: {
    type: "emberSprite",
    name: "Ember Sprite",
    level: 4,
    tint: 0xff7b45,
    scale: 2.55,
    hpMultiplier: 0.85,
    attackMultiplier: 1.35,
    defenseMultiplier: 0.8,
    dropRate: 0.45,
    preferredSlots: ["weapon", "ring"],
    lootTheme: "Ember"
  },
  cursedTreant: {
    type: "cursedTreant",
    name: "Cursed Treant",
    level: 5,
    tint: 0x6d4f2f,
    scale: 3.45,
    hpMultiplier: 1.45,
    attackMultiplier: 1,
    defenseMultiplier: 1.25,
    dropRate: 0.48,
    preferredSlots: ["armor", "ring"],
    lootTheme: "Rootbound"
  },
  ashWraith: {
    type: "ashWraith",
    name: "Ash Wraith",
    level: 6,
    tint: 0xa59bb6,
    scale: 3.1,
    hpMultiplier: 0.95,
    attackMultiplier: 1.45,
    defenseMultiplier: 1,
    dropRate: 0.5,
    preferredSlots: ["ring", "weapon"],
    lootTheme: "Ashen"
  },
  frostRevenant: {
    type: "frostRevenant",
    name: "Frost Revenant",
    level: 6,
    tint: 0x83d8ff,
    scale: 3.2,
    hpMultiplier: 1.1,
    attackMultiplier: 1.25,
    defenseMultiplier: 1.2,
    dropRate: 0.5,
    preferredSlots: ["helmet", "armor"],
    lootTheme: "Frost"
  },
  crystalGolem: {
    type: "crystalGolem",
    name: "Crystal Golem",
    level: 7,
    tint: 0x77d9d7,
    scale: 3.75,
    hpMultiplier: 1.65,
    attackMultiplier: 1.05,
    defenseMultiplier: 1.55,
    dropRate: 0.54,
    preferredSlots: ["armor", "helmet", "ring"],
    lootTheme: "Crystal"
  },
  bloodHarpy: {
    type: "bloodHarpy",
    name: "Blood Harpy",
    level: 7,
    tint: 0xd7525f,
    scale: 3.25,
    hpMultiplier: 1,
    attackMultiplier: 1.65,
    defenseMultiplier: 1,
    dropRate: 0.54,
    preferredSlots: ["weapon", "boots"],
    lootTheme: "Bloodwing"
  },
  ancientDrake: {
    type: "ancientDrake",
    name: "Ancient Drake",
    level: 8,
    tint: 0xd19142,
    scale: 4.15,
    hpMultiplier: 1.8,
    attackMultiplier: 1.55,
    defenseMultiplier: 1.35,
    dropRate: 0.62,
    preferredSlots: ["weapon", "armor", "ring"],
    lootTheme: "Drake"
  },
  voidKnight: {
    type: "voidKnight",
    name: "Void Knight",
    level: 9,
    tint: 0x5c4fa3,
    scale: 3.7,
    hpMultiplier: 1.6,
    attackMultiplier: 1.75,
    defenseMultiplier: 1.5,
    dropRate: 0.66,
    preferredSlots: ["weapon", "helmet", "armor"],
    lootTheme: "Voidforged"
  },
  elderHydra: {
    type: "elderHydra",
    name: "Elder Hydra",
    level: 10,
    tint: 0x2fa98d,
    scale: 4.35,
    hpMultiplier: 2.1,
    attackMultiplier: 1.7,
    defenseMultiplier: 1.65,
    dropRate: 0.7,
    preferredSlots: ["weapon", "armor", "ring"],
    lootTheme: "Hydra"
  },
  eternalWarden: {
    type: "eternalWarden",
    name: "Eternal Warden",
    level: 12,
    tint: 0xffd36b,
    scale: 5.2,
    hpMultiplier: 3.2,
    attackMultiplier: 2.1,
    defenseMultiplier: 2,
    dropRate: 1,
    preferredSlots: ["weapon", "armor", "ring"],
    lootTheme: "Warden"
  }
};

export function getMonsterDefinition(type: string): MonsterDefinition {
  return MONSTER_DEFINITIONS[type] ?? MONSTER_DEFINITIONS.forestSlime;
}

export function monsterMaxHp(definition: MonsterDefinition, elite = false): number {
  const base = Math.floor((42 + definition.level * 36 + definition.level * definition.level * 4) * definition.hpMultiplier);
  return elite ? Math.floor(base * 2.2) : base;
}

export function monsterAttack(definition: MonsterDefinition, elite = false): number {
  const base = Math.floor((7 + definition.level * 5) * definition.attackMultiplier);
  return elite ? Math.floor(base * 1.5) : base;
}

export function monsterDefense(definition: MonsterDefinition, elite = false): number {
  const base = Math.floor((2 + definition.level * 3) * definition.defenseMultiplier);
  return elite ? Math.floor(base * 1.3) : base;
}
