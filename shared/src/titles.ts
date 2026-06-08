// Equippable titles (Sprint 62).
//
// Titles are derived (not stored) from the player's existing stats/flags — a
// player "earns" a title whenever its predicate holds, so there's no extra
// tracking. Only the chosen `activeTitle` id is persisted. The active title
// renders next to the player's name (alongside the guild tag).

import type { PlayerState } from "./types.js";
import { isVipActive } from "./vip.js";

export interface TitleDef {
  id: string;
  label: string;
  desc: string;
  earned: (p: PlayerState) => boolean;
}

export const TITLES: TitleDef[] = [
  { id: "novice", label: "Tân Binh", desc: "Bắt đầu hành trình.", earned: () => true },
  { id: "hunter", label: "Thợ Săn", desc: "Hạ 100 quái.", earned: (p) => (p.totalKills ?? 0) >= 100 },
  { id: "slayer", label: "Đồ Tể", desc: "Hạ 1000 quái.", earned: (p) => (p.totalKills ?? 0) >= 1000 },
  { id: "tycoon", label: "Đại Gia", desc: "Sở hữu 50.000 vàng.", earned: (p) => p.stats.gold >= 50_000 },
  { id: "master", label: "Cao Thủ", desc: "Đạt cấp 20.", earned: (p) => p.stats.level >= 20 },
  { id: "legend", label: "Huyền Thoại", desc: "Đạt cấp 40.", earned: (p) => p.stats.level >= 40 },
  { id: "guildmate", label: "Hội Viên", desc: "Gia nhập một guild.", earned: (p) => !!p.guildId },
  { id: "noble", label: "Quý Tộc", desc: "Đang là VIP.", earned: (p) => isVipActive(p.vipUntil) },
  { id: "devoted", label: "Chuyên Cần", desc: "Chuỗi điểm danh ≥ 7 ngày.", earned: (p) => (p.loginStreak ?? 0) >= 7 },
  { id: "collector", label: "Nhà Sưu Tầm", desc: "Sở hữu 3+ cosmetic.", earned: (p) => (p.cosmetics?.length ?? 0) >= 3 }
];

const TITLE_BY_ID = new Map(TITLES.map((t) => [t.id, t]));

export function titleLabel(id: string | undefined): string | undefined {
  return id ? TITLE_BY_ID.get(id)?.label : undefined;
}

export function isTitleEarned(id: string, player: PlayerState): boolean {
  const def = TITLE_BY_ID.get(id);
  return !!def && def.earned(player);
}

/** Ids of every title the player currently qualifies for. */
export function earnedTitles(player: PlayerState): string[] {
  return TITLES.filter((t) => t.earned(player)).map((t) => t.id);
}
