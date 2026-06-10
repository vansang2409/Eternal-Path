// Sprint 266: Element Storm world event — broadcast + doubled drops. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ELEMENT_STORM_DROP_MULT, ELEMENT_STORM_DURATION_MS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("storm constants", ELEMENT_STORM_DROP_MULT === 2 && ELEMENT_STORM_DURATION_MS === 600_000);

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect(); const b = await connect();
  const bEvents = []; b.on("worldEvent", (e) => bEvents.push(e));
  const bSys = []; b.on("system", (m) => bSys.push(String(m)));
  a.emit("login", { email: `es266a${sfx}@t.vn`, accountName: `ES266A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `es266b${sfx}@t.vn`, accountName: `ES266B${sfx}`, password: "test1234" });
  await once(b, "player");
  await sleepMs(300);

  a.emit("devElementStorm");
  await sleepMs(500);
  const storm = bEvents.find((e) => e.kind === "elementStorm");
  ok("storm broadcast to everyone", Boolean(storm) && storm.multiplier === 2 && storm.until > Date.now());
  ok("storm banner message", bSys.some((m) => m.includes("BÃO NGUYÊN TỐ")));

  // With the storm up, a boss-flagged devSimKill drops materials at 100%
  // either way — so verify a SLIME kill drops within a reasonable trial count
  // at the doubled 60% rate (20 kills ≈ 1 - 0.4^20 ≈ 99.99989%).
  let drops = 0;
  let lastPlayer = null;
  a.on("player", (p) => { lastPlayer = p; });
  for (let i = 0; i < 20; i++) { a.emit("devSimKill", {}); await sleepMs(100); }
  await sleepMs(500);
  drops = (lastPlayer?.inventory.items ?? []).filter((it) => it.kind === "material").length;
  ok("materials dropped under the storm", drops >= 1, `drops=${drops}`);

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
