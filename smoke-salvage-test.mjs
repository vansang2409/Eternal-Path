// Sprint 144: salvage (Phân Giải) equipment into crafting materials.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-salvage-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const matCount = (p, id) => p.inventory.items.filter((i) => i.kind === "material" && i.materialId === id).length;

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `sv${sfx}@t.vn`, accountName: `SV${sfx}`, password: "test1234" });
  await once(s, "player");

  // Salvage a non-existent item → rejected with a message.
  s.emit("salvageItem", { itemId: "does-not-exist" });
  await sleep(350);
  ok("missing item rejected", sys.some((m) => m.includes("Không tìm thấy")));

  // Grant an EPIC weapon, then salvage it → epic yields voidAsh + crystalShard.
  s.emit("devGrantItem", { name: "Test Epic Blade", rarity: "epic", slot: "weapon" });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "equipment" && i.rarity === "epic"));
  const epicItem = pg.inventory.items.find((i) => i.kind === "equipment" && i.rarity === "epic");
  ok("epic item granted", !!epicItem);
  const voidBefore = matCount(pg, "voidAsh");
  const crystalBefore = matCount(pg, "crystalShard");

  s.emit("salvageItem", { itemId: epicItem.id });
  const ps = await waitPlayer(s, (p) => !p.inventory.items.some((i) => i.id === epicItem.id), 5000);
  ok("epic item consumed by salvage", !ps.inventory.items.some((i) => i.id === epicItem.id));
  ok("epic salvage yields +1 voidAsh", matCount(ps, "voidAsh") === voidBefore + 1, `voidAsh ${voidBefore}->${matCount(ps, "voidAsh")}`);
  ok("epic salvage yields +1 crystalShard", matCount(ps, "crystalShard") === crystalBefore + 1, `crystalShard ${crystalBefore}->${matCount(ps, "crystalShard")}`);

  // Grant a RARE helmet, salvage → yields emberHeart.
  s.emit("devGrantItem", { name: "Test Rare Helm", rarity: "rare", slot: "helmet" });
  const pr = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "equipment" && i.rarity === "rare"));
  const rareItem = pr.inventory.items.find((i) => i.kind === "equipment" && i.rarity === "rare");
  const emberBefore = matCount(pr, "emberHeart");
  s.emit("salvageItem", { itemId: rareItem.id });
  const pr2 = await waitPlayer(s, (p) => !p.inventory.items.some((i) => i.id === rareItem.id), 5000);
  ok("rare salvage yields +1 emberHeart", matCount(pr2, "emberHeart") === emberBefore + 1, `emberHeart ${emberBefore}->${matCount(pr2, "emberHeart")}`);

  // Cannot salvage a material (only equipment).
  const aMaterial = pr2.inventory.items.find((i) => i.kind === "material");
  if (aMaterial) {
    const beforeLen = pr2.inventory.items.length;
    s.emit("salvageItem", { itemId: aMaterial.id });
    await sleep(350);
    ok("material cannot be salvaged", sys.some((m) => m.includes("Chỉ phân giải được trang bị")));
  } else {
    ok("material cannot be salvaged", true);
  }

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
