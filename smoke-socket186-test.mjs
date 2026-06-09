// Sprint 186: gem socketing. DEV_CHEATS=1. Run: node smoke-socket186-test.mjs
import { io } from "socket.io-client";
import { GEM_CATALOG, getStatGem } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("4 gems defined", GEM_CATALOG.length === 4);
  ok("ruby = +8 atk", getStatGem("ruby")?.stats.attack === 8);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `gm${sfx}@t.vn`, accountName: `GM${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrantItem", { name: "Socket Blade", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")));
  const item = pg.inventory.items.find((i) => i.id.startsWith("dev-"));

  // Socket without gems → rejected.
  s.emit("socketGem", { itemId: item.id, gemId: "ruby" });
  await sleep(300);
  ok("socket blocked without gems", sys.some((m) => m.includes("để khảm Hồng Ngọc")));

  // Grant gems, socket ruby → +8 atk folded in (10 → 18), gems -60.
  s.emit("devGrant", { gems: 500 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 500);
  s.emit("socketGem", { itemId: item.id, gemId: "ruby" });
  const ps = await waitPlayer(s, (p) => p.inventory.items.find((i) => i.id === item.id)?.socketGem?.gemId === "ruby", 4000);
  const sItem = ps.inventory.items.find((i) => i.id === item.id);
  ok("gem socketed", sItem.socketGem?.gemId === "ruby");
  ok("attack folded in (10 -> 18)", sItem.stats.attack === 18, `atk=${sItem.stats.attack}`);
  ok("gems deducted 60", ps.gems === 500 - 60, `gems=${ps.gems}`);

  // Socket again while occupied → rejected.
  sys.length = 0;
  s.emit("socketGem", { itemId: item.id, gemId: "sapphire" });
  await sleep(300);
  ok("re-socket rejected when occupied", sys.some((m) => m.includes("đã có đá quý")));

  // Unsocket → attack back to 10, gem gone.
  s.emit("unsocketGem", { itemId: item.id });
  const pu = await waitPlayer(s, (p) => !p.inventory.items.find((i) => i.id === item.id)?.socketGem, 4000);
  const uItem = pu.inventory.items.find((i) => i.id === item.id);
  ok("unsocket removes gem", !uItem.socketGem);
  ok("attack restored to 10", uItem.stats.attack === 10, `atk=${uItem.stats.attack}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
