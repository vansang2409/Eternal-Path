// Sprint 77: buy inventory slots (gold sink) — capacity grows, cost escalates, cap respected.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-bagslot-test.mjs
import { io } from "socket.io-client";
import { bagCapacity, bagUpgradeCost, BAG_MAX_BONUS, BAG_SLOT_PACK, INVENTORY_CAPACITY } from "./shared/dist/formulas.js";

const PORT = process.env.PORT || "3217";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

// Unit: pure math.
ok("base capacity 30", bagCapacity(0) === INVENTORY_CAPACITY && INVENTORY_CAPACITY === 30);
ok("capacity grows by pack", bagCapacity(5) === 35 && bagCapacity(BAG_MAX_BONUS) === 60);
ok("cost escalates", bagUpgradeCost(0) === 3000 && bagUpgradeCost(5) === 6000 && bagUpgradeCost(10) === 9000);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `bag${sfx}@t.vn`, accountName: `Bag${sfx}`, password: "test1234" });
  await once(s, "player");

  // Poor → rejected.
  s.emit("buyBagSlots");
  await sleep(400);
  ok("poor player rejected", sys.some((m) => m.includes("để mở rộng túi")));

  // Grant gold, buy 2 packs.
  s.emit("devGrant", { gold: 100000 });
  await waitPlayer(s, (p) => p.stats.gold >= 100000);
  const before = (await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); })).stats.gold;
  s.emit("buyBagSlots");
  const p1 = await waitPlayer(s, (p) => (p.bagBonus ?? 0) === BAG_SLOT_PACK);
  ok("first pack grants +5 bonus", p1.bagBonus === 5);
  ok("first pack costs 3000", p1.stats.gold === before - 3000, `gold ${before}->${p1.stats.gold}`);

  s.emit("buyBagSlots");
  const p2 = await waitPlayer(s, (p) => (p.bagBonus ?? 0) === 10);
  ok("second pack costs 6000 (escalates)", p2.stats.gold === before - 3000 - 6000, `gold=${p2.stats.gold}`);

  // Buy up to max, then reject further.
  let cur = p2.bagBonus;
  for (let i = 0; i < 10 && cur < BAG_MAX_BONUS; i++) {
    s.emit("buyBagSlots");
    const pp = await waitPlayer(s, (p) => (p.bagBonus ?? 0) > cur, 3000).catch(() => null);
    if (!pp) break;
    cur = pp.bagBonus;
  }
  ok("reaches max bonus", cur === BAG_MAX_BONUS, `cur=${cur}`);
  s.emit("buyBagSlots");
  await sleep(400);
  ok("max bag rejected", sys.some((m) => m.includes("tối đa")));

  // Relogin persists bagBonus.
  await sleep(300);
  s.disconnect();
  await sleep(400);
  const s2 = await connect();
  s2.emit("login", { email: `bag${sfx}@t.vn`, accountName: `Bag${sfx}`, password: "test1234" });
  const relog = await once(s2, "player");
  ok("bagBonus persists across relogin", relog.bagBonus === BAG_MAX_BONUS, `bonus=${relog.bagBonus}`);
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
