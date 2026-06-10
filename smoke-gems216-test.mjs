// Sprint 216: high-tier gems. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { GEM_CATALOG, getStatGem } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
ok("6 gems now", GEM_CATALOG.length === 6);
ok("blood-ruby = +16 atk", getStatGem("blood-ruby").stats.attack === 16);
const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `gm216${sfx}@t.vn`, accountName: `GM216${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrantAchievement", { id: "jeweler" });
  s.emit("devGrant", { gems: 500 });
  s.emit("devGrantItem", { name: "T", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")) && (p.gems ?? 0) >= 500);
  const id = pg.inventory.items.find((i) => i.id.startsWith("dev-")).id;
  s.emit("socketGem", { itemId: id, gemId: "blood-ruby" });
  const ps = await waitPlayer(s, (p) => p.inventory.items.find((i) => i.id === id)?.socketGem?.gemId === "blood-ruby", 4000);
  ok("blood-ruby socketed (+16 atk: 10->26)", ps.inventory.items.find((i) => i.id === id).stats.attack === 26);
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
