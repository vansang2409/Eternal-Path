// Sprint 156: talent respec (Tẩy điểm tài năng). Server: DEV_CHEATS=1.
// Run: node smoke-respec-test.mjs
import { io } from "socket.io-client";
import { RESPEC_COST_PER_POINT } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const rankSum = (p) => Object.values(p.skillRanks ?? {}).reduce((a, b) => a + (b ?? 0), 0);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `rs${sfx}@t.vn`, accountName: `RS${sfx}`, password: "test1234" });
  await once(s, "player");

  // Nothing spent → respec rejected.
  s.emit("respecTalents");
  await sleep(300);
  ok("respec rejected when nothing spent", sys.some((m) => m.includes("chưa tiêu điểm")));

  // Grant talent points + gold, spend 2 on a default skill.
  s.emit("devGrant", { talentPoints: 3, gold: 10000 });
  await waitPlayer(s, (p) => (p.talentPoints ?? 0) >= 3 && p.stats.gold >= 10000);
  s.emit("upgradeSkill", { skillId: "powerStrike" });
  s.emit("upgradeSkill", { skillId: "powerStrike" });
  const spentP = await waitPlayer(s, (p) => rankSum(p) === 2, 4000);
  ok("spent 2 talent points", rankSum(spentP) === 2 && (spentP.talentPoints ?? 0) === 1, `tp=${spentP.talentPoints}`);
  const goldBefore = spentP.stats.gold;

  // Respec → ranks cleared, points refunded, gold charged 600*2.
  s.emit("respecTalents");
  const rp = await waitPlayer(s, (p) => rankSum(p) === 0, 4000);
  ok("ranks cleared after respec", rankSum(rp) === 0);
  ok("points refunded", (rp.talentPoints ?? 0) === 3, `tp=${rp.talentPoints}`);
  ok("gold charged per point", rp.stats.gold === goldBefore - RESPEC_COST_PER_POINT * 2, `gold ${goldBefore}->${rp.stats.gold}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
