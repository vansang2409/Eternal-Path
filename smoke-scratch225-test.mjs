// Sprint 225: scratch tickets — cost, prizes, house edge, jackpot announce. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { SCRATCH_TABLE, SCRATCH_TICKET_COST, rollScratch, scratchExpectedValue } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("weights sum 100", SCRATCH_TABLE.reduce((s, e) => s + e.weight, 0) === 100);
ok("house edge 10% (EV 180 < 200)", scratchExpectedValue() === 180 && SCRATCH_TICKET_COST === 200);
ok("roll 0 = miss", rollScratch(0).id === "miss");
ok("roll 0.66 = small", rollScratch(0.66).id === "small");
ok("roll 0.999 = jackpot", rollScratch(0.999).id === "jackpot" && rollScratch(0.999).announce === true);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `sc225${sfx}@t.vn`, accountName: `SC225${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");

  // Broke player can't buy.
  if (p0.stats.gold < SCRATCH_TICKET_COST) {
    s.emit("buyScratchTicket");
    await sleepMs(400);
    ok("broke player rejected", sysMsgs.some((m) => m.includes("Cần 200 vàng")));
  } else {
    ok("broke player rejected", true, "skipped (starting gold)");
  }

  s.emit("devGrant", { gold: 1000 });
  await until((p) => p.stats.gold >= 1000);
  const gold1 = lastPlayer.stats.gold;

  // Deterministic miss: -200.
  s.emit("devScratch", { roll: 0.1 });
  const r1 = await once(s, "scratchResult");
  ok("miss pays 0", r1.id === "miss" && r1.payout === 0);
  const p2 = await until((p) => p.stats.gold === gold1 - 200);
  ok("gold -200 after miss", Boolean(p2) && (p2.scratchTickets ?? 0) === 1);

  // Deterministic jackpot: -200 +5000 and server-wide announce.
  s.emit("devScratch", { roll: 0.995 });
  const r2 = await once(s, "scratchResult");
  ok("jackpot pays 5000", r2.id === "jackpot" && r2.payout === 5000);
  const p3 = await until((p) => p.stats.gold === gold1 - 400 + 5000);
  ok("gold +4800 net after jackpot", Boolean(p3) && (p3.scratchTickets ?? 0) === 2);
  await sleepMs(300);
  ok("jackpot announced", sysMsgs.some((m) => m.includes("ĐỘC ĐẮC")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
