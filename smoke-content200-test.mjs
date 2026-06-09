// Sprint 200 capstone: marquee cosmetic + apex pet + eternal title. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { getCosmetic } from "./shared/dist/cosmetics.js";
import { getPet } from "./shared/dist/pets.js";
import { TITLES, earnedTitles } from "./shared/dist/titles.js";
import { MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL } from "./shared/dist/mysterybox.js";
const PORT = process.env.PORT || "3252";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

ok("marquee cosmetic present", getCosmetic("skin-eternal-radiance")?.gemPrice === 500);
ok("apex pet present", getPet("celestial-dragon")?.buff.attack === 18);
ok("eternal title present", TITLES.some((t) => t.id === "eternal"));
ok("eternal earned at level 100", earnedTitles({ stats: { gold: 0, level: 100 }, achievements: [], inventory: { equipped: {} } }).includes("eternal"));
ok("capstone content in mystery pools", MYSTERY_COSMETIC_POOL.includes("skin-eternal-radiance") && MYSTERY_PET_POOL.includes("celestial-dragon"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `c200${sfx}@t.vn`, accountName: `C200${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 1000 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 1000);
  const p0 = await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); });
  const baseAtk = p0.stats.attack;
  s.emit("buyPet", { petId: "celestial-dragon" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("celestial-dragon"));
  s.emit("equipPet", { petId: "celestial-dragon" });
  const pk = await waitPlayer(s, (p) => p.activePet === "celestial-dragon");
  ok("celestial-dragon buff +18 atk", pk.stats.attack === baseAtk + 18, `atk=${pk.stats.attack}`);
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
