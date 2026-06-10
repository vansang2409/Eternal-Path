// Sprint 249: fishing & scratch daily quests progress + claim. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastQuests = null; let lastPlayer = null;
  s.on("questList", (q) => { lastQuests = q; });
  s.on("player", (p) => { lastPlayer = p; });
  const untilQ = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastQuests && pred(lastQuests)) return lastQuests; await sleepMs(100); } throw new Error("untilQ timeout"); };
  const activeQ = (q, id) => (q.active ?? []).find((v) => v.id === id);

  s.emit("login", { email: `df249${sfx}@t.vn`, accountName: `DF249${sfx}`, password: "test1234" });
  await once(s, "player");

  // Clear the random daily roll and take the fishing daily directly.
  s.emit("devClearQuests");
  await sleepMs(300);
  s.emit("acceptQuest", { questId: "daily-fish-5" });
  const q1 = await untilQ((q) => Boolean(activeQ(q, "daily-fish-5")));
  ok("fishing daily accepted", Boolean(q1));

  // 5 catches (rolls that always land fish) → progress 5/5.
  for (let i = 0; i < 5; i++) { s.emit("devFish", { roll: 0.2 }); await once(s, "fishResult"); }
  await sleepMs(400);
  s.emit("requestQuests"); // harmless if unsupported; questList also flows on actions
  const q2 = await untilQ((q) => (activeQ(q, "daily-fish-5")?.progress ?? 0) >= 5);
  ok("progress 5/5 after 5 catches", activeQ(q2, "daily-fish-5").completed === true);

  const gold0 = lastPlayer.stats.gold;
  s.emit("claimQuest", { questId: "daily-fish-5" });
  const q3 = await untilQ((q) => !activeQ(q, "daily-fish-5"));
  await sleepMs(300);
  ok("claim pays 250 gold", lastPlayer.stats.gold === gold0 + 250, `gold ${gold0}->${lastPlayer.stats.gold}`);

  // Scratch daily: accept, scratch once, claim.
  s.emit("acceptQuest", { questId: "daily-scratch-1" });
  await untilQ((q) => Boolean(activeQ(q, "daily-scratch-1")));
  s.emit("devGrant", { gold: 300 });
  await sleepMs(300);
  s.emit("devScratch", { roll: 0.1 });
  await once(s, "scratchResult");
  const q4 = await untilQ((q) => (activeQ(q, "daily-scratch-1")?.progress ?? 0) >= 1);
  ok("scratch daily progressed", activeQ(q4, "daily-scratch-1").completed === true);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
