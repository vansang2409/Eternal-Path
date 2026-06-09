// Sprint 153: XP boost potion (Bình Tăng XP) — premium +50% EXP for 30 min.
// Server: DEV_CHEATS=1. Run: node smoke-xpboost-test.mjs
import { io } from "socket.io-client";
import { isXpBoostActive, XP_BOOST_GEM_COST, XP_BOOST_MULTIPLIER } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("isXpBoostActive helper", isXpBoostActive(Date.now() + 1000) && !isXpBoostActive(Date.now() - 1000) && !isXpBoostActive(undefined));
  ok("multiplier 1.5x", XP_BOOST_MULTIPLIER === 1.5);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `xb${sfx}@t.vn`, accountName: `XB${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("buyXpBoost");
  await sleep(350);
  ok("poor rejected", sys.some((m) => m.includes("để mua Bình Tăng XP")));

  s.emit("devGrant", { gems: 100 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 100);
  s.emit("buyXpBoost");
  const pb = await waitPlayer(s, (p) => isXpBoostActive(p.xpBoostUntil));
  ok("boost active after purchase", isXpBoostActive(pb.xpBoostUntil));
  ok("gems deducted by cost", pb.gems === 100 - XP_BOOST_GEM_COST, `gems=${pb.gems}`);

  sys.length = 0;
  s.emit("buyXpBoost");
  await sleep(350);
  ok("double boost rejected", sys.some((m) => m.includes("đang còn hiệu lực")));

  // Persist across relogin.
  s.disconnect();
  await sleep(300);
  const s2 = await connect();
  s2.emit("login", { email: `xb${sfx}@t.vn`, accountName: `XB${sfx}`, password: "test1234" });
  const relog = await once(s2, "player");
  ok("boost persists across relogin", isXpBoostActive(relog.xpBoostUntil));
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
