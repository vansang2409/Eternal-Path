// Sprint 58 marketplace persistence: list item, wait for flush, verify on restart.
// Phase 1 (default): seller lists an item, wait 31s for timer flush, exit.
// Phase 2 (RESTORE=1): a buyer logs in and buys the persisted listing.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3181";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev, t = 8000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const connect = () => new Promise((res, rej) => {
  const s = io(`http://localhost:${PORT}`, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
});

if (process.env.RESTORE === "1") {
  const buyer = await connect();
  let market = [];
  buyer.on("marketUpdate", (l) => { market = l; });
  buyer.emit("login", { email: "mkpbuyer@t.vn", accountName: "MkPBuyer", password: "test1234" });
  await once(buyer, "player");
  buyer.emit("devGrant", { gold: 50000 });
  await sleep(400);
  buyer.emit("requestMarket");
  await sleep(600);
  const listing = market.find((l) => l.item.name === "Persist Blade");
  if (!listing) { console.log("RESTORE FAIL — listing not found after restart"); process.exit(1); }
  buyer.emit("buyMarketItem", { listingId: listing.id });
  const got = await new Promise((res) => {
    const h = (p) => { if (p.inventory.items.some((i) => i.name === "Persist Blade")) { buyer.off("player", h); res(true); } };
    buyer.on("player", h);
    setTimeout(() => res(false), 4000);
  });
  console.log(got ? "RESTORE PASS — persisted listing bought after restart" : "RESTORE FAIL — could not buy");
  buyer.disconnect();
  process.exit(got ? 0 : 1);
} else {
  const seller = await connect();
  let market = [];
  seller.on("marketUpdate", (l) => { market = l; });
  seller.emit("login", { email: "mkpseller@t.vn", accountName: "MkPSeller", password: "test1234" });
  await once(seller, "player");
  seller.emit("devGrantItem", { name: "Persist Blade", rarity: "epic", value: 800 });
  const sp = await new Promise((res) => seller.once("player", res));
  const item = sp.inventory.items.find((i) => i.name === "Persist Blade");
  seller.emit("listMarketItem", { itemId: item.id, price: 1500 });
  await sleep(500);
  console.log(market.some((l) => l.item.name === "Persist Blade") ? "listed, waiting 31s for flush..." : "LIST FAIL");
  await sleep(31000);
  seller.disconnect();
  process.exit(0);
}
