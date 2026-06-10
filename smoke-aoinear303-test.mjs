// Sprint 303: positional events are AOI-scoped — far clients receive no
// floatingText from someone else's combat. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect(); const b = await connect();
  const bFloats = []; b.on("floatingText", (f) => bFloats.push(f));
  const aFloats = []; a.on("floatingText", (f) => aFloats.push(f));

  a.emit("login", { email: `an303a${sfx}@t.vn`, accountName: `AN303A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `an303b${sfx}@t.vn`, accountName: `AN303B${sfx}`, password: "test1234" });
  await once(b, "player");

  // A at town, B far away. A fights (devSimKill emits exp/gold floats at A).
  // The shared smoke server has a LIVE world (DOT ticks from earlier suites
  // can emit floats elsewhere), so only count floats near A's position.
  const nearA = (f) => Math.hypot(f.position.x - 400, f.position.y - 400) < 1300;
  a.emit("devTeleport", { x: 400, y: 400 });
  b.emit("devTeleport", { x: 5500, y: 4300 });
  await sleepMs(600);
  bFloats.length = 0; aFloats.length = 0;
  a.emit("devSimKill", {});
  await sleepMs(700);
  ok("attacker sees own combat floats", aFloats.filter(nearA).length >= 1, `a=${aFloats.length}`);
  ok("far player receives none from A's fight", bFloats.filter(nearA).length === 0, `b=${bFloats.filter(nearA).length}`);

  // B moves next to A → now the floats arrive.
  b.emit("devTeleport", { x: 600, y: 400 });
  await sleepMs(500);
  bFloats.length = 0;
  a.emit("devSimKill", {});
  await sleepMs(700);
  ok("near player receives A's floats", bFloats.filter(nearA).length >= 1, `b=${bFloats.filter(nearA).length}`);

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
