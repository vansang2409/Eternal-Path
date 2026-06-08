// Filesystem persistence for the player marketplace (Sprint 58).
//
// Mirrors GuildStore's debounced-flush pattern with its own JSON file. Holds
// active listings (item held in escrow) + a pending-proceeds mailbox for
// sellers who were offline when their item sold.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { MarketListing, MarketPendingProceeds } from "@mmorpg/shared";

const MARKET_SAVE_PATH = process.env.MARKET_SAVE_PATH || "data/market.json";
const FLUSH_INTERVAL_MS = 30 * 1000;

const listings = new Map<string, MarketListing>();
const pending = new Map<string, MarketPendingProceeds>();
let dirty = false;
let timer: NodeJS.Timeout | undefined;

function loadFromDisk(): void {
  try {
    if (!existsSync(MARKET_SAVE_PATH)) return;
    const raw = readFileSync(MARKET_SAVE_PATH, "utf8");
    const json = JSON.parse(raw) as { listings?: MarketListing[]; pending?: MarketPendingProceeds[] };
    if (Array.isArray(json.listings)) {
      for (const l of json.listings) {
        if (l && typeof l.id === "string" && l.item) listings.set(l.id, l);
      }
    }
    if (Array.isArray(json.pending)) {
      for (const p of json.pending) {
        if (p && typeof p.accountName === "string") pending.set(p.accountName, p);
      }
    }
    console.log(`[market-store] Loaded ${listings.size} listings + ${pending.size} pending mailboxes from ${MARKET_SAVE_PATH}`);
  } catch (err) {
    console.warn(`[market-store] Failed to load ${MARKET_SAVE_PATH}:`, err);
  }
}

function flushToDisk(): void {
  if (!dirty) return;
  try {
    const dir = dirname(MARKET_SAVE_PATH);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      MARKET_SAVE_PATH,
      JSON.stringify({ listings: [...listings.values()], pending: [...pending.values()] }),
      "utf8"
    );
    dirty = false;
  } catch (err) {
    console.warn(`[market-store] Failed to write ${MARKET_SAVE_PATH}:`, err);
  }
}

loadFromDisk();
if (!timer) {
  timer = setInterval(flushToDisk, FLUSH_INTERVAL_MS);
  timer.unref?.();
}
process.on("beforeExit", flushToDisk);

export const marketStore = {
  all(): MarketListing[] {
    // Newest first.
    return [...listings.values()].sort((a, b) => b.listedAt - a.listedAt);
  },
  get(id: string): MarketListing | undefined {
    return listings.get(id);
  },
  countBySeller(sellerName: string): number {
    let n = 0;
    for (const l of listings.values()) if (l.sellerName === sellerName) n += 1;
    return n;
  },
  add(listing: MarketListing): void {
    listings.set(listing.id, listing);
    dirty = true;
  },
  remove(id: string): void {
    listings.delete(id);
    dirty = true;
  },
  /** Queue gold for an offline seller; merged into their mailbox. */
  addPending(accountName: string, gold: number, itemName: string, soldAt: number): void {
    const box = pending.get(accountName) ?? { accountName, gold: 0, sales: [] };
    box.gold += gold;
    box.sales.push({ itemName, net: gold, soldAt });
    pending.set(accountName, box);
    dirty = true;
  },
  /** Drain and return an account's pending proceeds (called on login). */
  collectPending(accountName: string): MarketPendingProceeds | undefined {
    const box = pending.get(accountName);
    if (!box || box.gold <= 0) return undefined;
    pending.delete(accountName);
    dirty = true;
    return box;
  },
  markDirty(): void {
    dirty = true;
  },
  flushNow(): void {
    flushToDisk();
  }
};
