// Sprint 296: finale achievements — era-300 on login, completionist at 40. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS, TITLES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("catalog hits 60+ achievements", ACHIEVEMENTS.length >= 60, `n=${ACHIEVEMENTS.length}`);
ok("finale entries present", ["completionist-40", "era-300"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)) && TITLES.some((t) => t.id === "vinh-hang-chi-chu"));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `fn296${sfx}@t.vn`, accountName: `FN296${sfx}`, password: "test1234" });
  await once(s, "player");

  // era-300 lands on login.
  const p0 = await until((p) => p.achievements.includes("era-300"));
  ok("era-300 granted on login", Boolean(p0));

  // Seed 39 achievements via dev, then one REAL unlock trips the meta.
  const seed = ACHIEVEMENTS.filter((a) => !["completionist-40", "era-300", "first-blood"].includes(a.id)).slice(0, 38).map((a) => a.id);
  for (const id of seed) s.emit("devGrantAchievement", { id });
  await until((p) => p.achievements.length >= 39);
  s.emit("devSimKill", {}); // first-blood via the real unlock path
  const p1 = await until((p) => p.achievements.includes("completionist-40"));
  ok("completionist-40 trips at 40 unlocks", p1.achievements.length >= 40, `n=${p1.achievements.length}`);
  s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("finale title earned", tu.earned.includes("vinh-hang-chi-chu"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
