// Sprint 217: bestiary — per-type kill tiers pay rewards once. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { BESTIARY_TIERS, bestiaryTierForKills, nextBestiaryTier } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

// Unit checks on the pure helpers.
ok("3 tiers", BESTIARY_TIERS.length === 3);
ok("9 kills = no tier", bestiaryTierForKills(9) === 0);
ok("10 kills = tier 1", bestiaryTierForKills(10) === 1);
ok("200 kills = tier 3", bestiaryTierForKills(200) === 3);
ok("next tier from 12 kills = silver", nextBestiaryTier(12)?.tier === 2);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `bt217${sfx}@t.vn`, accountName: `BT217${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gold0 = p0.stats.gold; const gems0 = p0.gems ?? 0;

  s.emit("devBestiaryKill", { type: "forestSlime", count: 9 });
  const p9 = await waitPlayer(s, (p) => (p.bestiary?.forestSlime ?? 0) === 9);
  ok("9 kills tracked, no reward yet", p9.stats.gold === gold0 && (p9.bestiaryRewarded?.forestSlime ?? 0) === 0);

  s.emit("devBestiaryKill", { type: "forestSlime", count: 1 });
  const p10 = await waitPlayer(s, (p) => (p.bestiary?.forestSlime ?? 0) === 10);
  ok("tier 1 gold paid (+300)", p10.stats.gold === gold0 + 300, `gold ${gold0}->${p10.stats.gold}`);
  ok("scholar achievement", p10.achievements.includes("scholar"));
  ok("rewarded tier = 1", (p10.bestiaryRewarded?.forestSlime ?? 0) === 1);

  s.emit("devBestiaryKill", { type: "forestSlime", count: 40 });
  const p50 = await waitPlayer(s, (p) => (p.bestiary?.forestSlime ?? 0) === 50);
  ok("tier 2 gems paid (+10)", (p50.gems ?? 0) >= gems0 + 10 + 10, `gems ${gems0}->${p50.gems}`); // +10 tier2, +10 scholar
  ok("rewarded tier = 2", (p50.bestiaryRewarded?.forestSlime ?? 0) === 2);

  // Re-credit must not double pay: counts rise, rewarded tier stays.
  s.emit("devBestiaryKill", { type: "forestSlime", count: 5 });
  const p55 = await waitPlayer(s, (p) => (p.bestiary?.forestSlime ?? 0) === 55);
  ok("no double reward", (p55.gems ?? 0) === (p50.gems ?? 0) && (p55.bestiaryRewarded?.forestSlime ?? 0) === 2);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
