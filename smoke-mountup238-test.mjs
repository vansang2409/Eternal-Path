// Sprint 238: mount upgrades — gold costs, level cap, speed math. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { MOUNT_MAX_LEVEL, mountUpgradeCost, mountSpeedBonusAt, MOUNT_CATALOG } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("cap 3, costs 2k/5k/10k", MOUNT_MAX_LEVEL === 3 && mountUpgradeCost(0) === 2000 && mountUpgradeCost(2) === 10000 && mountUpgradeCost(3) === undefined);
ok("pony L2 = 15+10 = 25%", mountSpeedBonusAt("pony", 2) === 25);
ok("no mount = 0 at any level", mountSpeedBonusAt(undefined, 3) === 0);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `mu238${sfx}@t.vn`, accountName: `MU238${sfx}`, password: "test1234" });
  await once(s, "player");

  // Not owned → rejected.
  s.emit("upgradeMount", { mountId: "pony" });
  await sleepMs(400);
  ok("unowned mount rejected", sysMsgs.some((m) => m.includes("chưa sở hữu")));

  // Buy pony (15k), upgrade twice (2k + 5k).
  s.emit("devGrant", { gold: 25_000 });
  await until((p) => p.stats.gold >= 25_000);
  s.emit("buyMount", { mountId: "pony" });
  await until((p) => (p.ownedMounts ?? []).includes("pony"));
  const goldAfterBuy = lastPlayer.stats.gold;

  s.emit("upgradeMount", { mountId: "pony" });
  const p1 = await until((p) => (p.mountLevels?.pony ?? 0) === 1);
  ok("upgrade L1 costs 2000", p1.stats.gold === goldAfterBuy - 2000);

  s.emit("upgradeMount", { mountId: "pony" });
  const p2 = await until((p) => (p.mountLevels?.pony ?? 0) === 2);
  ok("upgrade L2 costs 5000", p2.stats.gold === goldAfterBuy - 7000);

  // Broke → rejected at L2→L3 (needs 10k).
  s.emit("upgradeMount", { mountId: "pony" });
  await sleepMs(400);
  ok("broke upgrade rejected", sysMsgs.some((m) => m.includes("Cần 10.000")) && (lastPlayer.mountLevels?.pony ?? 0) === 2);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
