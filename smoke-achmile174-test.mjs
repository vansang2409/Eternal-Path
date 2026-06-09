// Sprint 174: achievement-count milestone rewards. DEV_CHEATS=1.
// Run: node smoke-achmile174-test.mjs
import { io } from "socket.io-client";
import { ACHIEVEMENT_MILESTONES, achievementMilestone } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("milestones 5/15/30", ACHIEVEMENT_MILESTONES.map((m) => m.count).join(",") === "5,15,30");
  ok("achievementMilestone(5).gems=15", achievementMilestone(5)?.gems === 15);
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `am${sfx}@t.vn`, accountName: `AM${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");

  // Claim before reaching 5 → rejected.
  s.emit("claimAchievementMilestone", { count: 5 });
  await sleep(300);
  ok("milestone locked before 5 achievements", sys.some((m) => m.includes("Cần mở 5 thành tựu")));

  // Grant 5 achievements.
  for (const id of ["first-blood", "reach-level-5", "kill-100", "epic-find", "craft-master"]) s.emit("devGrantAchievement", { id });
  const pa = await waitPlayer(s, (p) => (p.achievements?.length ?? 0) >= 5);
  const gems0 = pa.gems ?? 0;
  s.emit("claimAchievementMilestone", { count: 5 });
  const pc = await waitPlayer(s, (p) => (p.claimedAchTiers ?? []).includes(5), 4000);
  ok("milestone 5 recorded", (pc.claimedAchTiers ?? []).includes(5));
  ok("reward +15 gems", (pc.gems ?? 0) === gems0 + 15, `gems ${gems0}->${pc.gems}`);

  // Double claim rejected.
  sys.length = 0;
  s.emit("claimAchievementMilestone", { count: 5 });
  await sleep(300);
  ok("double claim rejected", sys.some((m) => m.includes("đã nhận mốc thành tựu này")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
