// Sprint 240: Season 10 cosmos content — 3 cosmetics + 2 pets. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { COSMETICS, PET_CATALOG, getCosmetic, getPet, MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("cosmetics >= 32", COSMETICS.length >= 32, `n=${COSMETICS.length}`);
ok("pets >= 26", PET_CATALOG.length >= 26, `n=${PET_CATALOG.length}`);
ok("3 season-10 cosmetics present", ["skin-nebula-walker", "skin-starforged", "skill-fx-comet"].every((id) => Boolean(getCosmetic(id))));
ok("2 season-10 pets present", ["star-phoenix", "void-cat"].every((id) => Boolean(getPet(id))));
ok("new content flows into gacha pools", MYSTERY_COSMETIC_POOL.includes("skin-nebula-walker") && MYSTERY_PET_POOL.includes("void-cat"));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `c10${sfx}@t.vn`, accountName: `C10${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 1000 });
  await until((p) => (p.gems ?? 0) >= 1000);
  const baseAtk = lastPlayer.stats.attack;

  s.emit("buyPet", { petId: "star-phoenix" });
  await until((p) => (p.ownedPets ?? []).includes("star-phoenix"));
  s.emit("equipPet", { petId: "star-phoenix" });
  const pk = await until((p) => p.activePet === "star-phoenix");
  ok("star-phoenix buff +19 atk", pk.stats.attack === baseAtk + 19, `atk ${baseAtk}->${pk.stats.attack}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
