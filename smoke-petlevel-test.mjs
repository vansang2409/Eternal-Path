// Sprint 65: unit-test pet leveling math + e2e feed/treat → level → scaled buff.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-petlevel-test.mjs
import { io } from "socket.io-client";
import { petLevelForXp, petXpProgress, petBuffAtLevel, petLevelMultiplier, getPet, PET_MAX_LEVEL } from "./shared/dist/pets.js";

const PORT = process.env.PORT || "3195";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 140) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
  setTimeout(() => rej(new Error("connect timeout")), 5000);
});
const once = (s, ev, t = 5000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout player pred")), t);
  const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } };
  s.on("player", fn);
});

// ── Unit: pure leveling math ──
ok("level 1 at 0 xp", petLevelForXp(0) === 1);
ok("level 2 at 100 xp", petLevelForXp(100) === 2 && petLevelForXp(99) === 1);
ok("level 5 at 1000 xp (max)", petLevelForXp(1000) === 5 && petLevelForXp(99999) === PET_MAX_LEVEL);
ok("multiplier +25%/level", petLevelMultiplier(1) === 1 && petLevelMultiplier(5) === 2);
ok("buff scales (phoenix atk 10→20 at L5)", petBuffAtLevel(getPet("phoenix").buff, 5).attack === 20);
ok("xp progress into/span", (() => { const p = petXpProgress(150); return p.level === 2 && p.into === 50 && p.span === 200; })());
ok("xp progress atMax", petXpProgress(1000).atMax === true);

// ── e2e: feed/treat levels the active pet and scales the live buff ──
const run = async () => {
  const sfx = Date.now() % 100000;
  const email = `plv${sfx}@t.vn`, name = `Plv${sfx}`;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email, accountName: name, password: "test1234" });
  const p0 = await once(s, "player");
  const baseAtk = p0.stats.attack;

  // Feeding with no pet equipped is rejected.
  s.emit("devGrant", { gold: 100000, gems: 500 });
  await waitPlayer(s, (p) => p.stats.gold >= 100000);
  s.emit("feedPet");
  await sleep(400);
  ok("feed rejected without active pet", sys.some((m) => m.includes("trang bị một linh thú")));

  // Buy + equip slime (base +3 atk at L1).
  s.emit("buyPet", { petId: "slime" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("slime"));
  s.emit("equipPet", { petId: "slime" });
  const pEq = await waitPlayer(s, (p) => p.activePet === "slime");
  ok("slime L1 buff +3 atk", pEq.stats.attack === baseAtk + 3, `atk=${pEq.stats.attack}`);

  // Treat (250 xp) → reaches level 3 (>=300? no: 250<300 → level 2). slime buff atk 3 * 1.25 = 3.75 → round 4.
  s.emit("petTreat");
  const pT1 = await waitPlayer(s, (p) => (p.petXp?.slime ?? 0) >= 250);
  ok("treat grants xp → level 2", petLevelForXp(pT1.petXp.slime) === 2, `xp=${pT1.petXp.slime} lvl=${petLevelForXp(pT1.petXp.slime)}`);
  ok("L2 buff scaled (3→4 atk)", pT1.stats.attack === baseAtk + 4, `atk=${pT1.stats.attack} expect ${baseAtk + 4}`);

  // Treat again (total 500 xp) → level 3 (>=300). slime atk 3*1.5=4.5→round 5.
  s.emit("petTreat");
  const pT2 = await waitPlayer(s, (p) => (p.petXp?.slime ?? 0) >= 500);
  ok("level 3 at 500 xp", petLevelForXp(pT2.petXp.slime) === 3);
  ok("L3 buff scaled (3→5 atk)", pT2.stats.attack === baseAtk + 5, `atk=${pT2.stats.attack} expect ${baseAtk + 5}`);

  // Relogin: level + scaled buff persist exactly once (no double-count).
  await sleep(300);
  s.disconnect();
  await sleep(400);
  const s2 = await connect();
  s2.emit("login", { email, accountName: name, password: "test1234" });
  const relog = await once(s2, "player");
  ok("relog keeps pet xp", (relog.petXp?.slime ?? 0) >= 500);
  ok("relog buff not double-counted (still +5)", relog.stats.attack === baseAtk + 5, `atk=${relog.stats.attack} expect ${baseAtk + 5}`);

  // Unequip after relog → buff cleanly removed.
  s2.emit("equipPet", { petId: null });
  const pNone = await waitPlayer(s2, (p) => !p.activePet);
  ok("unequip after relog returns to base", pNone.stats.attack === baseAtk, `atk=${pNone.stats.attack} expect ${baseAtk}`);

  s2.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
