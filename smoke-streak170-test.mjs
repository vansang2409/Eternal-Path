// Sprint 170: arena kill-streak gem milestones. DEV_CHEATS=1.
// Run: node smoke-streak170-test.mjs
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const kill = (s) => new Promise((res) => { s.emit("devArenaKill"); s.once("player", res); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `st${sfx}@t.vn`, accountName: `ST${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");
  const gems0 = p0.gems ?? 0;

  // 2 kills → streak 2, no milestone bonus yet (only base 2 gems/kill).
  await kill(s); const p2 = await kill(s);
  ok("streak at 2", (p2.arenaStreak ?? 0) === 2, `streak=${p2.arenaStreak}`);
  ok("no milestone bonus before 3", (p2.gems ?? 0) === gems0 + 2 * 2, `gems=${p2.gems}`);

  // 3rd kill → streak 3 → +5 gem bonus on top of base.
  const p3 = await kill(s);
  ok("streak at 3", (p3.arenaStreak ?? 0) === 3);
  ok("milestone +5 gems at streak 3", (p3.gems ?? 0) === gems0 + 3 * 2 + 5, `gems=${p3.gems}`);

  // Death resets streak.
  s.emit("devArenaDeath");
  const pd = await waitPlayer(s, (p) => (p.arenaStreak ?? 0) === 0, 4000);
  ok("death resets streak", (pd.arenaStreak ?? 0) === 0);

  // Next kill starts fresh at 1.
  const pn = await kill(s);
  ok("streak restarts at 1", (pn.arenaStreak ?? 0) === 1);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
