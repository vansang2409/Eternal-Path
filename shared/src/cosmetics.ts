// Cosmetic catalog — purely visual, no gameplay stats. Sold for Gems (the
// premium currency), or unlocked through achievement milestones.

export interface Cosmetic {
  id: string;
  name: string;
  description: string;
  type: "skinTint" | "skillEffectColor";
  // Hex color value used when applying the skin tint or recoloring skill VFX.
  color: number;
  /** Price in Gems. 0 means achievement-unlock only. */
  gemPrice: number;
  /** When true, surfaced as a featured / new item in the shop UI. */
  featured?: boolean;
}

export const COSMETICS: Cosmetic[] = [
  {
    id: "skin-emerald",
    name: "Hộ Thân Bích Ngọc",
    description: "Áo choàng phủ ánh ngọc lục — tô màu nhân vật xanh ngọc.",
    type: "skinTint",
    color: 0x52f0a0,
    gemPrice: 120,
    featured: true
  },
  {
    id: "skin-crimson",
    name: "Áo Khói Huyết",
    description: "Tô đỏ nhân vật như được tẩm khói máu của Khắc Tinh.",
    type: "skinTint",
    color: 0xff5d6c,
    gemPrice: 150
  },
  {
    id: "skin-azure",
    name: "Bóng Đêm Xanh",
    description: "Tô màu xanh đêm — phù hợp với phong cách hành tẩu.",
    type: "skinTint",
    color: 0x4f9aff,
    gemPrice: 120
  },
  {
    id: "skin-shadow",
    name: "Bóng Tối Vĩnh Hằng",
    description: "Tô đen nhân vật — chỉ dành cho người vượt cấp 20.",
    type: "skinTint",
    color: 0x2b2b3a,
    gemPrice: 0
  },
  {
    id: "skin-gold",
    name: "Hoàng Kim",
    description: "Toả ánh vàng kim — đỉnh cao status.",
    type: "skinTint",
    color: 0xffd166,
    gemPrice: 280,
    featured: true
  },
  {
    id: "skill-fx-violet",
    name: "Hiệu Ứng Phép Tím",
    description: "Đổi màu hiệu ứng kỹ năng AoE sang tím đậm.",
    type: "skillEffectColor",
    color: 0xb070ff,
    gemPrice: 90
  },
  {
    id: "skill-fx-cyan",
    name: "Hiệu Ứng Phép Băng",
    description: "Hiệu ứng kỹ năng phủ băng xanh tươi.",
    type: "skillEffectColor",
    color: 0x9bf0ff,
    gemPrice: 90
  },
  // ── Season 2 content drop (Sprint 69) ──
  {
    id: "skin-rose",
    name: "Xích Hồng Yêu Cơ",
    description: "Tô hồng rực — phong thái kiêu sa giữa chiến trường.",
    type: "skinTint",
    color: 0xff7ac6,
    gemPrice: 150,
    featured: true
  },
  {
    id: "skin-jade-storm",
    name: "Lục Lôi",
    description: "Sắc lục điện quang cuộn quanh thân.",
    type: "skinTint",
    color: 0x6ef0c8,
    gemPrice: 160
  },
  {
    id: "skin-obsidian-gold",
    name: "Hắc Kim Đế Vương",
    description: "Đen tuyền viền ánh kim — uy nghi bậc đế vương.",
    type: "skinTint",
    color: 0x6b5a2a,
    gemPrice: 320
  },
  {
    id: "skill-fx-ember",
    name: "Hiệu Ứng Phép Hỏa",
    description: "Hiệu ứng kỹ năng bùng cháy đỏ cam.",
    type: "skillEffectColor",
    color: 0xff8838,
    gemPrice: 110
  },
  {
    id: "skill-fx-void",
    name: "Hiệu Ứng Phép Hư Không",
    description: "Hiệu ứng kỹ năng nhuốm tím hư vô.",
    type: "skillEffectColor",
    color: 0x8a4dff,
    gemPrice: 130,
    featured: true
  },
  // ── Season 3 content drop (Sprint 145) ──
  {
    id: "skin-celestial",
    name: "Thiên Quang Thánh Y",
    description: "Phủ ánh thiên quang xanh bạc — thần thái xuất trần.",
    type: "skinTint",
    color: 0x9fd8ff,
    gemPrice: 180,
    featured: true
  },
  {
    id: "skin-inferno",
    name: "Viêm Long Chiến Bào",
    description: "Rực cháy sắc lửa cam đỏ như vảy viêm long.",
    type: "skinTint",
    color: 0xff5a1e,
    gemPrice: 200
  },
  {
    id: "skill-fx-gold",
    name: "Hiệu Ứng Phép Hoàng Kim",
    description: "Hiệu ứng kỹ năng toả ánh vàng kim rực rỡ.",
    type: "skillEffectColor",
    color: 0xffd54a,
    gemPrice: 140,
    featured: true
  },
  // ── Season 4 content drop (Sprint 161) ──
  {
    id: "skin-aurora",
    name: "Cực Quang Thần Bào",
    description: "Phủ sắc cực quang lục lam dao động — huyền ảo như trời bắc.",
    type: "skinTint",
    color: 0x7af0d0,
    gemPrice: 200,
    featured: true
  },
  {
    id: "skill-fx-storm",
    name: "Hiệu Ứng Phép Lôi Quang",
    description: "Hiệu ứng kỹ năng nhuốm ánh lôi quang xanh chói.",
    type: "skillEffectColor",
    color: 0x6ea8ff,
    gemPrice: 150
  },
  // ── Season 5 content drop (Sprint 177) ──
  {
    id: "skin-void-monarch",
    name: "Hư Vô Đế Bào",
    description: "Sắc tím hư vô cuộn xoáy — uy áp của bậc đế vương bóng tối.",
    type: "skinTint",
    color: 0x7a3fd6,
    gemPrice: 240,
    featured: true
  },
  {
    id: "skill-fx-blood",
    name: "Hiệu Ứng Phép Huyết",
    description: "Hiệu ứng kỹ năng nhuốm sắc huyết đỏ thẫm.",
    type: "skillEffectColor",
    color: 0xd6294a,
    gemPrice: 160
  },
  // ── Season 6 content drop (Sprint 185) ──
  {
    id: "skin-frost-sovereign",
    name: "Băng Tuyết Quân Vương",
    description: "Phủ sắc băng lam bạc lấp lánh như tuyết vĩnh hằng.",
    type: "skinTint",
    color: 0xa8e0ff,
    gemPrice: 220,
    featured: true
  },
  {
    id: "skill-fx-emerald",
    name: "Hiệu Ứng Phép Lục Ngọc",
    description: "Hiệu ứng kỹ năng toả ánh lục ngọc trong vắt.",
    type: "skillEffectColor",
    color: 0x3fe0a0,
    gemPrice: 150
  },
  // ── Season 7 content drop (Sprint 195) ──
  {
    id: "skin-solar-radiant",
    name: "Nhật Diệm Thánh Quang",
    description: "Toả ánh mặt trời rực rỡ vàng cam — uy nghi bậc thần.",
    type: "skinTint",
    color: 0xffb347,
    gemPrice: 260,
    featured: true
  },
  {
    id: "skill-fx-shadow",
    name: "Hiệu Ứng Phép Ám Diệm",
    description: "Hiệu ứng kỹ năng nhuốm bóng tối tím than.",
    type: "skillEffectColor",
    color: 0x6a3a8a,
    gemPrice: 170
  },
  // ── Sprint 200 capstone: marquee cosmetic ──
  {
    id: "skin-eternal-radiance",
    name: "Vĩnh Hằng Thánh Thể",
    description: "Hào quang vàng bạch kim vĩnh cửu — vinh quang tột đỉnh của Eternal Path.",
    type: "skinTint",
    color: 0xfff0c0,
    gemPrice: 500,
    featured: true
  }
];

export function getCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

// Daily login: gems for X consecutive days. For day N, granted gemAmount.
export const DAILY_GEM_REWARD = 8;
// Minimum interval between daily claims (in ms) — 20 hours (allows a one-day
// daily rhythm without strict 24h cutoff).
export const DAILY_CLAIM_INTERVAL_MS = 20 * 60 * 60 * 1000;
