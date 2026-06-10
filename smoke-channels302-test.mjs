// Sprint 302: channel sharding — isolated worlds, scoped chat, one-channel
// account lock. DEV_CHEATS=1, server CHANNELS>=2.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connectCh = (channel) => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"], query: { channel: String(channel) } }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connectCh(1);
  const b = await connectCh(2);
  let aSnap = null; a.on("snapshot", (s2) => { aSnap = s2; });
  const aChats = []; a.on("chatMessage", (m) => aChats.push(m));
  const bChats = []; b.on("chatMessage", (m) => bChats.push(m));

  a.emit("login", { email: `ch302a${sfx}@t.vn`, accountName: `CH302A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `ch302b${sfx}@t.vn`, accountName: `CH302B${sfx}`, password: "test1234" });
  await once(b, "player");

  // Same spot, different channels → invisible to each other.
  a.emit("devTeleport", { x: 400, y: 400 });
  b.emit("devTeleport", { x: 400, y: 400 });
  await sleepMs(800);
  ok("cross-channel player invisible", !(aSnap?.players ?? []).some((p) => p.accountName === `CH302B${sfx}`));

  // Chat stays inside the channel.
  b.emit("chatMessage", { message: "hello from CH2" });
  await sleepMs(600);
  ok("chat scoped to channel", !aChats.some((m) => m.message === "hello from CH2") && bChats.some((m) => m.message === "hello from CH2"));

  // Same account cannot log into another channel while online.
  const a2 = await connectCh(2);
  const sys2 = []; a2.on("system", (m) => sys2.push(String(m)));
  a2.emit("login", { email: `ch302a${sfx}@t.vn`, accountName: `CH302A${sfx}`, password: "test1234" });
  await sleepMs(700);
  ok("account locked to one channel", sys2.some((m) => m.includes("đang online ở Kênh 1")));

  // Unknown channel falls back to 1 → A (channel 1) sees the newcomer.
  const c = await connectCh(99);
  c.emit("login", { email: `ch302c${sfx}@t.vn`, accountName: `CH302C${sfx}`, password: "test1234" });
  await once(c, "player");
  c.emit("devTeleport", { x: 450, y: 400 });
  await sleepMs(900);
  ok("unknown channel falls back to 1", (aSnap?.players ?? []).some((p) => p.accountName === `CH302C${sfx}`));

  a.disconnect(); b.disconnect(); a2.disconnect(); c.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
