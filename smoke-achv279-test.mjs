// Sprint 279: season/collection achievements + titles. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS, TITLES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("2 new achievements", ["season-warrior", "pet-zoo"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
ok("2 new titles", ["season-champ", "evolved-master"].every((id) => TITLES.some((t) => t.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `a279${sfx}@t.vn`, accountName: `A279${sfx}`, password: "test1234" });
  await once(s, "player");

  // 10 arena kills in one season → season-warrior + earned title.
  for (let i = 0; i < 10; i++) { s.emit("devArenaKill"); await sleepMs(120); }
  const p1 = await until((p) => p.achievements.includes("season-warrior"));
  ok("season-warrior at 10 season kills", (p1.arenaSeasonKills ?? 0) >= 10);
  s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("season-champ title earned", tu.earned.includes("season-champ"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
