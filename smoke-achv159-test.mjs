// Sprint 159: achievements for the gear-deepening loop. DEV_CHEATS=1.
// Run: node smoke-achv159-test.mjs
import { io } from "socket.io-client";
import { ACHIEVEMENTS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const hasAch = (p, id) => (p.achievements ?? []).includes(id);

const run = async () => {
  ok("ACHIEVEMENTS count >= 37", ACHIEVEMENTS.length >= 37, `len=${ACHIEVEMENTS.length}`);
  ok("enhancer/recycler/apex-smith defined", ["enhancer","recycler","apex-smith"].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `a9${sfx}@t.vn`, accountName: `A9${sfx}`, password: "test1234" });
  await once(s, "player");

  // enhancer: upgrade a granted item (+0 guaranteed).
  s.emit("devGrant", { gold: 10000 });
  s.emit("devGrantItem", { name: "Up Item", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")) && p.stats.gold >= 10000);
  const upId = pg.inventory.items.find((i) => i.id.startsWith("dev-")).id;
  s.emit("upgradeItem", { itemId: upId });
  const pe = await waitPlayer(s, (p) => hasAch(p, "enhancer"), 5000);
  ok("enhancer unlocked by upgrade", hasAch(pe, "enhancer"));

  // recycler: mass-salvage junk.
  s.emit("devGrantItem", { name: "Junk A", rarity: "common", slot: "boots" });
  s.emit("devGrantItem", { name: "Junk B", rarity: "common", slot: "helmet" });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "equipment" && i.rarity === "common").length >= 2);
  s.emit("salvageAll", { rarity: "junk" });
  const pr = await waitPlayer(s, (p) => hasAch(p, "recycler"), 5000);
  ok("recycler unlocked by mass salvage", hasAch(pr, "recycler"));

  // apex-smith: craft an apex recipe.
  s.emit("devGrantMaterial", { materialId: "voidAsh", count: 5 });
  s.emit("devGrantMaterial", { materialId: "crystalShard", count: 3 });
  s.emit("devGrantMaterial", { materialId: "wardenHeart", count: 2 });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === "voidAsh").length >= 5);
  s.emit("craftRecipe", { recipeId: "abyssal-greatsword" });
  const pa = await waitPlayer(s, (p) => hasAch(p, "apex-smith"), 5000);
  ok("apex-smith unlocked by apex craft", hasAch(pa, "apex-smith"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
