// Sprint 220: first kill of the day grants x2 EXP (once per UTC day). DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `fk220${sfx}@t.vn`, accountName: `FK220${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  ok("fresh player has no firstKillDate", !p0.firstKillDate);

  s.emit("devSimKill", {});
  const p1 = await waitPlayer(s, (p) => (p.totalKills ?? 0) >= 1);
  const today = new Date().toISOString().slice(0, 10);
  ok("firstKillDate set to today", p1.firstKillDate === today, p1.firstKillDate);
  await sleep(400);
  const bonusCount1 = sysMsgs.filter((m) => m.includes("x2 EXP")).length;
  ok("x2 EXP message on first kill", bonusCount1 === 1, `count=${bonusCount1}`);

  s.emit("devSimKill", {});
  await waitPlayer(s, (p) => (p.totalKills ?? 0) >= 2);
  await sleep(400);
  const bonusCount2 = sysMsgs.filter((m) => m.includes("x2 EXP")).length;
  ok("no second x2 the same day", bonusCount2 === 1, `count=${bonusCount2}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
