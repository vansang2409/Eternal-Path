// Sprint 184: sacrifice a pet for XP. DEV_CHEATS=1.
// Run: node smoke-sacpet184-test.mjs
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `sac${sfx}@t.vn`, accountName: `SAC${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 500 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 500);

  // Buy 2 pets, equip one.
  s.emit("buyPet", { petId: "spirit" });
  s.emit("buyPet", { petId: "drake" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("spirit") && (p.ownedPets ?? []).includes("drake"));
  s.emit("equipPet", { petId: "spirit" });
  await waitPlayer(s, (p) => p.activePet === "spirit");

  // Cannot sacrifice the active pet.
  s.emit("sacrificePet", { petId: "spirit" });
  await sleep(300);
  ok("cannot sacrifice active pet", sys.some((m) => m.includes("đang dùng")));

  // Cannot sacrifice an unowned pet.
  sys.length = 0;
  s.emit("sacrificePet", { petId: "phoenix" });
  await sleep(300);
  ok("cannot sacrifice unowned pet", sys.some((m) => m.includes("không sở hữu")));

  // Sacrifice drake → removed from owned, spirit gains XP.
  const before = await new Promise((r) => { s.emit("devGrant", { gold: 0 }); s.once("player", r); });
  const spiritXpBefore = (before.petXp ?? {})["spirit"] ?? 0;
  s.emit("sacrificePet", { petId: "drake" });
  const after = await waitPlayer(s, (p) => !(p.ownedPets ?? []).includes("drake"), 4000);
  ok("drake removed from owned", !(after.ownedPets ?? []).includes("drake"));
  ok("active spirit gained XP", ((after.petXp ?? {})["spirit"] ?? 0) >= spiritXpBefore + 300, `xp ${spiritXpBefore}->${(after.petXp ?? {})["spirit"]}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
