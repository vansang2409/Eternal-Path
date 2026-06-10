// Sprint 233: returning-player reward tiers. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { returningRewardFor, RETURNING_TIERS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;

ok("2 tiers configured", RETURNING_TIERS.length === 2);
ok("1 day away = nothing", returningRewardFor(1 * DAY) === undefined);
ok("3 days away = small tier", returningRewardFor(3 * DAY)?.gold === 1500);
ok("10 days away = big tier", returningRewardFor(10 * DAY)?.gems === 50);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `rt233${sfx}@t.vn`, accountName: `RT233${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gold0 = p0.stats.gold; const gems0 = p0.gems ?? 0;

  // 1 day → no gift.
  s.emit("devReturning", { days: 1 });
  await sleepMs(400);
  ok("1 day grants nothing", lastPlayer.stats.gold === gold0 && (lastPlayer.gems ?? 0) === gems0);

  // 4 days → small tier.
  s.emit("devReturning", { days: 4 });
  const p1 = await until((p) => p.stats.gold === gold0 + 1500);
  ok("4 days grants 1500/20", p1.stats.gold === gold0 + 1500 && (p1.gems ?? 0) === gems0 + 20);
  ok("welcome message shown", sysMsgs.some((m) => m.includes("Mừng bạn trở lại")));

  // 8 days → big tier.
  s.emit("devReturning", { days: 8 });
  const p2 = await until((p) => p.stats.gold === gold0 + 1500 + 4000);
  ok("8 days grants 4000/50", (p2.gems ?? 0) === gems0 + 20 + 50);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
