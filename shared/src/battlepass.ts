// Battle Pass — a tiered season-long progression with a free track and a
// paid premium track. Players earn BP exp from kills and quests.

import type { MaterialId } from "./types.js";

export interface BattlePassReward {
  kind: "gold" | "gem" | "material" | "scroll" | "title";
  amount: number;
  materialId?: MaterialId;
  title?: string;
}

export interface BattlePassTier {
  level: number;
  freeReward: BattlePassReward;
  premiumReward: BattlePassReward;
}

export const BATTLE_PASS_EXP_PER_TIER = 200;
export const BATTLE_PASS_PREMIUM_PRICE = 500;
export const BATTLE_PASS_EXP_PER_KILL = 5;
export const BATTLE_PASS_EXP_PER_QUEST = 80;

export const BATTLE_PASS_TIERS: BattlePassTier[] = [
  { level: 1,  freeReward: { kind: "gold", amount: 80 },     premiumReward: { kind: "gem", amount: 30 } },
  { level: 2,  freeReward: { kind: "scroll", amount: 1 },    premiumReward: { kind: "gem", amount: 50 } },
  { level: 3,  freeReward: { kind: "gold", amount: 150 },    premiumReward: { kind: "material", amount: 2, materialId: "crystalShard" } },
  { level: 4,  freeReward: { kind: "material", amount: 1, materialId: "crystalShard" }, premiumReward: { kind: "material", amount: 3, materialId: "voidAsh" } },
  { level: 5,  freeReward: { kind: "gold", amount: 220 },    premiumReward: { kind: "gem", amount: 80 } },
  { level: 6,  freeReward: { kind: "material", amount: 1, materialId: "voidAsh" }, premiumReward: { kind: "material", amount: 5, materialId: "voidAsh" } },
  { level: 7,  freeReward: { kind: "gold", amount: 300 },    premiumReward: { kind: "material", amount: 1, materialId: "wardenHeart" } },
  { level: 8,  freeReward: { kind: "scroll", amount: 2 },    premiumReward: { kind: "gem", amount: 120 } },
  { level: 9,  freeReward: { kind: "gold", amount: 400 },    premiumReward: { kind: "material", amount: 3, materialId: "crystalShard" } },
  { level: 10, freeReward: { kind: "title", amount: 1, title: "Người Hùng Mùa" }, premiumReward: { kind: "title", amount: 1, title: "Huyền Thoại Mùa" } }
];

export function describeBattlePassReward(r: BattlePassReward): string {
  switch (r.kind) {
    case "gold": return `${r.amount} vàng`;
    case "gem":  return `${r.amount} 💎`;
    case "material": return `${r.amount}× ${r.materialId}`;
    case "scroll": return `${r.amount}× Cuộn Hồi Thành`;
    case "title": return `Danh hiệu: ${r.title ?? ""}`;
  }
}
