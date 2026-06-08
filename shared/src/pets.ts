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
  { id: "phoenix", name: "Phượng Hoàng", desc: "+10 công, +5 thủ, +100 HP", rarity: "epic", goldPrice: 0, gemPrice: 300, buff: { attack: 10, defense: 5, maxHp: 100 }, color: 0xffb13d }
];

const PET_BY_ID = new Map(PET_CATALOG.map((p) => [p.id, p]));

export function getPet(id: string | undefined): PetDef | undefined {
  return id ? PET_BY_ID.get(id) : undefined;
}

export function petLabel(id: string | undefined): string | undefined {
  return getPet(id)?.name;
}
