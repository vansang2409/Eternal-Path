// Sprint 221: fishing — weighted table, payouts, cooldown, counter. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { FISHING_TABLE, rollFishing } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// Unit checks — weights sum to 100 and boundary rolls hit expected rows.
ok("weights sum 100", FISHING_TABLE.reduce((s, e) => s + e.weight, 0) === 100);
ok("roll 0 = boot", rollFishing(0).id === "boot");
ok("roll 0.10 = common fish", rollFishing(0.10).id === "common-fish");
ok("roll 0.985 = giant", rollFishing(0.985).id === "giant-fish");
ok("giant announces", rollFishing(0.999).announce === true);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `fs221${sfx}@t.vn`, accountName: `FS221${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gold0 = p0.stats.gold;

  // Deterministic: common fish (+25 gold), counter +1.
  s.emit("devFish", { roll: 0.2 });
  const r1 = await once(s, "fishResult");
  ok("devFish 0.2 = common fish", r1.id === "common-fish" && r1.gold === 25);
  const p1 = await until((p) => (p.fishCaught ?? 0) === 1);
  ok("gold +25, fishCaught 1", p1.stats.gold === gold0 + 25);

  // Junk boot: no gold, no counter.
  s.emit("devFish", { roll: 0.01 });
  const r2 = await once(s, "fishResult");
  ok("boot = no payout", r2.id === "boot" && r2.gold === 0);

  // Material catch adds an emberHeart to the bag.
  s.emit("devFish", { roll: 0.91 });
  await once(s, "fishResult");
  const p3 = await until((p) => p.inventory.items.some((i) => i.kind === "material" && i.materialId === "emberHeart"));
  ok("ember material landed in bag", Boolean(p3));

  // Cooldown: the devFish above just cast (lastFishAt = now), so a public
  // cast right away must be rejected with the cooldown message.
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("fish", {});
  await sleepMs(500);
  ok("cast inside cooldown is blocked", sysMsgs.some((m) => m.includes("chưa sẵn sàng")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
