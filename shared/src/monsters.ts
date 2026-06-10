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
  /** When true, the monster engages from distance using a projectile. */
  ranged?: boolean;
  /** Pixel color of the cast projectile (for client VFX). */
  rangedProjectileColor?: number;
  /** Optional override of attack range (pixels). Defaults to MONSTER_ATTACK_RANGE for melee. */
  rangedAttackRange?: number;
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
    lootTheme: "Ashen",
    ranged: true,
    rangedProjectileColor: 0xff8a4f,
    rangedAttackRange: 200
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
    lootTheme: "Bloodwing",
    ranged: true,
    rangedProjectileColor: 0xff4f7a,
    rangedAttackRange: 220
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
  },
  // ----- biome-specific additions (Sprint 11) -----
  desertScarab: {
    type: "desertScarab",
    name: "Desert Scarab",
    level: 3,
    tint: 0xd6a23a,
    scale: 2.5,
    hpMultiplier: 0.95,
    attackMultiplier: 1,
    defenseMultiplier: 1.3,
    dropRate: 0.42,
    preferredSlots: ["armor", "helmet"],
    lootTheme: "Carapace"
  },
  bogWitch: {
    type: "bogWitch",
    name: "Bog Witch",
    level: 5,
    tint: 0x7aa86a,
    scale: 2.7,
    hpMultiplier: 1.05,
    attackMultiplier: 1.35,
    defenseMultiplier: 0.85,
    dropRate: 0.5,
    preferredSlots: ["weapon", "ring"],
    lootTheme: "Hex"
  },
  tundraYeti: {
    type: "tundraYeti",
    name: "Tundra Yeti",
    level: 6,
    tint: 0xe6eef5,
    scale: 3.1,
    hpMultiplier: 1.55,
    attackMultiplier: 1.3,
    defenseMultiplier: 1.4,
    dropRate: 0.55,
    preferredSlots: ["armor", "boots"],
    lootTheme: "Frost"
  },
  crystalLich: {
    type: "crystalLich",
    name: "Crystal Lich",
    level: 8,
    tint: 0xc79bff,
    scale: 2.95,
    hpMultiplier: 1.45,
    attackMultiplier: 1.7,
    defenseMultiplier: 1.2,
    dropRate: 0.62,
    preferredSlots: ["weapon", "ring", "helmet"],
    lootTheme: "Crystal",
    ranged: true,
    rangedProjectileColor: 0x9bd2ff,
    rangedAttackRange: 240
  },
  // ───── Sprint 35: 4 new biome-locked species ─────
  sandStalker: {
    type: "sandStalker",
    name: "Sand Stalker",
    level: 4,
    tint: 0xc2a857,
    scale: 2.7,
    hpMultiplier: 0.85,
    attackMultiplier: 1.45,
    defenseMultiplier: 0.85,
    dropRate: 0.46,
    preferredSlots: ["weapon", "boots"],
    lootTheme: "Stalker"
  },
  frostWolfAlpha: {
    type: "frostWolfAlpha",
    name: "Frost Wolf Alpha",
    level: 7,
    tint: 0xeaf2ff,
    scale: 3.2,
    hpMultiplier: 1.55,
    attackMultiplier: 1.55,
    defenseMultiplier: 1.25,
    dropRate: 0.58,
    preferredSlots: ["armor", "boots"],
    lootTheme: "AlphaFrost"
  },
  bogLurker: {
    type: "bogLurker",
    name: "Bog Lurker",
    level: 5,
    tint: 0x5c7e3a,
    scale: 2.85,
    hpMultiplier: 1.2,
    attackMultiplier: 1.3,
    defenseMultiplier: 1.1,
    dropRate: 0.48,
    preferredSlots: ["ring", "helmet"],
    lootTheme: "Mire"
  },
  crystalWatcher: {
    type: "crystalWatcher",
    name: "Crystal Watcher",
    level: 9,
    tint: 0xd6b6ff,
    scale: 3.05,
    hpMultiplier: 1.6,
    attackMultiplier: 1.85,
    defenseMultiplier: 1.45,
    dropRate: 0.66,
    preferredSlots: ["armor", "ring"],
    lootTheme: "Watcher",
    ranged: true,
    rangedProjectileColor: 0xcaa4ff,
    rangedAttackRange: 230
  },
  // ── Sprint 211: 3 new monsters (auto-placed by level band) ──
  thornBeast: {
    type: "thornBeast",
    name: "Thorn Beast",
    level: 3,
    tint: 0x6f9e4a,
    scale: 2.7,
    hpMultiplier: 1.0,
    attackMultiplier: 1.1,
    defenseMultiplier: 0.9,
    dropRate: 0.4,
    preferredSlots: ["boots", "armor"],
    lootTheme: "Thorn"
  },
  magmaGolem: {
    type: "magmaGolem",
    name: "Magma Golem",
    level: 7,
    tint: 0xff6a3a,
    scale: 3.1,
    hpMultiplier: 1.7,
    attackMultiplier: 1.5,
    defenseMultiplier: 1.5,
    dropRate: 0.6,
    preferredSlots: ["armor", "weapon"],
    lootTheme: "Magma",
    ranged: true,
    rangedProjectileColor: 0xff7a3a,
    rangedAttackRange: 210
  },
  voidReaper: {
    type: "voidReaper",
    name: "Void Reaper",
    level: 11,
    tint: 0x7a3fd6,
    scale: 3.2,
    hpMultiplier: 1.9,
    attackMultiplier: 2.1,
    defenseMultiplier: 1.5,
    dropRate: 0.7,
    preferredSlots: ["weapon", "ring"],
    lootTheme: "Reaper"
  },
  // ── Sprint 269: monster wave II ──
  frostWraith: {
    type: "frostWraith",
    name: "Frost Wraith",
    level: 5,
    tint: 0x9fd8ff,
    scale: 2.8,
    hpMultiplier: 1.1,
    attackMultiplier: 1.25,
    defenseMultiplier: 0.95,
    dropRate: 0.45,
    preferredSlots: ["ring", "boots"],
    lootTheme: "Wraith"
  },
  sandColossus: {
    type: "sandColossus",
    name: "Sand Colossus",
    level: 9,
    tint: 0xd9b06a,
    scale: 3.4,
    hpMultiplier: 2.1,
    attackMultiplier: 1.4,
    defenseMultiplier: 1.8,
    dropRate: 0.55,
    preferredSlots: ["armor", "boots"],
    lootTheme: "Colossus"
  },
  bloodFiend: {
    type: "bloodFiend",
    name: "Blood Fiend",
    level: 13,
    tint: 0xd83a5a,
    scale: 3.0,
    hpMultiplier: 1.8,
    attackMultiplier: 2.4,
    defenseMultiplier: 1.3,
    dropRate: 0.75,
    preferredSlots: ["weapon", "armor"],
    lootTheme: "Fiend"
  }
};

