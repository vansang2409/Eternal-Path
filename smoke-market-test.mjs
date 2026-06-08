// Sprint 58 smoke test: marketplace list/buy/cancel/tax/offline-proceeds.
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-market-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3181";
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
// Wait for a player snapshot whose predicate holds (handles ordering).
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout player pred")), t);
  const handler = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", handler); res(p); } };
  s.on("player", handler);
});

const run = async () => {
  const sfx = Date.now() % 100000;
  const seller = await connect();
  const buyer = await connect();
  const sSys = [], bSys = [];
  let sMarket = [], bMarket = [];
  seller.on("system", (m) => sSys.push(m));
  buyer.on("system", (m) => bSys.push(m));
  seller.on("marketUpdate", (l) => { sMarket = l; });
  buyer.on("marketUpdate", (l) => { bMarket = l; });

  seller.emit("login", { email: `mks${sfx}@t.vn`, accountName: `MkSeller${sfx}`, password: "test1234" });
  const sp = await once(seller, "player");
  buyer.emit("login", { email: `mkb${sfx}@t.vn`, accountName: `MkBuyer${sfx}`, password: "test1234" });
  await once(buyer, "player");
  ok("login both", !!sp.accountName);

  // Give the seller a known item via devGrant item + buyer some gold.
  seller.emit("devGrantItem", { name: "Test Sword", rarity: "rare", value: 500 });
  const sp2 = await waitPlayer(seller, (p) => p.inventory.items.some((i) => i.name === "Test Sword"));
  const item = sp2.inventory.items.find((i) => i.name === "Test Sword");
  ok("seller got test item", !!item);
  buyer.emit("devGrant", { gold: 100000 });
  await waitPlayer(buyer, (p) => p.stats.gold >= 100000);

  // List it for 1000 gold.
  seller.emit("listMarketItem", { itemId: item.id, price: 1000 });
  await sleep(500);
  const spAfterList = await new Promise((res) => { seller.emit("devGrant", { gold: 0 }); seller.once("player", res); });
  ok("item escrowed out of bag", !spAfterList.inventory.items.some((i) => i.id === item.id));
  ok("listing visible to buyer", bMarket.some((l) => l.item.id === item.id && l.price === 1000 && !l.mine), JSON.stringify(bMarket.map((l)=>l.price)));
  ok("listing flagged mine for seller", sMarket.some((l) => l.item.id === item.id && l.mine));

  // Price validation: zero rejected.
  seller.emit("listMarketItem", { itemId: "nonexistent", price: 0 });
  await sleep(300);
  ok("invalid price rejected", sSys.some((m) => m.includes("Giá không hợp lệ")));

  // Buyer buys.
  const listing = bMarket.find((l) => l.item.id === item.id);
  const buyerGoldBefore = 100000;
  buyer.emit("buyMarketItem", { listingId: listing.id });
  const bpAfter = await waitPlayer(buyer, (p) => p.inventory.items.some((i) => i.id === item.id));
  ok("buyer received item", bpAfter.inventory.items.some((i) => i.id === item.id));
  ok("buyer charged full price", bpAfter.stats.gold === buyerGoldBefore - 1000, `gold=${bpAfter.stats.gold}`);

  // Seller (online) receives net = 1000 - 5% = 950.
  const spPaid = await waitPlayer(seller, (p) => p.stats.gold >= 950, 4000).catch(() => null);
  ok("seller paid net after tax (950)", spPaid && spPaid.stats.gold === spAfterList.stats.gold + 950, `gold=${spPaid?.stats.gold} base=${spAfterList.stats.gold}`);
  ok("listing removed after sale", !bMarket.some((l) => l.id === listing.id) && !sMarket.some((l) => l.id === listing.id));

  // Cancel flow: seller lists again then cancels, item returns.
  const sp3 = await new Promise((res) => { seller.emit("devGrantItem", { name: "Cancel Ring", rarity: "common", value: 50 }); seller.once("player", res); });
  const ring = sp3.inventory.items.find((i) => i.name === "Cancel Ring");
  seller.emit("listMarketItem", { itemId: ring.id, price: 300 });
  await sleep(400);
  const myListing = sMarket.find((l) => l.item.id === ring.id);
  seller.emit("cancelMarketListing", { listingId: myListing.id });
  const spReturned = await waitPlayer(seller, (p) => p.inventory.items.some((i) => i.id === ring.id));
  ok("cancel returns item", spReturned.inventory.items.some((i) => i.id === ring.id));

  // Cannot buy own listing. (Ring re-listed at 300; this listing is reused
  // for the offline-proceeds test below.)
  seller.emit("listMarketItem", { itemId: ring.id, price: 300 });
  await sleep(400);
  const ownListing = sMarket.find((l) => l.item.id === ring.id);
  const goldBeforeOffline = spReturned.stats.gold; // listing doesn't change gold
  seller.emit("buyMarketItem", { listingId: ownListing.id });
  await sleep(400);
  ok("cannot buy own listing", sSys.some((m) => m.includes("Không thể mua món bạn đang rao")));

  // Offline proceeds: seller disconnects, buyer buys the listing, seller relogs → credited.
  seller.disconnect();
  await sleep(500);
  buyer.emit("buyMarketItem", { listingId: ownListing.id });
  await sleep(700);
  const seller2 = await connect();
  let credited = null;
  seller2.on("system", (m) => { if (m.includes("offline") && m.includes("vàng")) credited = m; });
  // Server emits player twice on login (base, then again after crediting
  // proceeds) — wait for the snapshot that reflects the credit. net(300)=285.
  seller2.emit("login", { email: `mks${sfx}@t.vn`, accountName: `MkSeller${sfx}`, password: "test1234" });
  const relog = await waitPlayer(seller2, (p) => p.stats.gold >= goldBeforeOffline + 285, 4000).catch(() => null);
  ok("offline proceeds credited on relog", !!relog && relog.stats.gold >= goldBeforeOffline + 285, `gold=${relog?.stats.gold} before=${goldBeforeOffline}`);
  ok("offline sale system message", !!credited, credited ?? "(none)");

  seller2.disconnect(); buyer.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
