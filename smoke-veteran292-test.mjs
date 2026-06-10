// Sprint 292: veteran pack — level gate, one-time claim. DEV_CHEATS=1.
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
  const until = async (pred, t = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `vp292${sfx}@t.vn`, accountName: `VP292${sfx}`, password: "test1234" });
  await once(s, "player");

  // Level 1 → rejected.
  s.emit("claimVeteranPack");
  await sleepMs(400);
  ok("level gate at 20", sysMsgs.some((m) => m.includes("yêu cầu cấp 20")));

  // Big exp dump to level past 20 → claim succeeds.
  s.emit("devGrant", { exp: 500_000 });
  await until((p) => p.stats.level >= 20);
  const gold0 = lastPlayer.stats.gold; const gems0 = lastPlayer.gems ?? 0;
  s.emit("claimVeteranPack");
  const p1 = await until((p) => p.veteranPackClaimed === true);
  ok("pack pays 5000/50 + map", p1.stats.gold === gold0 + 5000 && p1.gems === gems0 + 50 && p1.inventory.items.some((i) => i.treasureMap));

  // Double claim rejected.
  s.emit("claimVeteranPack");
  await sleepMs(400);
  ok("double claim rejected", sysMsgs.some((m) => m.includes("đã nhận Gói Cao Thủ")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
