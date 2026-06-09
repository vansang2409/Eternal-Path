// Sprint 171: alchemy brewing — HP potions from materials. DEV_CHEATS=1.
// Run: node smoke-brew171-test.mjs
import { io } from "socket.io-client";
import { getBrewRecipe, BREW_RECIPES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("2 brew recipes defined", BREW_RECIPES.length === 2);
  ok("minor-potion heals 120", getBrewRecipe("minor-potion")?.heal === 120);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `bw${sfx}@t.vn`, accountName: `BW${sfx}`, password: "test1234" });
  await once(s, "player");

  // Brew without materials → rejected.
  s.emit("brewPotion", { recipeId: "minor-potion" });
  await sleep(350);
  ok("brew blocked without materials", sys.some((m) => m.includes("Thiếu")));

  // Grant 2 slimeCore, brew minor-potion → potion with heal 120 appears.
  s.emit("devGrantMaterial", { materialId: "slimeCore", count: 2 });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === "slimeCore").length >= 2);
  s.emit("brewPotion", { recipeId: "minor-potion" });
  const pb = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "consumable" && i.name === "Tiểu Hồng Dược"), 5000);
  const potion = pb.inventory.items.find((i) => i.kind === "consumable" && i.name === "Tiểu Hồng Dược");
  ok("potion brewed", !!potion);
  ok("potion heal value 120", potion.heal === 120);
  const slimeLeft = pb.inventory.items.filter((i) => i.kind === "material" && i.materialId === "slimeCore").length;
  ok("materials consumed (2 → 0)", slimeLeft === 0, `slime left=${slimeLeft}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
