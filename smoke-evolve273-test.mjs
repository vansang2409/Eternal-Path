// Sprint 273: pet evolution — L5 gate, gem cost, +50% buff. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { petEffectiveBuff, PET_EVOLVE_GEM_COST, PET_EVOLVE_MULT, getPet, ACHIEVEMENTS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const fox = getPet("spirit-fox") ?? getPet("leviathan");
ok("evolve math x1.5 after level scale", PET_EVOLVE_MULT === 1.5 && petEffectiveBuff({ attack: 10 }, 1, true).attack === 15);
ok("evolver achievement in catalog", ACHIEVEMENTS.some((a) => a.id === "evolver"));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `ev273${sfx}@t.vn`, accountName: `EV273${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrant", { gems: 1000 });
  await until((p) => (p.gems ?? 0) >= 1000);
  const baseAtk = lastPlayer.stats.attack;

  // Buy + equip leviathan (+17 atk at L1).
  s.emit("buyPet", { petId: "leviathan" });
  await until((p) => (p.ownedPets ?? []).includes("leviathan"));
  s.emit("equipPet", { petId: "leviathan" });
  await until((p) => p.activePet === "leviathan");

  // Evolve below max level → rejected.
  s.emit("evolvePet", { petId: "leviathan" });
  await sleepMs(400);
  ok("evolution gated below L5", sysMsgs.some((m) => m.includes("Cần đạt cấp 5")));

  // Push to L5 (xp 5000 safely beyond all thresholds) then evolve.
  s.emit("devPetXp", { petId: "leviathan", xp: 5000 });
  await sleepMs(400);
  const gemsBefore = lastPlayer.gems;
  s.emit("evolvePet", { petId: "leviathan" });
  const pe = await until((p) => Boolean(p.petEvolved?.leviathan));
  // Net gems: -100 evolve cost +20 evolver achievement reward.
  ok("evolution paid 100 gems (net -80 with achievement)", pe.gems === gemsBefore - PET_EVOLVE_GEM_COST + 20, `gems ${gemsBefore}->${pe.gems}`);
  ok("evolver achievement unlocked", pe.achievements.includes("evolver"));
  // L5 buff = round(17*2) = 34 → evolved = round(34*1.5) = 51.
  ok("buff x1.5 applied at L5", pe.stats.attack === baseAtk + 51, `atk ${baseAtk}->${pe.stats.attack}`);

  // Double evolve rejected.
  s.emit("evolvePet", { petId: "leviathan" });
  await sleepMs(400);
  ok("double evolve rejected", sysMsgs.some((m) => m.includes("đã tiến hoá rồi")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
