// Sprint 235: kill-streak combo — chained kills, gold bonus curve. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { killStreakGoldBonus, KILL_STREAK_WINDOW_MS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("window is 8s", KILL_STREAK_WINDOW_MS === 8000);
ok("bonus curve", killStreakGoldBonus(4) === 0 && killStreakGoldBonus(5) === 0.1 && killStreakGoldBonus(10) === 0.2 && killStreakGoldBonus(99) === 0.5);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  const streaks = [];
  s.on("killStreak", (p) => streaks.push(p));
  s.emit("login", { email: `ks235${sfx}@t.vn`, accountName: `KS235${sfx}`, password: "test1234" });
  await once(s, "player");

  // 6 rapid kills → streak counts 1..6, bonus kicks in at 5.
  for (let i = 0; i < 6; i++) { s.emit("devSimKill", {}); await sleepMs(120); }
  await sleepMs(500);
  ok("6 streak events", streaks.length === 6, `n=${streaks.length}`);
  ok("streak increments 1..6", streaks.map((x) => x.streak).join(",") === "1,2,3,4,5,6");
  ok("bonus 0 before 5, 0.1 at 5+", streaks[3].bonus === 0 && streaks[4].bonus === 0.1 && streaks[5].bonus === 0.1);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
