// Sprint 80: friend online notification on login.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-friendnoti-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3223";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const aName = `FnA${sfx}`, bName = `FnB${sfx}`;
  // A logs in, friends B, then disconnects (so we can re-login B while A online).
  const a = await connect();
  const aSys = [];
  a.on("system", (m) => aSys.push(m));
  a.emit("login", { email: `fna${sfx}@t.vn`, accountName: aName, password: "test1234" });
  await once(a, "player");
  a.emit("addFriend", { name: bName });
  await sleep(400);
  ok("A added B as friend", aSys.some((m) => m.includes("vào danh sách bạn")));

  // B logs in while A is online → A should get an online notification.
  const b = await connect();
  b.emit("login", { email: `fnb${sfx}@t.vn`, accountName: bName, password: "test1234" });
  await once(b, "player");
  await sleep(600);
  ok("A notified when friend B comes online", aSys.some((m) => m.includes(bName) && m.includes("vừa online")));

  // A player NOT friended should not trigger a notification to A.
  const c = await connect();
  c.emit("login", { email: `fnc${sfx}@t.vn`, accountName: `FnC${sfx}`, password: "test1234" });
  await once(c, "player");
  await sleep(500);
  ok("no notification for non-friend", !aSys.some((m) => m.includes(`FnC${sfx}`) && m.includes("vừa online")));

  a.disconnect(); b.disconnect(); c.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
