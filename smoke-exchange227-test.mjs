// Sprint 227: material exchange 5 → 1 next tier. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { MATERIAL_UPGRADE_CHAIN, MATERIAL_UPGRADE_RATIO, nextMaterialTier } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("chain has 9 tiers", MATERIAL_UPGRADE_CHAIN.length === 9);
ok("ratio is 5", MATERIAL_UPGRADE_RATIO === 5);
ok("slimeCore upgrades to wolfFang", nextMaterialTier("slimeCore") === "wolfFang");
ok("wardenHeart is terminal", nextMaterialTier("wardenHeart") === undefined);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `ex227${sfx}@t.vn`, accountName: `EX227${sfx}`, password: "test1234" });
  await once(s, "player");

  const countMat = (p, id) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === id).length;

  // Not enough: 4 cores → rejected.
  s.emit("devGrantMaterial", { materialId: "slimeCore", count: 4 });
  await until((p) => countMat(p, "slimeCore") === 4);
  s.emit("exchangeMaterials", { materialId: "slimeCore" });
  await sleepMs(400);
  ok("4 cores rejected", sysMsgs.some((m) => m.includes("Cần 5")) && countMat(lastPlayer, "slimeCore") === 4);

  // Add 1 more → exchange succeeds: 0 cores, +1 wolfFang.
  s.emit("devGrantMaterial", { materialId: "slimeCore", count: 1 });
  await until((p) => countMat(p, "slimeCore") === 5);
  const fangs0 = countMat(lastPlayer, "wolfFang");
  s.emit("exchangeMaterials", { materialId: "slimeCore" });
  const p2 = await until((p) => countMat(p, "slimeCore") === 0);
  ok("5 cores consumed", countMat(p2, "slimeCore") === 0);
  ok("1 wolfFang minted", countMat(p2, "wolfFang") === fangs0 + 1);

  // Terminal tier rejected.
  s.emit("devGrantMaterial", { materialId: "wardenHeart", count: 5 });
  await until((p) => countMat(p, "wardenHeart") === 5);
  s.emit("exchangeMaterials", { materialId: "wardenHeart" });
  await sleepMs(400);
  ok("terminal tier rejected", sysMsgs.some((m) => m.includes("bậc cao nhất")) && countMat(lastPlayer, "wardenHeart") === 5);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
