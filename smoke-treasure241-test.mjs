// Sprint 241: treasure maps — dig pays 400-900 gold, counts a chest. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { rollTreasureGold, TREASURE_GOLD_MIN, TREASURE_GOLD_MAX, makeTreasureMapItem } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("roll bounds", rollTreasureGold(0) === TREASURE_GOLD_MIN && rollTreasureGold(0.9999) === TREASURE_GOLD_MAX);
ok("factory makes a treasure map", makeTreasureMapItem().treasureMap === true && makeTreasureMapItem().kind === "consumable");

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `tm241${sfx}@t.vn`, accountName: `TM241${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrantMap");
  const p1 = await until((p) => p.inventory.items.some((i) => i.treasureMap));
  const map = p1.inventory.items.find((i) => i.treasureMap);
  const gold0 = p1.stats.gold; const chests0 = p1.chestsOpened ?? 0;

  s.emit("useItem", { itemId: map.id });
  const p2 = await until((p) => p.stats.gold > gold0);
  const dug = p2.stats.gold - gold0;
  ok("dig pays 400-900 gold", dug >= TREASURE_GOLD_MIN && dug <= TREASURE_GOLD_MAX, `+${dug}`);
  ok("map consumed", !p2.inventory.items.some((i) => i.treasureMap));
  ok("counts as chest opened", (p2.chestsOpened ?? 0) === chests0 + 1);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
