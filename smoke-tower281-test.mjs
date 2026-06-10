// Sprint 281: Trial Tower — power gate, floor advance, tickets. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { playerPowerScore, towerRequirement, towerRewardGold, TOWER_TICKETS_PER_DAY } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("power formula", playerPowerScore({ attack: 10, defense: 10, maxHp: 100 }) === 60);
ok("requirement curve grows", towerRequirement(1) === 88 && towerRequirement(5) === 260 && towerRequirement(10) > towerRequirement(5));
ok("reward grows", towerRewardGold(1) === 260 && towerRewardGold(10) === 800);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `tw281${sfx}@t.vn`, accountName: `TW281${sfx}`, password: "test1234" });
  await once(s, "player");

  // Fresh hero is too weak for floor 1 → loses, ticket burned, floor stays 1.
  s.emit("challengeTower");
  const p1 = await until((p) => (p.towerTicketsUsed ?? 0) === 1);
  ok("weak hero loses floor 1", (p1.towerFloor ?? 1) === 1 && sysMsgs.some((m) => m.includes("đánh bại bạn")));

  // Equip a monster weapon (+200 atk) → power explodes past floor 1.
  s.emit("devGrantItem", { name: "Tower Breaker", rarity: "epic", slot: "weapon", stats: { attack: 200 } });
  const pi = await until((p) => p.inventory.items.some((i) => i.name === "Tower Breaker"));
  s.emit("equipItem", { itemId: pi.inventory.items.find((i) => i.name === "Tower Breaker").id });
  await until((p) => p.stats.attack >= 200);

  const gold0 = lastPlayer.stats.gold;
  s.emit("challengeTower");
  const p2 = await until((p) => (p.towerFloor ?? 1) === 2);
  ok("strong hero clears floor 1", p2.stats.gold === gold0 + towerRewardGold(1), `gold +${p2.stats.gold - gold0}`);

  // Third ticket burns, then the 4th challenge is rejected for the day.
  s.emit("challengeTower");
  await until((p) => (p.towerTicketsUsed ?? 0) === 3);
  s.emit("challengeTower");
  await sleepMs(400);
  ok("daily tickets capped", sysMsgs.some((m) => m.includes("Hết Vé Thí Luyện")) && TOWER_TICKETS_PER_DAY === 3);

  // Reset tickets, climb to floor 5 → gem bonus on the 5th clear.
  s.emit("devTowerReset");
  await until((p) => (p.towerTicketsUsed ?? 1) === 0);
  const gems0 = lastPlayer.gems ?? 0;
  let guard = 0;
  while ((lastPlayer.towerFloor ?? 1) < 6 && guard < 12) {
    guard += 1;
    s.emit("challengeTower");
    await sleepMs(250);
    if ((lastPlayer.towerTicketsUsed ?? 0) >= 3) { s.emit("devTowerReset"); await sleepMs(200); }
  }
  const p3 = await until((p) => (p.towerFloor ?? 1) >= 6, 6000);
  ok("floor-5 clear pays gems", (p3.gems ?? 0) === gems0 + 10, `gems ${gems0}->${p3.gems}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
