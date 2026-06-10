// Sprint 243: story quest chain — sequential chapters, claim advances. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastQuests = null; let lastPlayer = null;
  s.on("questList", (q) => { lastQuests = q; });
  s.on("player", (p) => { lastPlayer = p; });
  const untilQ = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastQuests && pred(lastQuests)) return lastQuests; await sleepMs(100); } throw new Error("untilQ timeout"); };
  const hasQuest = (q, id) => [...(q.active ?? []), ...(q.available ?? [])].some((v) => v.id === id);

  s.emit("login", { email: `sq243${sfx}@t.vn`, accountName: `SQ243${sfx}`, password: "test1234" });
  await once(s, "player");

  // Chapter 1 (story-cull-5) is auto-granted; chapter 2 is not.
  const q0 = await untilQ((q) => hasQuest(q, "story-cull-5"));
  ok("chapter 1 auto-granted", Boolean(q0));
  ok("chapter 2 not yet", !hasQuest(q0, "story-reach-5"));

  // Kill 5 → claim chapter 1 → chapter 2 appears, index persists.
  for (let i = 0; i < 5; i++) { s.emit("devSimKill", {}); await sleepMs(120); }
  await sleepMs(400);
  s.emit("claimQuest", { questId: "story-cull-5" });
  const q1 = await untilQ((q) => hasQuest(q, "story-reach-5"));
  ok("chapter 2 unlocked after claim", Boolean(q1));
  ok("chapter 1 removed", !hasQuest(q1, "story-cull-5"));
  await sleepMs(300);
  ok("storyQuestIndex = 1", (lastPlayer?.storyQuestIndex ?? 0) === 1);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
