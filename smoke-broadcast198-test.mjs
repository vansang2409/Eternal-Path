// Sprint 198: prestige achievement server-wide broadcast. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  const bMsgs = [];
  b.on("system", (m) => bMsgs.push(m));
  a.emit("login", { email: `bc${sfx}a@t.vn`, accountName: `BCa${sfx}`, password: "test1234" });
  b.emit("login", { email: `bc${sfx}b@t.vn`, accountName: `BCb${sfx}`, password: "test1234" });
  await once(a, "player"); await once(b, "player");

  // A reaches arena streak 5 → unlocks streak-master (prestige) → broadcast.
  for (let i = 0; i < 5; i++) a.emit("devArenaKill");
  await sleep(600);
  ok("other player receives prestige broadcast", bMsgs.some((m) => m.includes("vừa mở thành tựu") && m.includes("BCa")));

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
