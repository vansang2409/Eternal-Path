// Sprint 277: high-end mounts (griffon / nightmare). DEV_CHEATS=1.
import { io } from "socket.io-client";
import { MOUNT_CATALOG, getMount, mountSpeedBonusAt } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("5 mounts in catalog", MOUNT_CATALOG.length === 5);
ok("nightmare +55% / 500k", getMount("nightmare")?.speedPct === 55 && getMount("nightmare")?.goldPrice === 500_000);
ok("griffon L3 = 45+15 = 60%", mountSpeedBonusAt("griffon", 3) === 60);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `mt277${sfx}@t.vn`, accountName: `MT277${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrant", { gold: 260_000 });
  await until((p) => p.stats.gold >= 260_000);
  const gold0 = lastPlayer.stats.gold;
  s.emit("buyMount", { mountId: "griffon" });
  const p1 = await until((p) => (p.ownedMounts ?? []).includes("griffon"));
  ok("griffon bought (-250k)", p1.stats.gold === gold0 - 250_000, `gold ${gold0}->${p1.stats.gold}`);
  s.emit("equipMount", { mountId: "griffon" });
  const p2 = await until((p) => p.activeMount === "griffon");
  ok("griffon equipped", Boolean(p2));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
