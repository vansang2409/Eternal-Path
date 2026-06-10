// Sprint 204: pen-pal achievement + send-mail daily quest. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("pen-pal achievement defined", ACHIEVEMENTS.some((a) => a.id === "pen-pal"));
  const sfx = Date.now() % 100000;
  const s = await connect();
  let lastQ = null; s.on("questList", (p) => { lastQ = p; });
  const active = (id) => lastQ?.active.find((q) => q.id === id);
  const waitQ = (id, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout quest")), t); const iv = setInterval(() => { const q = active(id); if (q && pred(q)) { clearInterval(iv); clearTimeout(h); res(q); } }, 100); });
  s.emit("login", { email: `mq${sfx}@t.vn`, accountName: `MQ${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devClearQuests"); await sleep(300);
  s.emit("acceptQuest", { questId: "daily-mail-1" });
  await waitQ("daily-mail-1", (q) => q.progress === 0);

  s.emit("devGrant", { gold: 5000 });
  await waitPlayer(s, (p) => p.stats.gold >= 5000);
  s.emit("sendMail", { to: `Nobody${sfx}`, gold: 100, message: "hi" });
  const pe = await waitPlayer(s, (p) => (p.achievements ?? []).includes("pen-pal"), 4000);
  ok("pen-pal unlocked by sending mail", (pe.achievements ?? []).includes("pen-pal"));
  await waitQ("daily-mail-1", (q) => q.completed, 4000);
  ok("send-mail quest completed", active("daily-mail-1").completed);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
