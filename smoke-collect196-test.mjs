// Sprint 196: collection achievements (6 pets / 6 cosmetics). DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS, PET_CATALOG, COSMETICS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 6000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const has = (p, id) => (p.achievements ?? []).includes(id);

const run = async () => {
  ok("ACHIEVEMENTS count is 44", ACHIEVEMENTS.length === 44, `len=${ACHIEVEMENTS.length}`);
  ok("collector achievements defined", ["pet-collector","cosmetic-collector"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `cl${sfx}@t.vn`, accountName: `CL${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 5000 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 5000);

  // Buy 6 gem pets.
  const gemPets = PET_CATALOG.filter((p) => p.gemPrice > 0).slice(0, 6).map((p) => p.id);
  for (const id of gemPets) s.emit("buyPet", { petId: id });
  const pp = await waitPlayer(s, (p) => has(p, "pet-collector"), 6000);
  ok("pet-collector unlocked at 6 pets", has(pp, "pet-collector"));

  // Buy 6 gem cosmetics.
  const gemCos = COSMETICS.filter((c) => c.gemPrice > 0).slice(0, 6).map((c) => c.id);
  for (const id of gemCos) s.emit("buyCosmetic", { cosmeticId: id });
  const pc = await waitPlayer(s, (p) => has(p, "cosmetic-collector"), 6000);
  ok("cosmetic-collector unlocked at 6 cosmetics", has(pc, "cosmetic-collector"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
