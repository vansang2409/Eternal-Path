// Sprint 269: monster wave II (frostWraith/sandColossus/bloodFiend). DEV_CHEATS=1.
import { io } from "socket.io-client";
import { MONSTER_DEFINITIONS, getMonsterDefinition, monsterMaxHp } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 6000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });

ok("3 new species in catalog", ["frostWraith", "sandColossus", "bloodFiend"].every((t) => Boolean(MONSTER_DEFINITIONS[t])));
ok("levels 5/9/13", getMonsterDefinition("frostWraith").level === 5 && getMonsterDefinition("sandColossus").level === 9 && getMonsterDefinition("bloodFiend").level === 13);
ok("colossus is tanky", monsterMaxHp(getMonsterDefinition("sandColossus")) > monsterMaxHp(getMonsterDefinition("frostWraith")));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `mw269${sfx}@t.vn`, accountName: `MW269${sfx}`, password: "test1234" });
  await once(s, "player");
  // Sprint 301 (AOI): sweep several map regions and union the species seen.
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
  const types = new Set();
  s.on("snapshot", (snap) => { for (const m of snap.monsters ?? []) types.add(m.type); });
  for (const [x, y] of [[500, 500], [3200, 1200], [5800, 2400], [1600, 3600], [4800, 4300], [3200, 2400]]) {
    s.emit("devTeleport", { x, y });
    await sleepMs(350);
  }
  ok("wave-II monsters spawned in world", ["frostWraith", "sandColossus", "bloodFiend"].every((t) => types.has(t)), [...types].filter((t) => ["frostWraith", "sandColossus", "bloodFiend"].includes(t)).join(","));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
