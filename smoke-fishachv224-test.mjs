// Sprint 224: fishing achievements + titles. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS, TITLES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("3 fishing achievements in catalog", ["angler", "master-angler", "giant-hunter"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
ok("2 fishing titles in catalog", ["angler-title", "sea-legend"].every((id) => TITLES.some((t) => t.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `fa224${sfx}@t.vn`, accountName: `FA224${sfx}`, password: "test1234" });
  await once(s, "player");

  // 10 fish → angler.
  for (let i = 0; i < 10; i++) { s.emit("devFish", { roll: 0.2 }); await once(s, "fishResult"); }
  const p10 = await until((p) => (p.fishCaught ?? 0) >= 10);
  ok("angler unlocked at 10 fish", p10.achievements.includes("angler"));

  // Giant catch → giant-hunter + sea-legend title becomes earned.
  s.emit("devFish", { roll: 0.999 });
  await once(s, "fishResult");
  const pg = await until((p) => p.achievements.includes("giant-hunter"));
  ok("giant-hunter unlocked", Boolean(pg));
  s.emit("requestTitles");
  const titles = await once(s, "titlesUpdate");
  ok("sea-legend title earned", titles.earned.includes("sea-legend"));
  ok("angler-title not yet (needs 100)", !titles.earned.includes("angler-title"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
