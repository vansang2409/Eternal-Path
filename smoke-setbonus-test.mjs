// Sprint 64: verify set-bonus is not double-counted across relogin.
// 2 items sharing a themeId grant a 2-piece set bonus (+30 maxHp per the
// recomputeSetBonus table). The bonus must survive relogin WITHOUT doubling.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-setbonus-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3193";
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

const run = async () => {
  const sfx = Date.now() % 100000;
  const email = `setb${sfx}@t.vn`, name = `SetB${sfx}`;
  const s = await connect();
  s.emit("login", { email, accountName: name, password: "test1234" });
  const p0 = await once(s, "player");
  const baseHp = p0.stats.maxHp;

  // Grant two items of the same theme in different slots (weapon + armor).
  s.emit("devGrantItem", { name: "Theme Blade", slot: "weapon", themeId: "testset", stats: {}, value: 100 });
  await waitPlayer(s, (p) => p.inventory.items.some((i) => i.name === "Theme Blade"));
  s.emit("devGrantItem", { name: "Theme Mail", slot: "armor", themeId: "testset", stats: {}, value: 100 });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.name === "Theme Mail"));
  const blade = pg.inventory.items.find((i) => i.name === "Theme Blade");
  const mail = pg.inventory.items.find((i) => i.name === "Theme Mail");

  // Equip both → 2-piece set bonus = +30 maxHp.
  s.emit("equipItem", { itemId: blade.id });
  await waitPlayer(s, (p) => !!p.inventory.equipped.weapon);
  s.emit("equipItem", { itemId: mail.id });
  const pSet = await waitPlayer(s, (p) => !!p.inventory.equipped.armor);
  ok("2-piece set grants +30 maxHp", pSet.stats.maxHp === baseHp + 30, `hp ${baseHp}->${pSet.stats.maxHp}`);

  // Relogin: stats must be identical (bonus baked once, not lost/doubled).
  await sleep(300);
  s.disconnect();
  await sleep(400);
  const s2 = await connect();
  s2.emit("login", { email, accountName: name, password: "test1234" });
  const relog = await once(s2, "player");
  ok("relogin keeps maxHp stable (+30)", relog.stats.maxHp === baseHp + 30, `hp=${relog.stats.maxHp} expect ${baseHp + 30}`);

  // The decisive check: unequip a set piece AFTER relogin. With the bug, the
  // baked-in bonus was never tracked (setBonus*=0 post-login) so the recompute
  // double-counts. Correct behavior: maxHp returns to base (bonus removed).
  s2.emit("unequipItem", { slot: "armor" });
  const pUneq = await waitPlayer(s2, (p) => !p.inventory.equipped.armor, 4000).catch(() => null);
  ok("unequip after relogin returns to base (no double-count)", !!pUneq && pUneq.stats.maxHp === baseHp, `hp=${pUneq?.stats.maxHp} expect ${baseHp}`);

  s2.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
