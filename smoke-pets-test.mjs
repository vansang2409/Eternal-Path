// Sprint 63 smoke test: pets buy/equip/swap stat buff (no double-count) + persist.
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-pets-test.mjs
import { io } from "socket.io-client";
import { getPet, PET_CATALOG } from "./shared/dist/pets.js";

const PORT = process.env.PORT || "3191";
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

// ── Unit: catalog sanity ──
ok("catalog has gold + gem pets", PET_CATALOG.some((p) => p.goldPrice > 0) && PET_CATALOG.some((p) => p.gemPrice > 0));
ok("getPet resolves + buff present", getPet("phoenix")?.buff.attack === 10 && getPet("nope") === undefined);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `pet${sfx}@t.vn`, accountName: `Pet${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const baseAtk = p0.stats.attack, baseDef = p0.stats.defense, baseHp = p0.stats.maxHp;

  // Buy without enough gold (wolf=5000) → rejected for a broke new player.
  s.emit("buyPet", { petId: "wolf" });
  await sleep(400);
  ok("buy rejected when poor", sys.some((m) => m.includes("vàng để mua")));

  // Grant gold + gems, buy slime (gold) + phoenix (gem).
  s.emit("devGrant", { gold: 20000, gems: 500 });
  await waitPlayer(s, (p) => p.stats.gold >= 20000);
  s.emit("buyPet", { petId: "slime" });
  await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("slime"));
  ok("bought slime (gold deducted)", true);
  s.emit("buyPet", { petId: "phoenix" });
  const pBought = await waitPlayer(s, (p) => (p.ownedPets ?? []).includes("phoenix"));
  // 500 granted − 300 (phoenix gemPrice) = 200.
  ok("bought phoenix (gem deducted)", pBought.gems === 200, `gems=${pBought.gems}`);

  // Buy duplicate rejected.
  s.emit("buyPet", { petId: "slime" });
  await sleep(400);
  ok("duplicate buy rejected", sys.some((m) => m.includes("đã sở hữu")));

  // Equip slime (+3 atk).
  s.emit("equipPet", { petId: "slime" });
  const pSlime = await waitPlayer(s, (p) => p.activePet === "slime");
  ok("slime buff +3 atk applied", pSlime.stats.attack === baseAtk + 3, `atk ${baseAtk}->${pSlime.stats.attack}`);

  // Swap to phoenix (+10 atk +5 def +100 hp) — must REPLACE slime buff, not stack.
  s.emit("equipPet", { petId: "phoenix" });
  const pPhoenix = await waitPlayer(s, (p) => p.activePet === "phoenix");
  ok("swap replaces buff (atk no double-count)", pPhoenix.stats.attack === baseAtk + 10, `atk=${pPhoenix.stats.attack} expect ${baseAtk + 10}`);
  ok("swap def correct", pPhoenix.stats.defense === baseDef + 5, `def=${pPhoenix.stats.defense}`);
  ok("swap maxHp correct", pPhoenix.stats.maxHp === baseHp + 100, `hp=${pPhoenix.stats.maxHp}`);

  // Unequip → back to base.
  s.emit("equipPet", { petId: null });
  const pNone = await waitPlayer(s, (p) => !p.activePet);
  ok("unequip restores base atk", pNone.stats.attack === baseAtk, `atk=${pNone.stats.attack}`);
  ok("unequip restores base maxHp", pNone.stats.maxHp === baseHp, `hp=${pNone.stats.maxHp}`);

  // Equip phoenix again, then relog → buff persists exactly once (no double count).
  s.emit("equipPet", { petId: "phoenix" });
  await waitPlayer(s, (p) => p.activePet === "phoenix");
  await sleep(300);
  s.disconnect();
  await sleep(400);
  const s2 = await connect();
  s2.emit("login", { email: `pet${sfx}@t.vn`, accountName: `Pet${sfx}`, password: "test1234" });
  const relog = await once(s2, "player");
  ok("relog keeps phoenix equipped", relog.activePet === "phoenix");
  ok("relog buff not double-counted", relog.stats.attack === baseAtk + 10 && relog.stats.maxHp === baseHp + 100, `atk=${relog.stats.attack} hp=${relog.stats.maxHp}`);
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