export function getMonsterDefinition(type: string): MonsterDefinition {
  return MONSTER_DEFINITIONS[type] ?? MONSTER_DEFINITIONS.forestSlime;
}

// Elite affixes (Sprint 212): random stat modifiers that make elites feel
// distinct. Stat-only (no new behaviors) so they're safe to roll anywhere.
export interface EliteAffix { id: string; name: string; hpMult: number; atkMult: number; defMult: number; tint: number; }
export const ELITE_AFFIXES: EliteAffix[] = [
  { id: "fiery",    name: "Cuồng Hỏa",  hpMult: 1.0, atkMult: 1.4, defMult: 1.0, tint: 0xff5a3a },
  { id: "armored",  name: "Giáp Thép",  hpMult: 1.2, atkMult: 1.0, defMult: 1.8, tint: 0x9aa6c0 },
  { id: "giant",    name: "Khổng Lồ",   hpMult: 1.6, atkMult: 1.15, defMult: 1.0, tint: 0xc08a5a },
  { id: "venomous", name: "Kịch Độc",   hpMult: 1.0, atkMult: 1.3, defMult: 1.2, tint: 0x6fd84a },
  // ── Sprint 268: affix wave II ──
  { id: "frenzied", name: "Cuồng Loạn", hpMult: 0.85, atkMult: 1.6, defMult: 0.9, tint: 0xff8ad0 },
  { id: "ancient",  name: "Viễn Cổ",    hpMult: 1.9, atkMult: 1.05, defMult: 1.35, tint: 0xd9c06a }
];
const AFFIX_BY_ID = new Map(ELITE_AFFIXES.map((a) => [a.id, a]));
export function getAffix(id: string | undefined): EliteAffix | undefined {
  return id ? AFFIX_BY_ID.get(id) : undefined;
}
export function affixLabel(id: string | undefined): string | undefined {
  return getAffix(id)?.name;
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
