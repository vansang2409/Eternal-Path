// Sprint 214: new themed recipes. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { getRecipe } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
ok("magma-warblade recipe (weapon)", getRecipe("magma-warblade").slot === "weapon");
ok("reaper-mantle recipe (armor)", getRecipe("reaper-mantle").slot === "armor");
const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `r214${sfx}@t.vn`, accountName: `R214${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrantMaterial", { materialId: "emberHeart", count: 4 });
  s.emit("devGrantMaterial", { materialId: "crystalShard", count: 2 });
  s.emit("devGrantMaterial", { materialId: "voidAsh", count: 2 });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === "emberHeart").length >= 4);
  s.emit("craftRecipe", { recipeId: "magma-warblade" });
  const pc = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.name === "Chiến Kiếm Dung Nham"), 5000);
  ok("magma weapon crafted (epic)", pc.inventory.items.some((i) => i.kind === "equipment" && i.name === "Chiến Kiếm Dung Nham" && i.rarity === "epic"));
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
