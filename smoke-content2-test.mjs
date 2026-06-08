// Sprint 69: verify Season 2 content (cosmetics + pets) is live & usable.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-content2-test.mjs
import { io } from "socket.io-client";
import { COSMETICS, getCosmetic } from "./shared/dist/cosmetics.js";
import { PET_CATALOG, getPet } from "./shared/dist/pets.js";
import { MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL } from "./shared/dist/mysterybox.js";

const PORT = process.env.PORT || "3203";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

// ── Unit: catalog presence ──
const newCos = ["skin-rose", "skin-jade-storm", "skin-obsidian-gold", "skill-fx-ember", "skill-fx-void"];
ok("5 new cosmetics present", newCos.every((id) => getCosmetic(id)));
const newPets = ["kirin", "turtle", "cat"];
ok("3 new pets present", newPets.every((id) => getPet(id)));
ok("new gem cosmetics in mystery pool", MYSTERY_COSMETIC_POOL.includes("skin-rose") && MYSTERY_COSMETIC_POOL.includes("skill-fx-void"));
ok("new gem pets in mystery pool", MYSTERY_PET_POOL.includes("kirin") && MYSTERY_PET_POOL.includes("turtle"));
ok("cosmetic count grew to 12", COSMETICS.length === 12, `len=${COSMETICS.length}`);
ok("pet count grew to 9", PET_CATALOG.length === 9, `len=${PET_CATALOG.length}`);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `c2${sfx}@t.vn`, accountName: `C2${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 50000, gems: 500 });
  await waitPlayer(s, (p) => p.stats.gold >= 50000);

  // Buy + equip a new gem pet (kirin) and verify its buff applies.
  const p0 = await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); });
  const baseAtk = p0.stats.attack;
  s.emit("buyPet", { petId: "kirin" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("kirin"));
  s.emit("equipPet", { petId: "kirin" });
  const pk = await waitPlayer(s, (p) => p.activePet === "kirin");
  ok("new pet kirin buff +8 atk", pk.stats.attack === baseAtk + 8, `atk=${pk.stats.attack} expect ${baseAtk + 8}`);

  // Buy a new cosmetic (skin-rose) and equip it.
  s.emit("buyCosmetic", { cosmeticId: "skin-rose" });
  await waitPlayer(s, (p) => (p.cosmetics ?? []).includes("skin-rose"));
  s.emit("equipCosmetic", { cosmeticId: "skin-rose" });
  const pc = await waitPlayer(s, (p) => p.activeCosmeticSkin === "skin-rose");
  ok("new cosmetic equippable", pc.activeCosmeticSkin === "skin-rose");

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
