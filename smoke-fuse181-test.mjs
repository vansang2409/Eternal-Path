// Sprint 181: fuse 3 commons → 1 rare+. DEV_CHEATS=1.
// Run: node smoke-fuse181-test.mjs
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

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `fu${sfx}@t.vn`, accountName: `FU${sfx}`, password: "test1234" });
  await once(s, "player");

  // Fewer than 3 commons → rejected.
  s.emit("devGrantItem", { name: "C1", rarity: "common", slot: "weapon" });
  await waitPlayer(s, (p) => eqCount(p, "common") === 1);
  s.emit("fuseGear");
  await sleep(350);
  ok("fuse rejected with <3 commons", sys.some((m) => m.includes("Cần 3 trang bị Thường")));

  // Grant 2 more commons (total 3) → fuse → 3 commons gone, 1 rare+ appears.
  s.emit("devGrantItem", { name: "C2", rarity: "common", slot: "helmet" });
  s.emit("devGrantItem", { name: "C3", rarity: "common", slot: "boots" });
  await waitPlayer(s, (p) => eqCount(p, "common") === 3);
  const rarePlusBefore = eqCount(await new Promise((r) => { s.emit("devGrant", { gold: 0 }); s.once("player", r); }), "rare");
  s.emit("fuseGear");
  const pf = await waitPlayer(s, (p) => eqCount(p, "common") === 0, 5000);
  ok("3 commons consumed", eqCount(pf, "common") === 0);
  ok("a rare-or-better was produced", eqCount(pf, "rare") + eqCount(pf, "epic") >= 1, `rare=${eqCount(pf,"rare")} epic=${eqCount(pf,"epic")}`);
  await sleep(200);
  ok("fuse success message", sys.some((m) => m.includes("Hợp nhất thành công")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
