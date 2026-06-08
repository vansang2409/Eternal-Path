// Player marketplace / auction house (Sprint 58).
//
// Sellers list an inventory item for a gold price. The item is held in
// escrow on the listing (removed from the seller's bag) until sold or
// cancelled. Buyers pay the full price; a tax is burned (gold sink) and the
// remainder is the seller's proceeds. If the seller is offline when a sale
// happens, the proceeds wait in a pending mailbox collected on next login.
//
// NOTE: the listing/view/pending data shapes live in types.ts (next to the
// Item union they embed) to avoid a type import cycle; this module holds the
// tunables + pure helpers only.

export const MARKET_TAX_RATE = 0.05;
export const MARKET_MAX_LISTINGS_PER_SELLER = 8;
export const MARKET_MIN_PRICE = 1;
export const MARKET_MAX_PRICE = 1_000_000_000;

// ── Featured listings (Sprint 59) — Gem-paid pin to the top of the book. ──
export const MARKET_FEATURE_GEM_COST = 30;
export const MARKET_FEATURE_DURATION_MS = 48 * 60 * 60 * 1000;

/** Tax burned on a sale (gold sink). */
export function marketTax(price: number): number {
  return Math.floor(Math.max(0, price) * MARKET_TAX_RATE);
}

/** What the seller receives after tax. */
export function marketNet(price: number): number {
  return Math.max(0, Math.floor(price)) - marketTax(price);
}

export function sanitizeMarketPrice(raw: unknown): number | undefined {
  const price = Math.floor(Number(raw) || 0);
  if (price < MARKET_MIN_PRICE || price > MARKET_MAX_PRICE) return undefined;
  return price;
}

export function isMarketFeatured(featuredUntil: number | undefined, now: number = Date.now()): boolean {
  return typeof featuredUntil === "number" && featuredUntil > now;
}

// ── Browse filters & sorting (Sprint 59) ────────────────────────────────
// Helpers are generic over a minimal structural shape so this module need
// not import the MarketListing(View) types from types.ts (avoids a cycle).
export type MarketSortKey = "featured" | "priceAsc" | "priceDesc" | "newest" | "rarity";
export type MarketKindFilter = "all" | "equipment" | "consumable" | "material";

interface MarketSortable {
  price: number;
  listedAt: number;
  featuredUntil?: number;
  item: { name: string; kind: string; rarity: string };
}

const RARITY_RANK: Record<string, number> = { epic: 3, rare: 2, common: 1 };

export function filterListings<T extends MarketSortable>(list: T[], query: string, kind: MarketKindFilter): T[] {
  const q = (query ?? "").trim().toLowerCase();
  return list.filter(
    (l) => (kind === "all" || l.item.kind === kind) && (!q || l.item.name.toLowerCase().includes(q))
  );
}

/** Sort listings by the chosen key, always pinning active featured ones first. */
export function sortListings<T extends MarketSortable>(list: T[], key: MarketSortKey, now: number = Date.now()): T[] {
  const feat = (l: T) => (isMarketFeatured(l.featuredUntil, now) ? 1 : 0);
  const byFeatured = (a: T, b: T) => feat(b) - feat(a);
  const comparators: Record<MarketSortKey, (a: T, b: T) => number> = {
    featured: (a, b) => byFeatured(a, b) || b.listedAt - a.listedAt,
    newest: (a, b) => byFeatured(a, b) || b.listedAt - a.listedAt,
    priceAsc: (a, b) => byFeatured(a, b) || a.price - b.price || b.listedAt - a.listedAt,
    priceDesc: (a, b) => byFeatured(a, b) || b.price - a.price || b.listedAt - a.listedAt,
    rarity: (a, b) =>
      byFeatured(a, b) || (RARITY_RANK[b.item.rarity] ?? 0) - (RARITY_RANK[a.item.rarity] ?? 0) || b.listedAt - a.listedAt
  };
  return [...list].sort(comparators[key]);
}
