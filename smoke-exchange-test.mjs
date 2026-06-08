// Sprint 78: Gem → Gold exchange (premium gem sink).
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-exchange-test.mjs
import { io } from "socket.io-client";
import { gemsToGold, GEM_TO_GOLD_RATE } from "./shared/dist/formulas.js";

const PORT = process.env.PORT || "3219";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

ok("gemsToGold rate", gemsToGold(10) === 10 * GEM_TO_GOLD_RATE && GEM_TO_GOLD_RATE === 100);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `xch${sfx}@t.vn`, accountName: `Xch${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");

  // Not enough gems → rejected.
  s.emit("exchangeGemsForGold", { gems: 5 });
  await sleep(400);
  ok("insufficient gems rejected", sys.some((m) => m.includes("Không đủ Gem")));

  // Grant 50 gems, exchange 30 → +3000 gold, gems 20.
  s.emit("devGrant", { gems: 50 });
  const pg = await waitPlayer(s, (p) => (p.gems ?? 0) >= 50);
  const goldBefore = pg.stats.gold;
  s.emit("exchangeGemsForGold", { gems: 30 });
  const px = await waitPlayer(s, (p) => (p.gems ?? 0) === 20);
  ok("gems deducted", px.gems === 20, `gems=${px.gems}`);
  ok("gold added at rate", px.stats.gold === goldBefore + 30 * GEM_TO_GOLD_RATE, `gold ${goldBefore}->${px.stats.gold}`);

  // Invalid (0) rejected.
  s.emit("exchangeGemsForGold", { gems: 0 });
  await sleep(400);
  ok("zero exchange rejected", sys.some((m) => m.includes("không hợp lệ")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
