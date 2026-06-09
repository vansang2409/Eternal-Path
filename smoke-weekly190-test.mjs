// Sprint 190: weekly login reward. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { WEEKLY_REWARD_GOLD, WEEKLY_REWARD_GEMS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
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
  s.emit("login", { email: `wk${sfx}@t.vn`, accountName: `WK${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gold0 = p0.stats.gold, gems0 = p0.gems ?? 0;

  s.emit("claimWeeklyReward");
  const pc = await waitPlayer(s, (p) => (p.lastWeeklyClaimAt ?? 0) > 0, 4000);
  ok("weekly timestamp set", (pc.lastWeeklyClaimAt ?? 0) > 0);
  ok("gold +20000", pc.stats.gold === gold0 + WEEKLY_REWARD_GOLD, `gold ${gold0}->${pc.stats.gold}`);
  ok("gems +50", (pc.gems ?? 0) === gems0 + WEEKLY_REWARD_GEMS);

  // Second claim within cooldown → rejected.
  sys.length = 0;
  s.emit("claimWeeklyReward");
  await sleep(300);
  ok("second claim within cooldown rejected", sys.some((m) => m.includes("Thưởng tuần đã nhận")));

  // Persist across relogin.
  s.disconnect();
  await sleep(300);
  const s2 = await connect();
  s2.emit("login", { email: `wk${sfx}@t.vn`, accountName: `WK${sfx}`, password: "test1234" });
  const relog = await once(s2, "player");
  ok("weekly timestamp persists", (relog.lastWeeklyClaimAt ?? 0) > 0);
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
