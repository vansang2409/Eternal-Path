// Sprint 176: auto-salvage loot filter. DEV_CHEATS=1.
// Run: node smoke-autosalvage176-test.mjs
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const eqCount = (p, r) => p.inventory.items.filter((i) => i.kind === "equipment" && i.rarity === r).length;
const matCount = (p) => p.inventory.items.filter((i) => i.kind === "material").length;

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `as${sfx}@t.vn`, accountName: `AS${sfx}`, password: "test1234" });
  await once(s, "player");

  // Default off: a common loot drop is bagged.
  s.emit("devLootItem", { rarity: "common" });
  const p1 = await waitPlayer(s, (p) => eqCount(p, "common") === 1);
  ok("off: common loot kept in bag", eqCount(p1, "common") === 1);

  // Set threshold to common → common loot auto-salvaged into materials.
  s.emit("setAutoSalvage", { rarity: "common" });
  await waitPlayer(s, (p) => p.autoSalvageRarity === "common");
  const matBefore = matCount(p1);
  s.emit("devLootItem", { rarity: "common" });
  const p2 = await waitPlayer(s, (p) => matCount(p) > matBefore, 4000);
  ok("common: still only 1 common in bag (new one salvaged)", eqCount(p2, "common") === 1);
  ok("common loot converted to materials", matCount(p2) > matBefore);

  // Rare loot is NOT salvaged at 'common' threshold → bagged.
  s.emit("devLootItem", { rarity: "rare" });
  const p3 = await waitPlayer(s, (p) => eqCount(p, "rare") === 1);
  ok("common threshold keeps rare in bag", eqCount(p3, "rare") === 1);

  // Raise to rare → rare loot now salvaged.
  s.emit("setAutoSalvage", { rarity: "rare" });
  await waitPlayer(s, (p) => p.autoSalvageRarity === "rare");
  const mat3 = matCount(p3);
  s.emit("devLootItem", { rarity: "rare" });
  const p4 = await waitPlayer(s, (p) => matCount(p) > mat3, 4000);
  ok("rare threshold salvages rare loot", eqCount(p4, "rare") === 1 && matCount(p4) > mat3);

  // Epic is never auto-salvaged.
  s.emit("devLootItem", { rarity: "epic" });
  const p5 = await waitPlayer(s, (p) => eqCount(p, "epic") === 1);
  ok("epic never auto-salvaged", eqCount(p5, "epic") === 1);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
