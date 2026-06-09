// Sprint 189: socket-gem daily quest. DEV_CHEATS=1.
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
  let lastQ = null;
  s.on("questList", (p) => { lastQ = p; });
  const active = (id) => lastQ?.active.find((q) => q.id === id);
  const waitQ = (id, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout quest")), t); const iv = setInterval(() => { const q = active(id); if (q && pred(q)) { clearInterval(iv); clearTimeout(h); res(q); } }, 100); });
  s.emit("login", { email: `qs${sfx}@t.vn`, accountName: `QS${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devClearQuests");
  await sleep(300);
  s.emit("acceptQuest", { questId: "daily-socket-1" });
  await waitQ("daily-socket-1", (q) => q.progress === 0);
  ok("accepted socket quest at 0", active("daily-socket-1").progress === 0);

  s.emit("devGrant", { gems: 500 });
  s.emit("devGrantItem", { name: "G", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")) && (p.gems ?? 0) >= 500);
  const id = pg.inventory.items.find((i) => i.id.startsWith("dev-")).id;
  s.emit("socketGem", { itemId: id, gemId: "ruby" });
  await waitQ("daily-socket-1", (q) => q.completed, 4000);
  ok("socket quest completed after socketing", active("daily-socket-1").completed);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
