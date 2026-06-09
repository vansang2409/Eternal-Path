// Sprint 155: gold item enhancement (+N / "Đập đồ"). Server: DEV_CHEATS=1.
// Run: node smoke-upgrade-test.mjs
import { io } from "socket.io-client";
import { upgradeCost, upgradeSuccessChance } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("cost grows with level", upgradeCost(0) === 800 && upgradeCost(1) === 1600);
  ok("plus0 guaranteed success", upgradeSuccessChance(0) === 1);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `up${sfx}@t.vn`, accountName: `UP${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrantItem", { name: "Upgradable Sword", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.kind === "equipment" && i.id.startsWith("dev-")));
  const item = pg.inventory.items.find((i) => i.kind === "equipment" && i.id.startsWith("dev-"));
  ok("item granted with attack 10", item.stats.attack === 10);

  // No gold → rejected.
  s.emit("upgradeItem", { itemId: item.id });
  await sleep(350);
  ok("upgrade blocked without gold", sys.some((m) => m.includes("để cường hóa")));

  // Grant gold, upgrade (+0 → +1 is guaranteed).
  s.emit("devGrant", { gold: 5000 });
  await waitPlayer(s, (p) => p.stats.gold >= 5000);
  s.emit("upgradeItem", { itemId: item.id });
  const pu = await waitPlayer(s, (p) => (p.inventory.items.find((i) => i.id === item.id)?.plusLevel ?? 0) === 1, 5000);
  const up = pu.inventory.items.find((i) => i.id === item.id);
  ok("item is now +1", up.plusLevel === 1);
  ok("attack increased after upgrade", up.stats.attack > 10, `atk=${up.stats.attack}`);
  ok("gold deducted by upgradeCost(0)", pu.stats.gold === 5000 - upgradeCost(0), `gold=${pu.stats.gold}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
