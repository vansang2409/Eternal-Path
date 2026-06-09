// Sprint 161: verify Season 4 content (cosmetics + pets) live & usable.
// DEV_CHEATS=1. Run: node smoke-content4-test.mjs
import { io } from "socket.io-client";
import { getCosmetic } from "./shared/dist/cosmetics.js";
import { getPet } from "./shared/dist/pets.js";
import { MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL } from "./shared/dist/mysterybox.js";
const PORT = process.env.PORT || "3252";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const newCos = ["skin-aurora", "skill-fx-storm"];
ok("2 new S4 cosmetics present", newCos.every((id) => getCosmetic(id)));
const newPets = ["tiger", "serpent"];
ok("2 new S4 pets present", newPets.every((id) => getPet(id)));
ok("new gem cosmetics in mystery pool", MYSTERY_COSMETIC_POOL.includes("skin-aurora") && MYSTERY_COSMETIC_POOL.includes("skill-fx-storm"));
ok("new gem pets in mystery pool", MYSTERY_PET_POOL.includes("tiger") && MYSTERY_PET_POOL.includes("serpent"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `c4${sfx}@t.vn`, accountName: `C4${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 50000, gems: 800 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 800);

  const p0 = await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); });
  const baseAtk = p0.stats.attack;
  s.emit("buyPet", { petId: "tiger" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("tiger"));
  s.emit("equipPet", { petId: "tiger" });
  const pk = await waitPlayer(s, (p) => p.activePet === "tiger");
  ok("new pet tiger buff +11 atk", pk.stats.attack === baseAtk + 11, `atk=${pk.stats.attack} expect ${baseAtk + 11}`);

  s.emit("buyCosmetic", { cosmeticId: "skin-aurora" });
  await waitPlayer(s, (p) => (p.cosmetics ?? []).includes("skin-aurora"));
  s.emit("equipCosmetic", { cosmeticId: "skin-aurora" });
  const pc = await waitPlayer(s, (p) => p.activeCosmeticSkin === "skin-aurora");
  ok("new cosmetic equippable", pc.activeCosmeticSkin === "skin-aurora");

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
