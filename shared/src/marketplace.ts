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
