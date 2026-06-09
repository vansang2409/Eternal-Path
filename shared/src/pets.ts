// Pet / companion system (Sprint 63).
//
// A pet follows the player and grants a small passive stat buff (attack /
// defense / maxHp) applied with the same subtract-old/add-new bookkeeping as
// set bonuses. Cheaper pets cost gold; premium pets cost Gem. The buff fields
// (petBonus*) are PERSISTED so a relogin doesn't double-count the bonus that
// is already baked into the saved stats.

export type PetRarity = "common" | "rare" | "epic";

export interface PetBuff {
  attack?: number;
  defense?: number;
  maxHp?: number;
}

export interface PetDef {
  id: string;
  name: string;
  desc: string;
  rarity: PetRarity;
  /** Gold price (0 if the pet is Gem-only). */
  goldPrice: number;
  /** Gem price (0 if the pet is gold-only). */
  gemPrice: number;
  buff: PetBuff;
  /** Tint (hex int) used for the little companion sprite. */
  color: number;
}

export const PET_CATALOG: PetDef[] = [
  { id: "slime", name: "Tiểu Slime", desc: "+3 công", rarity: "common", goldPrice: 2000, gemPrice: 0, buff: { attack: 3 }, color: 0x8ce28c },
  { id: "wolf", name: "Sói Con", desc: "+4 công, +2 thủ", rarity: "common", goldPrice: 5000, gemPrice: 0, buff: { attack: 4, defense: 2 }, color: 0x9aa0a6 },
  { id: "owl", name: "Cú Thông Thái", desc: "+40 HP", rarity: "rare", goldPrice: 9000, gemPrice: 0, buff: { maxHp: 40 }, color: 0xc9a36a },
  { id: "spirit", name: "Linh Hồ", desc: "+5 công, +5 thủ, +60 HP", rarity: "epic", goldPrice: 0, gemPrice: 200, buff: { attack: 5, defense: 5, maxHp: 60 }, color: 0xc79bff },
  { id: "drake", name: "Tiểu Long", desc: "+6 công, +3 thủ, +50 HP", rarity: "epic", goldPrice: 0, gemPrice: 150, buff: { attack: 6, defense: 3, maxHp: 50 }, color: 0xff7b5a },
  { id: "phoenix", name: "Phượng Hoàng", desc: "+10 công, +5 thủ, +100 HP", rarity: "epic", goldPrice: 0, gemPrice: 300, buff: { attack: 10, defense: 5, maxHp: 100 }, color: 0xffb13d },
  // ── Season 2 pets (Sprint 69) ──
  { id: "kirin", name: "Kỳ Lân", desc: "+8 công, +8 thủ, +80 HP", rarity: "epic", goldPrice: 0, gemPrice: 260, buff: { attack: 8, defense: 8, maxHp: 80 }, color: 0xf0e68c },
  { id: "turtle", name: "Huyền Vũ", desc: "+2 công, +12 thủ, +120 HP", rarity: "epic", goldPrice: 0, gemPrice: 240, buff: { attack: 2, defense: 12, maxHp: 120 }, color: 0x4a8c6a },
  { id: "cat", name: "Mèo May Mắn", desc: "+5 công, +20 HP", rarity: "rare", goldPrice: 12000, gemPrice: 0, buff: { attack: 5, maxHp: 20 }, color: 0xf5b942 },
  // ── Season 3 pets (Sprint 145) ──
  { id: "griffin", name: "Sư Thứu", desc: "+9 công, +6 thủ, +70 HP", rarity: "epic", goldPrice: 0, gemPrice: 280, buff: { attack: 9, defense: 6, maxHp: 70 }, color: 0xd8c08a },
  { id: "bear", name: "Hùng Vương", desc: "+4 công, +10 thủ, +110 HP", rarity: "epic", goldPrice: 0, gemPrice: 220, buff: { attack: 4, defense: 10, maxHp: 110 }, color: 0x9a6b4a },
  // ── Season 4 pets (Sprint 161) ──
  { id: "tiger", name: "Bạch Hổ", desc: "+11 công, +5 thủ, +60 HP", rarity: "epic", goldPrice: 0, gemPrice: 270, buff: { attack: 11, defense: 5, maxHp: 60 }, color: 0xf0a830 },
  { id: "serpent", name: "Thanh Long", desc: "+7 công, +7 thủ, +95 HP", rarity: "epic", goldPrice: 0, gemPrice: 250, buff: { attack: 7, defense: 7, maxHp: 95 }, color: 0x4ad0a0 },
  // ── Season 5 pets (Sprint 177) ──
  { id: "qilin", name: "Lân Vương", desc: "+12 công, +8 thủ, +90 HP", rarity: "epic", goldPrice: 0, gemPrice: 320, buff: { attack: 12, defense: 8, maxHp: 90 }, color: 0xffd166 },
  { id: "raven", name: "Ô Nha", desc: "+13 công, +3 thủ, +50 HP", rarity: "epic", goldPrice: 0, gemPrice: 240, buff: { attack: 13, defense: 3, maxHp: 50 }, color: 0x5a5a72 },
  // ── Season 6 pets (Sprint 185) ──
  { id: "leviathan", name: "Hải Long", desc: "+8 công, +14 thủ, +130 HP", rarity: "epic", goldPrice: 0, gemPrice: 300, buff: { attack: 8, defense: 14, maxHp: 130 }, color: 0x3a8cc0 },
  { id: "fenrir", name: "Cuồng Lang", desc: "+15 công, +4 thủ, +70 HP", rarity: "epic", goldPrice: 0, gemPrice: 340, buff: { attack: 15, defense: 4, maxHp: 70 }, color: 0x8a8a9a },
  // ── Season 7 pets (Sprint 195) ──
  { id: "sphinx", name: "Nhân Sư", desc: "+10 công, +10 thủ, +100 HP", rarity: "epic", goldPrice: 0, gemPrice: 330, buff: { attack: 10, defense: 10, maxHp: 100 }, color: 0xe0c068 },
  { id: "wyvern", name: "Phi Long", desc: "+16 công, +5 thủ, +60 HP", rarity: "epic", goldPrice: 0, gemPrice: 360, buff: { attack: 16, defense: 5, maxHp: 60 }, color: 0xc0504a }
];

