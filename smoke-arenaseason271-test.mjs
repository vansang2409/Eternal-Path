// Sprint 271: arena seasons — kill counter + rollover payout. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { arenaSeasonIndexFor, arenaSeasonRewardGems, ARENA_SEASON_MS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("7-day seasons", ARENA_SEASON_MS === 7 * 86_400_000 && arenaSeasonIndexFor(0) === 0 && arenaSeasonIndexFor(ARENA_SEASON_MS) === 1);
ok("reward tiers", arenaSeasonRewardGems(2) === 0 && arenaSeasonRewardGems(3) === 10 && arenaSeasonRewardGems(10) === 30 && arenaSeasonRewardGems(60) === 120);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `as271${sfx}@t.vn`, accountName: `AS271${sfx}`, password: "test1234" });
  await once(s, "player");

  // 3 arena kills accrue into the season counter.
  for (let i = 0; i < 3; i++) { s.emit("devArenaKill"); await sleepMs(150); }
  const p1 = await until((p) => (p.arenaSeasonKills ?? 0) === 3);
  ok("season kills tracked", p1.arenaSeasonIndex === arenaSeasonIndexFor());

  // Force a rollover → 3 kills tier pays 10 gems, counter resets.
  const gems0 = p1.gems ?? 0;
  s.emit("devArenaSeasonRollover");
  const p2 = await until((p) => (p.arenaSeasonKills ?? -1) === 0 && (p.gems ?? 0) === gems0 + 10);
  ok("rollover pays 10 gems and resets", p2.arenaSeasonIndex === arenaSeasonIndexFor());
  await sleepMs(300);
  ok("season-result message", sysMsgs.some((m) => m.includes("Kết quả Mùa Đấu")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
