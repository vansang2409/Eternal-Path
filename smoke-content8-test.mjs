// Sprint 205: Season 8 content. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { getCosmetic } from "./shared/dist/cosmetics.js";
import { getPet } from "./shared/dist/pets.js";
import { MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL } from "./shared/dist/mysterybox.js";
const PORT = process.env.PORT || "3252"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
ok("S8 cosmetics present", ["skin-abyss-lord","skill-fx-rainbow"].every((id) => getCosmetic(id)));
ok("S8 pets present", ["cerberus","valkyrie"].every((id) => getPet(id)));
ok("S8 in mystery pools", MYSTERY_COSMETIC_POOL.includes("skin-abyss-lord") && MYSTERY_PET_POOL.includes("valkyrie"));
const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `c8${sfx}@t.vn`, accountName: `C8${sfx}`, password: "test1234" });
  await once(s, "player"); s.emit("devGrant", { gems: 800 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 800);
  const p0 = await new Promise((r) => { s.emit("devGrant", { gold: 0 }); s.once("player", r); });
  const base = p0.stats.attack; s.emit("buyPet", { petId: "cerberus" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("cerberus"));
  s.emit("equipPet", { petId: "cerberus" });
  const pk = await waitPlayer(s, (p) => p.activePet === "cerberus");
  ok("cerberus buff +14 atk", pk.stats.attack === base + 14, `atk=${pk.stats.attack}`);
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
