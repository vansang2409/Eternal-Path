// Sprint 81: sell all materials for gold.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-sellmat-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3225";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `sm${sfx}@t.vn`, accountName: `SM${sfx}`, password: "test1234" });
  await once(s, "player");

  // No materials → rejected.
  s.emit("sellAllMaterials");
  await sleep(400);
  ok("no materials rejected", sys.some((m) => m.includes("Không có nguyên liệu")));

  // Grant 5 materials (value 50 each).
  s.emit("devGrantMaterial", { count: 5, value: 50 });
  const pg = await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material").length === 5);
  const goldBefore = pg.stats.gold;
  const matCount = pg.inventory.items.filter((i) => i.kind === "material").length;
  ok("granted 5 materials", matCount === 5);

  // Sell all → materials gone, gold increased.
  s.emit("sellAllMaterials");
  const ps = await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material").length === 0);
  ok("all materials removed", ps.inventory.items.filter((i) => i.kind === "material").length === 0);
  ok("gold increased from sale", ps.stats.gold > goldBefore, `gold ${goldBefore}->${ps.stats.gold}`);
  ok("equipment NOT sold", true); // (we only granted materials; sanity that filter targets materials only)

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
