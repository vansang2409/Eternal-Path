// Sprint 177: verify Season 5 content (cosmetics + pets) live & usable.
// DEV_CHEATS=1. Run: node smoke-content5-test.mjs
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

ok("2 new S5 cosmetics present", ["skin-void-monarch", "skill-fx-blood"].every((id) => getCosmetic(id)));
ok("2 new S5 pets present", ["qilin", "raven"].every((id) => getPet(id)));
ok("new cosmetics in mystery pool", MYSTERY_COSMETIC_POOL.includes("skin-void-monarch") && MYSTERY_COSMETIC_POOL.includes("skill-fx-blood"));
ok("new pets in mystery pool", MYSTERY_PET_POOL.includes("qilin") && MYSTERY_PET_POOL.includes("raven"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `c5${sfx}@t.vn`, accountName: `C5${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 50000, gems: 800 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 800);

  const p0 = await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); });
  const baseAtk = p0.stats.attack;
  s.emit("buyPet", { petId: "qilin" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("qilin"));
  s.emit("equipPet", { petId: "qilin" });
  const pk = await waitPlayer(s, (p) => p.activePet === "qilin");
  ok("new pet qilin buff +12 atk", pk.stats.attack === baseAtk + 12, `atk=${pk.stats.attack} expect ${baseAtk + 12}`);

  s.emit("buyCosmetic", { cosmeticId: "skin-void-monarch" });
  await waitPlayer(s, (p) => (p.cosmetics ?? []).includes("skin-void-monarch"));
  s.emit("equipCosmetic", { cosmeticId: "skin-void-monarch" });
  const pc = await waitPlayer(s, (p) => p.activeCosmeticSkin === "skin-void-monarch");
  ok("new cosmetic equippable", pc.activeCosmeticSkin === "skin-void-monarch");

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
