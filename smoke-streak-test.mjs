// Sprint 61: unit-test computeStreakClaim (date logic) + e2e claim/reject.
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-streak-test.mjs
import { io } from "socket.io-client";
import { computeStreakClaim, streakRewardFor, dateKeyAddDays, canClaimStreakToday, STREAK_REWARDS } from "./shared/dist/dailyStreak.js";

const PORT = process.env.PORT || "3187";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 140) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
  setTimeout(() => rej(new Error("connect timeout")), 5000);
});
const once = (s, ev, t = 5000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout player pred")), t);
  const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } };
  s.on("player", fn);
});

// ── Unit tests: pure date/streak logic ──
const T = "2026-06-08";
ok("dateKeyAddDays -1", dateKeyAddDays(T, -1) === "2026-06-07");
ok("dateKeyAddDays +1 month wrap", dateKeyAddDays("2026-06-30", 1) === "2026-07-01");
ok("first claim → streak 1", (() => { const r = computeStreakClaim(undefined, T, 0); return r.canClaim && r.newStreak === 1 && r.reward.day === 1; })());
ok("consecutive day → +1", (() => { const r = computeStreakClaim("2026-06-07", T, 3); return r.canClaim && r.newStreak === 4; })());
ok("same day → rejected", (() => { const r = computeStreakClaim(T, T, 4); return !r.canClaim && r.reason === "alreadyClaimed" && r.newStreak === 4; })());
ok("missed a day → reset to 1", (() => { const r = computeStreakClaim("2026-06-05", T, 6); return r.canClaim && r.newStreak === 1; })());
ok("streak wraps 7→8 reward day1", (() => { const r = computeStreakClaim(dateKeyAddDays(T, -1), T, 7); return r.newStreak === 8 && r.reward.day === 1; })());
ok("reward day7 is jackpot 100 gem", streakRewardFor(7).gems === 100 && streakRewardFor(7).day === 7);
ok("reward wraps day14→day7", streakRewardFor(14).day === 7);
ok("canClaimStreakToday false when claimed today", canClaimStreakToday(T, T) === false);
ok("canClaimStreakToday true when not today", canClaimStreakToday("2026-06-07", T) === true);
ok("catalog has 7 days", STREAK_REWARDS.length === 7);

// ── e2e: claim once, reject second same-day claim ──
const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `strk${sfx}@t.vn`, accountName: `Strk${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gold0 = p0.stats.gold;
  const gems0 = p0.gems ?? 0;

  // First claim → day 1 = 200 gold, streak 1.
  s.emit("claimLoginStreak");
  const p1 = await waitPlayer(s, (p) => p.loginStreak === 1, 4000).catch(() => null);
  ok("first claim sets streak 1", !!p1 && p1.loginStreak === 1, `streak=${p1?.loginStreak}`);
  ok("first claim grants 200 gold", !!p1 && p1.stats.gold === gold0 + 200, `gold ${gold0}→${p1?.stats.gold}`);
  ok("streakLastClaimDate set", !!p1 && typeof p1.streakLastClaimDate === "string");

  // Second claim same day → rejected.
  s.emit("claimLoginStreak");
  await sleep(500);
  ok("second same-day claim rejected", sys.some((m) => m.includes("đã điểm danh rồi")));
  // Gold unchanged after rejection.
  const p2 = await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); });
  ok("no double reward", p2.stats.gold === gold0 + 200, `gold=${p2.stats.gold}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
