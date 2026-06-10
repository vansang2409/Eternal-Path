// Sprint 172: mounts — gold-bought move-speed rides. DEV_CHEATS=1.
// Run: node smoke-mounts172-test.mjs
import { io } from "socket.io-client";
import { MOUNT_CATALOG, getMount, mountSpeedBonus } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("3+ mounts defined", MOUNT_CATALOG.length >= 3);
  ok("mountSpeedBonus(warhorse)=25", mountSpeedBonus("warhorse") === 25 && mountSpeedBonus(undefined) === 0);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `mt${sfx}@t.vn`, accountName: `MT${sfx}`, password: "test1234" });
  await once(s, "player");

  // Buy without gold → rejected.
  s.emit("buyMount", { mountId: "warhorse" });
  await sleep(350);
  ok("buy blocked without gold", sys.some((m) => m.includes("để mua Chiến Mã")));

  // Grant gold, buy → owned + auto-active, gold deducted.
  s.emit("devGrant", { gold: 60000 });
  await waitPlayer(s, (p) => p.stats.gold >= 60000);
  s.emit("buyMount", { mountId: "warhorse" });
  const pb = await waitPlayer(s, (p) => (p.ownedMounts ?? []).includes("warhorse"));
  ok("mount owned after buy", (pb.ownedMounts ?? []).includes("warhorse"));
  ok("mount auto-equipped", pb.activeMount === "warhorse");
  ok("gold deducted by price", pb.stats.gold === 60000 - getMount("warhorse").goldPrice, `gold=${pb.stats.gold}`);

  // Unequip (dismount).
  s.emit("equipMount", { mountId: null });
  const pu = await waitPlayer(s, (p) => p.activeMount === undefined);
  ok("dismount clears active", pu.activeMount === undefined);

  // Re-equip owned.
  s.emit("equipMount", { mountId: "warhorse" });
  const pr = await waitPlayer(s, (p) => p.activeMount === "warhorse");
  ok("re-equip owned mount", pr.activeMount === "warhorse");

  // Persist across relogin.
  s.disconnect();
  await sleep(300);
  const s2 = await connect();
  s2.emit("login", { email: `mt${sfx}@t.vn`, accountName: `MT${sfx}`, password: "test1234" });
  const relog = await once(s2, "player");
  ok("mount persists across relogin", (relog.ownedMounts ?? []).includes("warhorse"));
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
