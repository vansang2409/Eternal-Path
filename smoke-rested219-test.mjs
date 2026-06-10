// Sprint 219: rested XP — offline pool drains as +50% kill-EXP bonus. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { RESTED_XP_CAP, RESTED_XP_PER_HOUR, restedXpForOffline, restedBonusFor } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

// Unit checks.
ok("0ms offline = 0 pool", restedXpForOffline(0) === 0);
ok("1h offline = 200 pool", restedXpForOffline(3_600_000) === RESTED_XP_PER_HOUR);
ok("48h offline caps at 4800", restedXpForOffline(48 * 3_600_000) === RESTED_XP_CAP);
ok("bonus = min(pool, 50%)", restedBonusFor(1000, 46) === 23 && restedBonusFor(5, 46) === 5 && restedBonusFor(0, 46) === 0);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `rx219${sfx}@t.vn`, accountName: `RX219${sfx}`, password: "test1234" });
  await once(s, "player");

  // Burn the (future) first-kill-of-day bonus so the rested math below is stable.
  s.emit("devSimKill", {});
  await waitPlayer(s, (p) => (p.totalKills ?? 0) >= 1);

  s.emit("devGrant", { restedXp: 1000 });
  await waitPlayer(s, (p) => (p.restedXp ?? 0) === 1000);

  // Base kill EXP at monster level 1 = floor((28 + 18*1) * 1) = 46 → bonus 23.
  s.emit("devSimKill", { level: 1 });
  const p2 = await waitPlayer(s, (p) => (p.restedXp ?? 0) < 1000);
  ok("pool drained by 23 (1000->977)", p2.restedXp === 977, `restedXp=${p2.restedXp}`);

  s.emit("devSimKill", { level: 1 });
  const p3 = await waitPlayer(s, (p) => (p.restedXp ?? 0) < 977);
  ok("pool drains again (977->954)", p3.restedXp === 954, `restedXp=${p3.restedXp}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
