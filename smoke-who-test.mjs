// Sprint 87: /who online players list.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-who-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3233";
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
  a.emit("login", { email: `wa${sfx}@t.vn`, accountName: `WhoA${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `wb${sfx}@t.vn`, accountName: `WhoB${sfx}`, password: "test1234" });
  await once(b, "player");
  await sleep(300);

  const listP = once(a, "onlineList");
  a.emit("requestOnline");
  const list = await listP;
  ok("online count >= 2", list.count >= 2, `count=${list.count}`);
  ok("includes self", list.players.some((p) => p.accountName === `WhoA${sfx}`));
  ok("includes other", list.players.some((p) => p.accountName === `WhoB${sfx}`));
  ok("rows have level", list.players.every((p) => typeof p.level === "number"));

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
