// Sprint 158: apex crafting recipes (salvage-material sinks). DEV_CHEATS=1.
// Run: node smoke-recipes158-test.mjs
import { io } from "socket.io-client";
import { getRecipe } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const grantMat = (s, materialId, count) => s.emit("devGrantMaterial", { materialId, count });

const run = async () => {
  ok("recipe abyssal-greatsword exists", !!getRecipe("abyssal-greatsword"));
  ok("recipe dragonscale-plate exists", !!getRecipe("dragonscale-plate"));
  ok("recipe eternal-signet exists", !!getRecipe("eternal-signet"));
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `rc${sfx}@t.vn`, accountName: `RC${sfx}`, password: "test1234" });
  await once(s, "player");

  // Craft without materials → rejected.
  s.emit("craftRecipe", { recipeId: "abyssal-greatsword" });
  await sleep(350);
  ok("craft blocked when missing materials", sys.some((m) => m.includes("Thiếu")));

  // Grant exact materials for abyssal-greatsword: voidAsh 5, crystalShard 3, wardenHeart 2.
  grantMat(s, "voidAsh", 5); grantMat(s, "crystalShard", 3); grantMat(s, "wardenHeart", 2);
  await waitPlayer(s, (p) => {
    const c = (id) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === id).length;
    return c("voidAsh") >= 5 && c("crystalShard") >= 3 && c("wardenHeart") >= 2;
  });
  s.emit("craftRecipe", { recipeId: "abyssal-greatsword" });
  const pc = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "equipment" && i.name === "Đại Kiếm Vực Thẳm"), 5000);
  const crafted = pc.inventory.items.find((i) => i.kind === "equipment" && i.name === "Đại Kiếm Vực Thẳm");
  ok("apex weapon crafted", !!crafted);
  ok("crafted item is epic weapon", crafted.rarity === "epic" && crafted.slot === "weapon");
  const voidLeft = pc.inventory.items.filter((i) => i.kind === "material" && i.materialId === "voidAsh").length;
  ok("voidAsh consumed (5 → 0)", voidLeft === 0, `voidAsh left=${voidLeft}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
