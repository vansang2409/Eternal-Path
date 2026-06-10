// Sprint 231: piggy bank — kills drip gold, gems break it open. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { PIGGY_GOLD_PER_KILL, PIGGY_GOLD_CAP, PIGGY_BREAK_GEM_COST, piggyAfterKill } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("2 gold per kill", PIGGY_GOLD_PER_KILL === 2 && piggyAfterKill(0) === 2);
ok("cap holds", piggyAfterKill(PIGGY_GOLD_CAP) === PIGGY_GOLD_CAP);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `pg231${sfx}@t.vn`, accountName: `PG231${sfx}`, password: "test1234" });
  await once(s, "player");

  // 3 kills → piggy 6.
  for (let i = 0; i < 3; i++) { s.emit("devSimKill", {}); await sleepMs(150); }
  const p1 = await until((p) => (p.piggyGold ?? 0) === 6);
  ok("piggy 6 after 3 kills", Boolean(p1));

  // Break without gems → rejected.
  s.emit("breakPiggy");
  await sleepMs(400);
  ok("break without gems rejected", sysMsgs.some((m) => m.includes(`Cần ${PIGGY_BREAK_GEM_COST}`)) && (lastPlayer.piggyGold ?? 0) === 6);

  // Grant gems, break → +6 gold, piggy 0, gems -25.
  s.emit("devGrant", { gems: PIGGY_BREAK_GEM_COST });
  await until((p) => (p.gems ?? 0) >= PIGGY_BREAK_GEM_COST);
  const goldBefore = lastPlayer.stats.gold; const gemsBefore = lastPlayer.gems;
  s.emit("breakPiggy");
  const p2 = await until((p) => (p.piggyGold ?? 0) === 0 && p.stats.gold === goldBefore + 6);
  ok("piggy paid out", p2.stats.gold === goldBefore + 6 && p2.gems === gemsBefore - PIGGY_BREAK_GEM_COST);

  // Empty piggy break → friendly rejection.
  s.emit("breakPiggy");
  await sleepMs(400);
  ok("empty piggy rejected", sysMsgs.some((m) => m.includes("rỗng")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