const PET_BY_ID = new Map(PET_CATALOG.map((p) => [p.id, p]));

export function getPet(id: string | undefined): PetDef | undefined {
  return id ? PET_BY_ID.get(id) : undefined;
}

export function petLabel(id: string | undefined): string | undefined {
  return getPet(id)?.name;
}

// ── Pet leveling (Sprint 65) ────────────────────────────────────────────
// A pet gains XP from feeding (gold) or treats (Gem). Its buff scales +25%
// per level above 1, so a level-5 pet grants double its base buff. Level math
// is pure for exhaustive unit testing.
export const PET_MAX_LEVEL = 5;
export const PET_FEED_GOLD_COST = 500;
export const PET_FEED_XP = 50;
export const PET_TREAT_GEM_COST = 30;
export const PET_TREAT_XP = 250;

// Cumulative XP required to REACH each level (index = level-1).
const PET_LEVEL_XP = [0, 100, 300, 600, 1000];

export function petLevelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < PET_LEVEL_XP.length; i++) {
    if (xp >= PET_LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return Math.min(PET_MAX_LEVEL, level);
}

/** XP progress within the current level: {into, span, atMax}. */
export function petXpProgress(xp: number): { level: number; into: number; span: number; atMax: boolean } {
  const level = petLevelForXp(xp);
  if (level >= PET_MAX_LEVEL) return { level, into: 1, span: 1, atMax: true };
  const cur = PET_LEVEL_XP[level - 1];
  const next = PET_LEVEL_XP[level];
  return { level, into: xp - cur, span: next - cur, atMax: false };
}

/** Multiplier applied to a pet's base buff at the given level (+25%/level). */
export function petLevelMultiplier(level: number): number {
  return 1 + (Math.max(1, Math.min(PET_MAX_LEVEL, level)) - 1) * 0.25;
}

/** A pet's buff scaled to the given level (each stat rounded). */
export function petBuffAtLevel(buff: PetBuff, level: number): Required<PetBuff> {
  const m = petLevelMultiplier(level);
  return {
    attack: Math.round((buff.attack ?? 0) * m),
    defense: Math.round((buff.defense ?? 0) * m),
    maxHp: Math.round((buff.maxHp ?? 0) * m)
  };
}
