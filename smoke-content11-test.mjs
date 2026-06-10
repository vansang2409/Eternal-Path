// Sprint 250: Season 11 sacred-forest content — 3 cosmetics + 2 pets. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { COSMETICS, PET_CATALOG, getCosmetic, getPet } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("cosmetics >= 35", COSMETICS.length >= 35, `n=${COSMETICS.length}`);
ok("pets >= 28", PET_CATALOG.length >= 28, `n=${PET_CATALOG.length}`);
ok("3 season-11 cosmetics", ["skin-sylvan-guardian", "skin-fae-queen", "skill-fx-bloom"].every((id) => Boolean(getCosmetic(id))));
ok("2 season-11 pets", ["elder-treant", "spirit-stag"].every((id) => Boolean(getPet(id))));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `c11${sfx}@t.vn`, accountName: `C11${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 900 });
  await until((p) => (p.gems ?? 0) >= 900);
  const baseDef = lastPlayer.stats.defense;

  s.emit("buyPet", { petId: "elder-treant" });
  await until((p) => (p.ownedPets ?? []).includes("elder-treant"));
  s.emit("equipPet", { petId: "elder-treant" });
  const pk = await until((p) => p.activePet === "elder-treant");
  ok("treant buff +16 def", pk.stats.defense === baseDef + 16, `def ${baseDef}->${pk.stats.defense}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
