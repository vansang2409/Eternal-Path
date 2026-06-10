// Sprint 259: achievements for scratch / story / piggy loops. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("3 new achievements in catalog", ["scratch-addict", "story-hero", "piggy-breaker"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `a259${sfx}@t.vn`, accountName: `A259${sfx}`, password: "test1234" });
  await once(s, "player");

  // Piggy breaker: 1 kill fills piggy, gems pay for the hammer.
  s.emit("devSimKill", {});
  await until((p) => (p.piggyGold ?? 0) >= 2);
  s.emit("devGrant", { gems: 25, gold: 3000 });
  await until((p) => (p.gems ?? 0) >= 25);
  s.emit("breakPiggy");
  const p1 = await until((p) => p.achievements.includes("piggy-breaker"));
  ok("piggy-breaker unlocked", Boolean(p1));

  // Scratch addict: 10 deterministic misses.
  for (let i = 0; i < 10; i++) { s.emit("devScratch", { roll: 0.1 }); await once(s, "scratchResult"); }
  const p2 = await until((p) => p.achievements.includes("scratch-addict"));
  ok("scratch-addict unlocked at 10 tickets", (p2.scratchTickets ?? 0) >= 10);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
