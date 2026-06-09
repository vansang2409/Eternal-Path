// Sprint 179: achievements for mounts/alchemy/arena-streak. DEV_CHEATS=1.
// Run: node smoke-achv179-test.mjs
import { io } from "socket.io-client";
import { ACHIEVEMENTS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const has = (p, id) => (p.achievements ?? []).includes(id);

const run = async () => {
  ok("ACHIEVEMENTS count is 40", ACHIEVEMENTS.length === 40, `len=${ACHIEVEMENTS.length}`);
  ok("rider/alchemist/streak-master defined", ["rider","alchemist","streak-master"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `a179${sfx}@t.vn`, accountName: `A179${sfx}`, password: "test1234" });
  await once(s, "player");

  // rider: buy a mount.
  s.emit("devGrant", { gold: 60000 });
  await waitPlayer(s, (p) => p.stats.gold >= 60000);
  s.emit("buyMount", { mountId: "warhorse" });
  const pr = await waitPlayer(s, (p) => has(p, "rider"), 5000);
  ok("rider unlocked by mount purchase", has(pr, "rider"));

  // alchemist: brew a potion.
  s.emit("devGrantMaterial", { materialId: "slimeCore", count: 2 });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === "slimeCore").length >= 2);
  s.emit("brewPotion", { recipeId: "minor-potion" });
  const pa = await waitPlayer(s, (p) => has(p, "alchemist"), 5000);
  ok("alchemist unlocked by brewing", has(pa, "alchemist"));

  // streak-master: 5 arena kills in a row.
  for (let i = 0; i < 5; i++) s.emit("devArenaKill");
  const ps = await waitPlayer(s, (p) => has(p, "streak-master"), 5000);
  ok("streak-master unlocked at streak 5", has(ps, "streak-master"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
