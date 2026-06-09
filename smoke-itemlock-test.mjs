// Sprint 151: item lock (Khóa vật phẩm) — locked gear is protected from
// salvage / drop / sell. Server: DEV_CHEATS=1. Run: node smoke-itemlock-test.mjs
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `lk${sfx}@t.vn`, accountName: `LK${sfx}`, password: "test1234" });
  await once(s, "player");

  // Grant an epic item.
  s.emit("devGrantItem", { name: "Lockable Blade", rarity: "epic", slot: "weapon" });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "equipment" && i.rarity === "epic"));
  const item = pg.inventory.items.find((i) => i.kind === "equipment" && i.rarity === "epic");
  ok("epic item granted", !!item);

  // Lock it.
  s.emit("toggleItemLock", { itemId: item.id });
  const pl = await waitPlayer(s, (p) => p.inventory.items.find((i) => i.id === item.id)?.locked === true);
  ok("item is locked", pl.inventory.items.find((i) => i.id === item.id)?.locked === true);
  await sleep(200);
  ok("lock system message", sys.some((m) => m.includes("Đã khóa")));

  // Try salvage while locked → rejected, item stays.
  sys.length = 0;
  s.emit("salvageItem", { itemId: item.id });
  await sleep(350);
  ok("salvage blocked while locked", sys.some((m) => m.includes("đang khóa")));
  ok("locked item still present", pl.inventory.items.some((i) => i.id === item.id));

  // Try drop while locked → rejected.
  sys.length = 0;
  s.emit("dropItem", { itemId: item.id });
  await sleep(350);
  ok("drop blocked while locked", sys.some((m) => m.includes("đang khóa")));

  // Unlock → salvage now works.
  s.emit("toggleItemLock", { itemId: item.id });
  await waitPlayer(s, (p) => p.inventory.items.find((i) => i.id === item.id)?.locked === false);
  s.emit("salvageItem", { itemId: item.id });
  const ps = await waitPlayer(s, (p) => !p.inventory.items.some((i) => i.id === item.id), 5000);
  ok("unlocked item can be salvaged", !ps.inventory.items.some((i) => i.id === item.id));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
