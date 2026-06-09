// Sprint 165: level-milestone reward chests. DEV_CHEATS=1.
// Run: node smoke-milestone-test.mjs
import { io } from "socket.io-client";
import { LEVEL_MILESTONES, levelMilestone } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("milestones defined (10/25/50)", LEVEL_MILESTONES.map((m) => m.level).join(",") === "10,25,50");
  ok("levelMilestone(10) reward", levelMilestone(10)?.gems === 20);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `ms${sfx}@t.vn`, accountName: `MS${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");

  // Claim before reaching level → rejected.
  s.emit("claimLevelMilestone", { level: 10 });
  await sleep(300);
  ok("milestone locked before level", sys.some((m) => m.includes("Cần đạt cấp 10")));

  // Grant lots of exp to surpass level 10.
  s.emit("devGrant", { exp: 100000 });
  const leveled = await waitPlayer(s, (p) => p.stats.level >= 10, 5000);
  ok("reached level >= 10 via devGrant exp", leveled.stats.level >= 10, `lvl=${leveled.stats.level}`);
  const goldBefore = leveled.stats.gold, gemsBefore = leveled.gems ?? 0;

  s.emit("claimLevelMilestone", { level: 10 });
  const pc = await waitPlayer(s, (p) => (p.claimedMilestones ?? []).includes(10), 5000);
  ok("milestone 10 recorded", (pc.claimedMilestones ?? []).includes(10));
  ok("reward gold +5000", pc.stats.gold === goldBefore + 5000, `gold ${goldBefore}->${pc.stats.gold}`);
  ok("reward gems +20", (pc.gems ?? 0) === gemsBefore + 20);

  // Claim again → rejected.
  sys.length = 0;
  s.emit("claimLevelMilestone", { level: 10 });
  await sleep(300);
  ok("double claim rejected", sys.some((m) => m.includes("đã nhận mốc này")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
