// Sprint 284: tower leaderboard tab (byTower). DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `tb284${sfx}@t.vn`, accountName: `TB284${sfx}`, password: "test1234" });
  await once(s, "player");

  // Clear 1 floor with a god weapon.
  s.emit("devGrantItem", { name: "Board Pick", rarity: "epic", slot: "weapon", stats: { attack: 500 } });
  const pi = await until((p) => p.inventory.items.some((i) => i.name === "Board Pick"));
  s.emit("equipItem", { itemId: pi.inventory.items.find((i) => i.name === "Board Pick").id });
  await until((p) => p.stats.attack >= 500);
  s.emit("challengeTower");
  await until((p) => (p.towerFloor ?? 1) === 2);

  s.emit("leaderboardRequest");
  const board = await once(s, "leaderboard");
  ok("byTower present", Array.isArray(board.byTower));
  const me = board.byTower.find((r) => r.accountName === `TB284${sfx}`);
  ok("self on tower board with 1 floor cleared", me?.towerFloor === 1, JSON.stringify(me?.towerFloor));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
