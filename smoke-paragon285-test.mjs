// Sprint 285: paragon — 100 kills = +1 point (+1 atk, +5 HP), cap 50. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { PARAGON_KILLS_PER_POINT, PARAGON_MAX_POINTS, paragonProgressView, ACHIEVEMENTS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("constants", PARAGON_KILLS_PER_POINT === 100 && PARAGON_MAX_POINTS === 50);
ok("view math", paragonProgressView(2, 40).into === 40 && paragonProgressView(50, 0).maxed === true);
ok("paragon achievements in catalog", ["paragon-1", "paragon-10"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `pg285${sfx}@t.vn`, accountName: `PG285${sfx}`, password: "test1234" });
  await once(s, "player");

  // Prime to 99/100 then one kill converts the point.
  s.emit("devGrant", { paragonProgress: 99 });
  await until((p) => (p.paragonProgress ?? 0) === 99);
  const atk0 = lastPlayer.stats.attack; const hp0 = lastPlayer.stats.maxHp;
  s.emit("devSimKill", {});
  const p1 = await until((p) => (p.paragonPoints ?? 0) === 1);
  ok("point earned at 100 kills", p1.paragonProgress === 0);
  ok("stats baked (+1 atk, +5 HP)", p1.stats.attack === atk0 + 1 && p1.stats.maxHp === hp0 + 5);
  ok("paragon-1 achievement", p1.achievements.includes("paragon-1"));

  // At the cap no more progress accrues.
  s.emit("devGrant", { paragonPoints: PARAGON_MAX_POINTS, paragonProgress: 99 });
  await until((p) => (p.paragonPoints ?? 0) === PARAGON_MAX_POINTS);
  s.emit("devSimKill", {});
  await sleepMs(500);
  ok("capped at 50 points", (lastPlayer.paragonPoints ?? 0) === PARAGON_MAX_POINTS && (lastPlayer.paragonProgress ?? 0) === 99);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
