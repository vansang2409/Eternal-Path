// Sprint 234: angler leaderboard tab (byFish). DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `fb234${sfx}@t.vn`, accountName: `FB234${sfx}`, password: "test1234" });
  await once(s, "player");

  // Catch 3 fish, then ask for the board.
  for (let i = 0; i < 3; i++) { s.emit("devFish", { roll: 0.2 }); await once(s, "fishResult"); }
  await sleepMs(300);
  s.emit("leaderboardRequest");
  const board = await once(s, "leaderboard");
  ok("byFish present", Array.isArray(board.byFish));
  const me = board.byFish.find((r) => r.accountName === `FB234${sfx}`);
  ok("self on angler board with 3 fish", Boolean(me) && me.fishCaught === 3, JSON.stringify(me));
  ok("board sorted desc", board.byFish.every((r, i, a) => i === 0 || a[i - 1].fishCaught >= r.fishCaught));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
