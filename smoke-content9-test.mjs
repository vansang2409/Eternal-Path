// Sprint 230: Season 9 ocean content — 3 cosmetics + 2 pets. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { COSMETICS, PET_CATALOG, getCosmetic, getPet } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("cosmetics >= 29", COSMETICS.length >= 29, `n=${COSMETICS.length}`);
ok("pets >= 24", PET_CATALOG.length >= 24, `n=${PET_CATALOG.length}`);
ok("3 season-9 cosmetics present", ["skin-deep-ocean", "skin-coral-empress", "skill-fx-tidal"].every((id) => Boolean(getCosmetic(id))));
ok("2 season-9 pets present", ["leviathan", "moon-turtle"].every((id) => Boolean(getPet(id))));
ok("leviathan gem-priced epic", getPet("leviathan").gemPrice === 420 && getPet("leviathan").rarity === "epic");

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `c9${sfx}@t.vn`, accountName: `C9${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 1000 });
  await until((p) => (p.gems ?? 0) >= 1000);
  const base = lastPlayer.stats.defense;

  // Buy + equip the new tank turtle: +14 defense at level 1.
  s.emit("buyPet", { petId: "moon-turtle" });
  await until((p) => (p.ownedPets ?? []).includes("moon-turtle"));
  s.emit("equipPet", { petId: "moon-turtle" });
  const pk = await until((p) => p.activePet === "moon-turtle");
  ok("moon-turtle buff +14 def", pk.stats.defense === base + 14, `def ${base}->${pk.stats.defense}`);

  // Buy the new ocean skin and equip it.
  s.emit("buyCosmetic", { cosmeticId: "skin-deep-ocean" });
  await until((p) => (p.cosmetics ?? []).includes("skin-deep-ocean"));
  s.emit("equipCosmetic", { cosmeticId: "skin-deep-ocean" });
  const pc = await until((p) => p.activeCosmeticSkin === "skin-deep-ocean");
  ok("ocean skin equipped", Boolean(pc));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
