// Sprint 59: unit-test filter/sort helpers + e2e featured listing.
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-market59-test.mjs
import { io } from "socket.io-client";
import { filterListings, sortListings, isMarketFeatured } from "./shared/dist/marketplace.js";

const PORT = process.env.PORT || "3183";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 140) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
  setTimeout(() => rej(new Error("connect timeout")), 5000);
});
const once = (s, ev, t = 5000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout player pred")), t);
  const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } };
  s.on("player", fn);
});

// ── Unit tests for pure helpers (no server needed) ──
const mk = (name, kind, rarity, price, listedAt, featuredUntil) => ({ id: name, sellerName: "x", item: { name, kind, rarity }, price, listedAt, featuredUntil });
const now = 1_000_000;
const sample = [
  mk("Iron Sword", "equipment", "common", 100, 10),
  mk("Epic Staff", "equipment", "epic", 5000, 20),
  mk("Heal Potion", "consumable", "common", 50, 30),
  mk("Void Ash", "material", "rare", 200, 40, now + 99999) // featured
];

ok("filter by name", filterListings(sample, "sword", "all").length === 1);
ok("filter by name case-insensitive", filterListings(sample, "EPIC", "all")[0]?.item.name === "Epic Staff");
ok("filter by kind", filterListings(sample, "", "consumable").length === 1);
ok("filter kind+query empty result", filterListings(sample, "sword", "material").length === 0);
ok("sort priceAsc (featured first)", (() => { const s = sortListings(sample, "priceAsc", now); return s[0].item.name === "Void Ash" && s[1].item.name === "Heal Potion"; })());
ok("sort priceDesc (featured first)", (() => { const s = sortListings(sample, "priceDesc", now); return s[0].item.name === "Void Ash" && s[1].item.name === "Epic Staff"; })());
ok("sort newest (featured first)", (() => { const s = sortListings(sample, "newest", now); return s[0].item.name === "Void Ash"; })());
ok("sort rarity (featured first then epic)", (() => { const s = sortListings(sample, "rarity", now); return s[0].item.name === "Void Ash" && s[1].item.name === "Epic Staff"; })());
ok("isMarketFeatured true/false", isMarketFeatured(now + 1000, now) && !isMarketFeatured(now - 1000, now) && !isMarketFeatured(undefined, now));

// ── e2e: featured listing via Gem ──
const run = async () => {
  const sfx = Date.now() % 100000;
  const seller = await connect();
  const buyer = await connect();
  let sMarket = [], bMarket = [];
  const sSys = [];
  seller.on("marketUpdate", (l) => { sMarket = l; });
  buyer.on("marketUpdate", (l) => { bMarket = l; });
  seller.on("system", (m) => sSys.push(m));

  seller.emit("login", { email: `m59s${sfx}@t.vn`, accountName: `M59S${sfx}`, password: "test1234" });
  await once(seller, "player");
  buyer.emit("login", { email: `m59b${sfx}@t.vn`, accountName: `M59B${sfx}`, password: "test1234" });
  await once(buyer, "player");

  // Seller lists two items; only the second is featured.
  seller.emit("devGrantItem", { name: "Plain Dagger", rarity: "common", value: 100 });
  const sp1 = await waitPlayer(seller, (p) => p.inventory.items.some((i) => i.name === "Plain Dagger"));
  const dagger = sp1.inventory.items.find((i) => i.name === "Plain Dagger");
  seller.emit("listMarketItem", { itemId: dagger.id, price: 100 });
  await sleep(300);

  seller.emit("devGrantItem", { name: "Shiny Bow", rarity: "rare", value: 300 });
  const sp2 = await waitPlayer(seller, (p) => p.inventory.items.some((i) => i.name === "Shiny Bow"));
  const bow = sp2.inventory.items.find((i) => i.name === "Shiny Bow");
  seller.emit("listMarketItem", { itemId: bow.id, price: 300 });
  await sleep(400);

  // Not enough gems → feature rejected.
  const bowListing = sMarket.find((l) => l.item.id === bow.id);
  seller.emit("featureMarketListing", { listingId: bowListing.id });
  await sleep(400);
  ok("feature rejected without gems", sSys.some((m) => m.includes("💎 để làm nổi bật")));

  // Grant gems, feature it.
  seller.emit("devGrant", { gems: 100 });
  await waitPlayer(seller, (p) => (p.gems ?? 0) >= 100);
  seller.emit("featureMarketListing", { listingId: bowListing.id });
  const spAfter = await waitPlayer(seller, (p) => (p.gems ?? 0) === 70, 4000).catch(() => null);
  ok("feature deducts 30 gems", !!spAfter, `gems=${spAfter?.gems}`);
  await sleep(400);
  const bowNow = sMarket.find((l) => l.item.id === bow.id);
  ok("listing now featured", bowNow?.featured === true);

  // Featured item should be first in the server-sent (featured-first) order.
  ok("featured sorts to top of book", sMarket[0]?.item.id === bow.id, `top=${sMarket[0]?.item.name}`);

  // Double-feature rejected.
  seller.emit("featureMarketListing", { listingId: bowListing.id });
  await sleep(400);
  ok("double feature rejected", sSys.some((m) => m.includes("đang được làm nổi bật rồi")));

  seller.disconnect(); buyer.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
