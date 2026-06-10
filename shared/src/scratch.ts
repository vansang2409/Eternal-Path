// Sprint 225: Scratch tickets — a fun 200-gold sink with a 10% house edge
// (EV = 180 gold). rollScratch is pure for unit testing.

export const SCRATCH_TICKET_COST = 200;

export interface ScratchPrize {
  id: string;
  label: string;
  /** Weight in percent — all entries sum to 100. */
  weight: number;
  payout: number;
  announce?: boolean;
}

export const SCRATCH_TABLE: ScratchPrize[] = [
  { id: "miss", label: "Trượt rồi 😵", weight: 65, payout: 0 },
  { id: "small", label: "Trúng nhỏ 🪙", weight: 20, payout: 250 },
  { id: "medium", label: "Trúng vừa 💰", weight: 10, payout: 400 },
  { id: "big", label: "TRÚNG LỚN 🎉", weight: 4, payout: 1000 },
  { id: "jackpot", label: "ĐỘC ĐẮC 💎🎆", weight: 1, payout: 5000, announce: true }
];

/** Expected value of one ticket (used by tests to pin the house edge). */
export function scratchExpectedValue(): number {
  return SCRATCH_TABLE.reduce((sum, p) => sum + (p.weight / 100) * p.payout, 0);
}

/** Roll the prize table with an injected rng in [0,1). */
export function rollScratch(rng: number): ScratchPrize {
  const total = SCRATCH_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let cursor = Math.min(0.999999, Math.max(0, rng)) * total;
  for (const entry of SCRATCH_TABLE) {
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return SCRATCH_TABLE[SCRATCH_TABLE.length - 1];
}
