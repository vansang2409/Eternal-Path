// Sprint 276: gold-priced pets (iron-beetle / shadow-cat). DEV_CHEATS=1.
import { io } from "socket.io-client";
import { getPet, MYSTERY_PET_POOL } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("2 gold pets in catalog", getPet("iron-beetle")?.goldPrice === 80_000 && getPet("shadow-cat")?.goldPrice === 150_000);
ok("gold pets stay out of the gem gacha", !MYSTERY_PET_POOL.includes("iron-beetle") && !MYSTERY_PET_POOL.includes("shadow-cat"));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `gp276${sfx}@t.vn`, accountName: `GP276${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrant", { gold: 90_000 });
  await until((p) => p.stats.gold >= 90_000);
  const gold0 = lastPlayer.stats.gold;
  const def0 = lastPlayer.stats.defense;

  s.emit("buyPet", { petId: "iron-beetle" });
  const p1 = await until((p) => (p.ownedPets ?? []).includes("iron-beetle"));
  ok("bought with gold (-80k)", p1.stats.gold === gold0 - 80_000);
  s.emit("equipPet", { petId: "iron-beetle" });
  const p2 = await until((p) => p.activePet === "iron-beetle");
  ok("beetle buff +11 def", p2.stats.defense === def0 + 11, `def ${def0}->${p2.stats.defense}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
