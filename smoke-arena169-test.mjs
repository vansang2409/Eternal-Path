// Sprint 169: arena kill rewards (gold + gems bounty). DEV_CHEATS=1.
// Run: node smoke-arena169-test.mjs
import { io } from "socket.io-client";
import { ARENA_KILL_GOLD, ARENA_KILL_GEMS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("reward constants", ARENA_KILL_GOLD === 400 && ARENA_KILL_GEMS === 2);
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `ar${sfx}@t.vn`, accountName: `AR${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gold0 = p0.stats.gold, gems0 = p0.gems ?? 0, kills0 = p0.pvpKills ?? 0;

  s.emit("devArenaKill");
  const p1 = await waitPlayer(s, (p) => (p.pvpKills ?? 0) === kills0 + 1, 4000);
  ok("pvpKills incremented", (p1.pvpKills ?? 0) === kills0 + 1);
  ok("gold bounty +400", p1.stats.gold === gold0 + ARENA_KILL_GOLD, `gold ${gold0}->${p1.stats.gold}`);
  ok("gem bounty +2", (p1.gems ?? 0) === gems0 + ARENA_KILL_GEMS, `gems ${gems0}->${p1.gems}`);
  ok("pvp-victor achievement unlocked", (p1.achievements ?? []).includes("pvp-victor"));

  // A second kill stacks rewards.
  s.emit("devArenaKill");
  const p2 = await waitPlayer(s, (p) => (p.pvpKills ?? 0) === kills0 + 2, 4000);
  ok("rewards stack on 2nd kill", p2.stats.gold === gold0 + ARENA_KILL_GOLD * 2);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
