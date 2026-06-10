// Sprint 247: trade chat channel — tagged broadcast, default world. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect(); const b = await connect();
  const bChats = []; b.on("chatMessage", (m) => bChats.push(m));
  a.emit("login", { email: `tc247a${sfx}@t.vn`, accountName: `TC247A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `tc247b${sfx}@t.vn`, accountName: `TC247B${sfx}`, password: "test1234" });
  await once(b, "player");
  await sleepMs(300);

  a.emit("chatMessage", { message: "ban kiem epic gia re", channel: "trade" });
  await sleepMs(600);
  const trade = bChats.find((m) => m.accountName === `TC247A${sfx}`);
  ok("trade message broadcast with channel", trade?.channel === "trade", JSON.stringify(trade?.channel));

  await sleepMs(1000); // chat cooldown
  a.emit("chatMessage", { message: "hello the gioi" });
  await sleepMs(600);
  const world = bChats.find((m) => m.message === "hello the gioi");
  ok("default channel is world", world?.channel === "world");

  await sleepMs(1000);
  a.emit("chatMessage", { message: "hack channel", channel: "admin" });
  await sleepMs(600);
  const hacked = bChats.find((m) => m.message === "hack channel");
  ok("unknown channel coerced to world", hacked?.channel === "world");

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
