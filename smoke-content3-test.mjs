// Sprint 145: verify Season 3 content (cosmetics + pets) is live & usable.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-content3-test.mjs
import { io } from "socket.io-client";
import { COSMETICS, getCosmetic } from "./shared/dist/cosmetics.js";
import { PET_CATALOG, getPet } from "./shared/dist/pets.js";
import { MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL } from "./shared/dist/mysterybox.js";

const PORT = process.env.PORT || "3252";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

// ── Unit: catalog presence ──
const newCos = ["skin-celestial", "skin-inferno", "skill-fx-gold"];
ok("3 new S3 cosmetics present", newCos.every((id) => getCosmetic(id)));
const newPets = ["griffin", "bear"];
ok("2 new S3 pets present", newPets.every((id) => getPet(id)));
ok("new gem cosmetics in mystery pool", MYSTERY_COSMETIC_POOL.includes("skin-celestial") && MYSTERY_COSMETIC_POOL.includes("skill-fx-gold"));
ok("new gem pets in mystery pool", MYSTERY_PET_POOL.includes("griffin") && MYSTERY_PET_POOL.includes("bear"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `c3${sfx}@t.vn`, accountName: `C3${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 50000, gems: 800 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 800);

  // Buy + equip the new gem pet (griffin) and verify its buff applies.
  const p0 = await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); });
  const baseAtk = p0.stats.attack;
  s.emit("buyPet", { petId: "griffin" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("griffin"));
  s.emit("equipPet", { petId: "griffin" });
  const pk = await waitPlayer(s, (p) => p.activePet === "griffin");
  ok("new pet griffin buff +9 atk", pk.stats.attack === baseAtk + 9, `atk=${pk.stats.attack} expect ${baseAtk + 9}`);

  // Buy + equip a new cosmetic (skin-celestial).
  s.emit("buyCosmetic", { cosmeticId: "skin-celestial" });
  await waitPlayer(s, (p) => (p.cosmetics ?? []).includes("skin-celestial"));
  s.emit("equipCosmetic", { cosmeticId: "skin-celestial" });
  const pc = await waitPlayer(s, (p) => p.activeCosmeticSkin === "skin-celestial");
  ok("new cosmetic equippable", pc.activeCosmeticSkin === "skin-celestial");

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
