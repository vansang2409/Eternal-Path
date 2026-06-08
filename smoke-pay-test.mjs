// Sprint 86: /pay gold transfer between players (5% tax).
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-pay-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3232";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  const aSys = [];
  a.on("system", (m) => aSys.push(m));
  a.emit("login", { email: `pa${sfx}@t.vn`, accountName: `PayA${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `pb${sfx}@t.vn`, accountName: `PayB${sfx}`, password: "test1234" });
  const bp0 = await once(b, "player");

  // Insufficient gold → rejected.
  a.emit("payPlayer", { to: `PayB${sfx}`, amount: 1000 });
  await sleep(400);
  ok("insufficient rejected", aSys.some((m) => m.includes("Không đủ vàng")));

  // Pay self → rejected.
  a.emit("devGrant", { gold: 10000 });
  const ap = await waitPlayer(a, (p) => p.stats.gold >= 10000);
  a.emit("payPlayer", { to: `PayA${sfx}`, amount: 100 });
  await sleep(400);
  ok("self-pay rejected", aSys.some((m) => m.includes("cho chính mình")));

  // Offline target → rejected.
  a.emit("payPlayer", { to: "NoSuchUser999", amount: 100 });
  await sleep(400);
  ok("offline target rejected", aSys.some((m) => m.includes("không online")));

  // Valid transfer: A pays 1000 → A -1000, B +950 (5% tax).
  const aGold = ap.stats.gold, bGold = bp0.stats.gold;
  a.emit("payPlayer", { to: `PayB${sfx}`, amount: 1000 });
  const aAfter = await waitPlayer(a, (p) => p.stats.gold === aGold - 1000);
  const bAfter = await waitPlayer(b, (p) => p.stats.gold === bGold + 950);
  ok("sender debited full amount", aAfter.stats.gold === aGold - 1000, `a=${aAfter.stats.gold}`);
  ok("recipient credited net (5% tax)", bAfter.stats.gold === bGold + 950, `b=${bAfter.stats.gold}`);

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
