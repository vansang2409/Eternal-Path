// Sprint 251+253: personal stash deposit/withdraw + gem slot expansion. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { STASH_BASE_SLOTS, STASH_SLOT_GEM_COST, stashCapacity } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("base 10 slots, +bonus", STASH_BASE_SLOTS === 10 && stashCapacity(5) === 15 && stashCapacity(99) === 30);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `st251${sfx}@t.vn`, accountName: `ST251${sfx}`, password: "test1234" });
  await once(s, "player");

  // Deposit one item (new players spawn in town).
  s.emit("devGrantItem", { name: "Stash Sword", rarity: "rare", slot: "weapon" });
  const p1 = await until((p) => p.inventory.items.some((i) => i.name === "Stash Sword"));
  const item = p1.inventory.items.find((i) => i.name === "Stash Sword");
  s.emit("stashDeposit", { itemId: item.id });
  const p2 = await until((p) => (p.stash ?? []).some((i) => i.id === item.id));
  ok("deposit moved item to stash", !p2.inventory.items.some((i) => i.id === item.id));

  // Withdraw it back.
  s.emit("stashWithdraw", { itemId: item.id });
  const p3 = await until((p) => p.inventory.items.some((i) => i.id === item.id));
  ok("withdraw moved item back", (p3.stash ?? []).length === 0);

  // Fill to capacity → deposit rejected.
  for (let i = 0; i < 10; i++) { s.emit("devGrantItem", { name: `Filler ${i}`, rarity: "common", slot: "ring" }); }
  await until((p) => p.inventory.items.filter((i) => i.name.startsWith("Filler")).length === 10);
  for (const f of lastPlayer.inventory.items.filter((i) => i.name.startsWith("Filler"))) {
    s.emit("stashDeposit", { itemId: f.id });
  }
  await until((p) => (p.stash ?? []).length === 10);
  s.emit("stashDeposit", { itemId: item.id });
  await sleepMs(400);
  ok("full stash rejected", sysMsgs.some((m) => m.includes("Két đã đầy")) && (lastPlayer.stash ?? []).length === 10);

  // Gem expansion: +5 slots for 50 gems → deposit succeeds.
  s.emit("devGrant", { gems: STASH_SLOT_GEM_COST });
  await until((p) => (p.gems ?? 0) >= STASH_SLOT_GEM_COST);
  s.emit("buyStashSlots");
  const p4 = await until((p) => (p.stashBonus ?? 0) === 5);
  ok("bought +5 slots", p4.gems === 0);
  s.emit("stashDeposit", { itemId: item.id });
  const p5 = await until((p) => (p.stash ?? []).length === 11);
  ok("deposit works after expansion", Boolean(p5));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
