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
  { id: "collector", label: "Nhà Sưu Tầm", desc: "Sở hữu 3+ cosmetic.", earned: (p) => (p.cosmetics?.length ?? 0) >= 3 },
  // ── Achievement-gated prestige titles (Sprint 71) ──
  { id: "raidlord", label: "Diệt Ma Vương", desc: "Mở thành tựu hạ Boss Guild.", earned: (p) => (p.achievements ?? []).includes("raid-slayer") },
  { id: "petlord", label: "Bá Chủ Linh Thú", desc: "Nuôi linh thú đạt cấp 5.", earned: (p) => (p.achievements ?? []).includes("beast-master") },
  { id: "merchant-prince", label: "Thương Vương", desc: "Bán được hàng ở Chợ.", earned: (p) => (p.achievements ?? []).includes("merchant") },
  { id: "founder", label: "Khai Quốc", desc: "Sáng lập một guild.", earned: (p) => (p.achievements ?? []).includes("guild-founder") },
  // ── Sprint 164: new milestone & gear-loop titles ──
  { id: "wealthlord", label: "Thủ Phú", desc: "Sở hữu 200.000 vàng.", earned: (p) => p.stats.gold >= 200_000 },
  { id: "ascended", label: "Thăng Thiên", desc: "Đạt cấp 60.", earned: (p) => p.stats.level >= 60 },
  { id: "forgemaster", label: "Thần Cường Hóa", desc: "Mở thành tựu Thợ Cường Hóa.", earned: (p) => (p.achievements ?? []).includes("enhancer") },
  { id: "apexlord", label: "Thần Thợ Rèn", desc: "Mở thành tựu Thợ Rèn Thượng Thừa.", earned: (p) => (p.achievements ?? []).includes("apex-smith") },
  // ── Sprint 182: titles for mounts / alchemy / arena mastery ──
  { id: "knight-errant", label: "Hiệp Sĩ Lưu Lạc", desc: "Mở thành tựu Kỵ Sĩ Đường Trường.", earned: (p) => (p.achievements ?? []).includes("rider") },
  { id: "alchemy-master", label: "Đan Vương", desc: "Mở thành tựu Luyện Đan Sư.", earned: (p) => (p.achievements ?? []).includes("alchemist") },
  { id: "arena-legend", label: "Huyền Thoại Đấu Trường", desc: "Mở thành tựu Chuỗi Bất Bại.", earned: (p) => (p.achievements ?? []).includes("streak-master") },
  // ── Sprint 187: jeweler title ──
  { id: "gem-lord", label: "Ngọc Vương", desc: "Mở thành tựu Thợ Kim Hoàn.", earned: (p) => (p.achievements ?? []).includes("jeweler") },
  // ── Sprint 194: high-level + gear-power titles ──
  { id: "demigod", label: "Bán Thần", desc: "Đạt cấp 80.", earned: (p) => p.stats.level >= 80 },
  { id: "perfectionist", label: "Hoàn Mỹ", desc: "Tổng cường hóa (+N) trang bị ≥ 20.", earned: (p) => Object.values(p.inventory?.equipped ?? {}).reduce((s, it) => s + (it && it.kind === "equipment" ? (it.plusLevel ?? 0) : 0), 0) >= 20 },
  // ── Sprint 200 capstone: the ultimate endgame title ──
  { id: "eternal", label: "Vĩnh Hằng", desc: "Đạt cấp 100 — huyền thoại của Eternal Path.", earned: (p) => p.stats.level >= 100 },
  // ── Sprint 208: social / economy titles ──
  { id: "courier", label: "Sứ Giả", desc: "Mở thành tựu Bưu Tá.", earned: (p) => (p.achievements ?? []).includes("pen-pal") },
  { id: "bargain-hunter", label: "Thợ Săn Sale", desc: "Mua 1 khuyến mãi hằng ngày.", earned: (p) => (p.lastDealDay ?? 0) > 0 },
  { id: "mogul", label: "Trùm Tài Phiệt", desc: "Sở hữu 1.000.000 vàng.", earned: (p) => p.stats.gold >= 1_000_000 },
  // ── Sprint 215: combat-milestone titles ──
  { id: "exterminator", label: "Đồ Long", desc: "Hạ tổng 5.000 quái.", earned: (p) => (p.totalKills ?? 0) >= 5000 },
  { id: "boss-bane", label: "Khắc Tinh Ma Vương", desc: "Mở thành tựu hạ world boss.", earned: (p) => (p.achievements ?? []).includes("slay-boss") }
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
