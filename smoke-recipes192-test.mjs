// Sprint 192: apex helmet + boots recipes. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { getRecipe } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const grant = (s, id, n) => s.emit("devGrantMaterial", { materialId: id, count: n });

ok("abyssal-crown recipe present", getRecipe("abyssal-crown")?.slot === "helmet");
ok("dragonstride-boots recipe present", getRecipe("dragonstride-boots")?.slot === "boots");

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `rc192${sfx}@t.vn`, accountName: `RC192${sfx}`, password: "test1234" });
  await once(s, "player");
  grant(s, "wardenHeart", 2); grant(s, "voidAsh", 4); grant(s, "cursedBark", 3);
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === "voidAsh").length >= 4);
  s.emit("craftRecipe", { recipeId: "abyssal-crown" });
  const pc = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "equipment" && i.name === "Vương Miện Vực Thẳm"), 5000);
  ok("apex helmet crafted (epic helmet)", pc.inventory.items.some((i) => i.kind === "equipment" && i.name === "Vương Miện Vực Thẳm" && i.rarity === "epic" && i.slot === "helmet"));
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
