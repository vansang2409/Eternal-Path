// Sprint 79: gold boost potion (premium timed +50% gold).
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-goldboost-test.mjs
import { io } from "socket.io-client";
import { isGoldBoostActive, GOLD_BOOST_GEM_COST, GOLD_BOOST_MULTIPLIER } from "./shared/dist/formulas.js";

const PORT = process.env.PORT || "3221";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

ok("isGoldBoostActive helper", isGoldBoostActive(Date.now() + 1000) && !isGoldBoostActive(Date.now() - 1000) && !isGoldBoostActive(undefined));
ok("multiplier 1.5x", GOLD_BOOST_MULTIPLIER === 1.5);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `gb${sfx}@t.vn`, accountName: `GBst${sfx}`, password: "test1234" });
  await once(s, "player");

  // Poor → rejected.
  s.emit("buyGoldBoost");
  await sleep(400);
  ok("poor rejected", sys.some((m) => m.includes("để mua Bình Tăng Vàng")));

  // Grant gems, buy → goldBoostUntil set in the future, gems -40.
  s.emit("devGrant", { gems: 100 });
  const pg = await waitPlayer(s, (p) => (p.gems ?? 0) >= 100);
  s.emit("buyGoldBoost");
  const pb = await waitPlayer(s, (p) => isGoldBoostActive(p.goldBoostUntil));
  ok("boost active after purchase", isGoldBoostActive(pb.goldBoostUntil));
  ok("gems deducted by cost", pb.gems === 100 - GOLD_BOOST_GEM_COST, `gems=${pb.gems}`);

  // Double-buy rejected while active.
  s.emit("buyGoldBoost");
  await sleep(400);
  ok("double boost rejected", sys.some((m) => m.includes("đang còn hiệu lực")));

  // Persists across relogin.
  await sleep(300);
  s.disconnect();
  await sleep(400);
  const s2 = await connect();
  s2.emit("login", { email: `gb${sfx}@t.vn`, accountName: `GBst${sfx}`, password: "test1234" });
  const relog = await once(s2, "player");
  ok("boost persists across relogin", isGoldBoostActive(relog.goldBoostUntil));
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
