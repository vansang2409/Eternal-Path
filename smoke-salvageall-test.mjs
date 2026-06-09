// Sprint 152: mass-salvage (Phân giải hàng loạt) unequipped, unlocked gear by
// rarity. Respects item lock. Server: DEV_CHEATS=1. Run: node smoke-salvageall-test.mjs
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
const matTotal = (p) => p.inventory.items.filter((i) => i.kind === "material").length;

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `sa${sfx}@t.vn`, accountName: `SA${sfx}`, password: "test1234" });
  await once(s, "player");

  // Grant 3 common, 1 rare, 1 epic.
  for (let i = 0; i < 3; i++) s.emit("devGrantItem", { name: `Junk ${i}`, rarity: "common", slot: "weapon" });
  s.emit("devGrantItem", { name: "Rare Helm", rarity: "rare", slot: "helmet" });
  s.emit("devGrantItem", { name: "Epic Blade", rarity: "epic", slot: "weapon" });
  let pg = await waitPlayer(s, (p) => eqCount(p, "common") >= 3 && eqCount(p, "rare") >= 1 && eqCount(p, "epic") >= 1);
  ok("granted 3 common/1 rare/1 epic", eqCount(pg, "common") === 3 && eqCount(pg, "rare") === 1 && eqCount(pg, "epic") === 1);

  // Lock one common.
  const lockId = pg.inventory.items.find((i) => i.kind === "equipment" && i.rarity === "common").id;
  s.emit("toggleItemLock", { itemId: lockId });
  pg = await waitPlayer(s, (p) => p.inventory.items.find((i) => i.id === lockId)?.locked === true);
  const matBefore = matTotal(pg);

  // Salvage all junk (common). Locked one survives; rare/epic untouched.
  s.emit("salvageAll", { rarity: "junk" });
  const ps = await waitPlayer(s, (p) => eqCount(p, "common") === 1, 5000);
  ok("only locked common remains", eqCount(ps, "common") === 1);
  ok("locked common is the survivor", ps.inventory.items.some((i) => i.id === lockId && i.locked));
  ok("rare untouched", eqCount(ps, "rare") === 1);
  ok("epic untouched", eqCount(ps, "epic") === 1);
  ok("materials granted from mass salvage", matTotal(ps) > matBefore, `mats ${matBefore}->${matTotal(ps)}`);

  // Salvage all rare.
  s.emit("salvageAll", { rarity: "rare" });
  const pr = await waitPlayer(s, (p) => eqCount(p, "rare") === 0, 5000);
  ok("rare mass-salvaged", eqCount(pr, "rare") === 0);

  // Nothing matching → friendly message.
  sys.length = 0;
  s.emit("salvageAll", { rarity: "epic" });
  await waitPlayer(s, (p) => eqCount(p, "epic") === 0, 5000);
  s.emit("salvageAll", { rarity: "epic" });
  await sleep(350);
  ok("empty mass-salvage rejected", sys.some((m) => m.includes("Không có trang bị phù hợp")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
