// Sprint 282: tower achievements + titles. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS, TITLES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("2 tower achievements", ["tower-10", "tower-25"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
ok("2 tower titles", ["tower-conqueror", "tower-legend"].every((id) => TITLES.some((t) => t.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `t282${sfx}@t.vn`, accountName: `T282${sfx}`, password: "test1234" });
  await once(s, "player");

  // God weapon, then grind to floor 11 (resetting tickets as needed).
  s.emit("devGrantItem", { name: "God Pick", rarity: "epic", slot: "weapon", stats: { attack: 2000 } });
  const pi = await until((p) => p.inventory.items.some((i) => i.name === "God Pick"));
  s.emit("equipItem", { itemId: pi.inventory.items.find((i) => i.name === "God Pick").id });
  await until((p) => p.stats.attack >= 2000);

  let guard = 0;
  while ((lastPlayer.towerFloor ?? 1) < 11 && guard < 30) {
    guard += 1;
    s.emit("challengeTower");
    await sleepMs(200);
    if ((lastPlayer.towerTicketsUsed ?? 0) >= 3) { s.emit("devTowerReset"); await sleepMs(150); }
  }
  const p1 = await until((p) => (p.towerFloor ?? 1) >= 11);
  ok("tower-10 unlocked at floor 11", p1.achievements.includes("tower-10"));
  s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("tower-conqueror earned", tu.earned.includes("tower-conqueror"));
  ok("tower-legend not yet", !tu.earned.includes("tower-legend"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
