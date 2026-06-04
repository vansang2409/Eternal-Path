// VIP subscription — paid tier that grants exp/gold multipliers and a
// per-day Gem stipend. Purely cosmetic + economic boost, no exclusive
// gameplay gating.

export interface VipPackage {
  days: number;
  gemPrice: number;
  label: string;
  description: string;
}

export const VIP_PACKAGES: VipPackage[] = [
  { days: 7,  gemPrice: 80,  label: "VIP 1 tuần",  description: "Thử nghiệm — +20% EXP/Vàng, 30 Gem/ngày" },
  { days: 30, gemPrice: 280, label: "VIP 1 tháng", description: "Tiết kiệm — +20% EXP/Vàng, 30 Gem/ngày" },
  { days: 90, gemPrice: 700, label: "VIP 3 tháng", description: "Ưu đãi nhất — +20% EXP/Vàng, 30 Gem/ngày, danh hiệu VIP" }
];

export const VIP_EXP_MULTIPLIER = 1.2;
export const VIP_GOLD_MULTIPLIER = 1.2;
export const VIP_DAILY_GEMS = 30;

export function isVipActive(vipUntil: number | undefined, now = Date.now()): boolean {
  return typeof vipUntil === "number" && vipUntil > now;
}

export function vipRemainingDays(vipUntil: number | undefined, now = Date.now()): number {
  if (!vipUntil || vipUntil <= now) return 0;
  return Math.ceil((vipUntil - now) / (24 * 60 * 60 * 1000));
}
