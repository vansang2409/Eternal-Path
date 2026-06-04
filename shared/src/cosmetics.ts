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
