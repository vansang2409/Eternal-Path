// Sprint 261: smithing XP levels + master-recipe gate. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { craftLevelForXp, craftXpProgress, CRAFT_XP_PER_CRAFT, RECIPES, getRecipe } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("level curve", craftLevelForXp(0) === 1 && craftLevelForXp(50) === 2 && craftLevelForXp(150) === 3 && craftLevelForXp(9999) === 5);
ok("progress math", craftXpProgress(60).level === 2 && craftXpProgress(60).into === 10 && craftXpProgress(60).needed === 100);
ok("2 master recipes gated", RECIPES.filter((r) => (r.minCraftLevel ?? 1) >= 3).length === 2 && getRecipe("master-dragonfang").minCraftLevel === 3);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `cx261${sfx}@t.vn`, accountName: `CX261${sfx}`, password: "test1234" });
  await once(s, "player");

  // Master recipe rejected at smithing L1 (give materials first so the gate
  // is what trips, not the material check — gate runs before materials).
  s.emit("craftRecipe", { recipeId: "master-dragonfang" });
  await sleepMs(400);
  ok("master recipe gated at L1", sysMsgs.some((m) => m.includes("Cần nghề rèn cấp 3")));

  // Craft a cheap recipe once → craftXp +10.
  const cheap = RECIPES.find((r) => (r.minCraftLevel ?? 1) <= 1);
  for (const [mid, qty] of Object.entries(cheap.cost)) {
    s.emit("devGrantMaterial", { materialId: mid, count: qty });
    await sleepMs(150);
  }
  s.emit("craftRecipe", { recipeId: cheap.id });
  const p1 = await until((p) => (p.craftXp ?? 0) === CRAFT_XP_PER_CRAFT);
  ok("craft grants 10 smithing XP", (p1.itemsCrafted ?? 0) >= 1, `craftXp=${p1.craftXp}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
