// Stat gems / socketing (Sprint 186): Gem-bought stones that imbue a single
// equipment item with extra stats. One gem per item; unsocketing destroys the
// gem (a Gem sink). Stats fold into the item so the existing equip bookkeeping
// applies them transparently.
import type { ItemStats } from "./types.js";

export interface StatGem {
  id: string;
  name: string;
  stats: ItemStats;
  gemPrice: number;
  color: number;
}

export const GEM_CATALOG: StatGem[] = [
  { id: "ruby", name: "Hồng Ngọc", stats: { attack: 8 }, gemPrice: 60, color: 0xff4d5e },
  { id: "sapphire", name: "Lam Ngọc", stats: { defense: 8 }, gemPrice: 60, color: 0x4f8cff },
  { id: "topaz", name: "Hoàng Ngọc", stats: { maxHp: 60 }, gemPrice: 60, color: 0xffd166 },
  { id: "diamond", name: "Kim Cương", stats: { attack: 5, defense: 5, maxHp: 30 }, gemPrice: 140, color: 0xbdfdff },
  // Sprint 216: high-tier gems.
  { id: "blood-ruby", name: "Huyết Ngọc", stats: { attack: 16 }, gemPrice: 120, color: 0xd61f3a },
  { id: "star-sapphire", name: "Tinh Lam Ngọc", stats: { defense: 16, maxHp: 40 }, gemPrice: 130, color: 0x2f6fff }
];

const GEM_BY_ID = new Map(GEM_CATALOG.map((g) => [g.id, g]));
export function getStatGem(id: string | undefined): StatGem | undefined {
  return id ? GEM_BY_ID.get(id) : undefined;
}
