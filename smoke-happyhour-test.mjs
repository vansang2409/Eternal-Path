// Sprint 167: Happy Hour world event — server-wide x2 gold broadcast. DEV_CHEATS=1.
// Run: node smoke-happyhour-test.mjs
import { io } from "socket.io-client";
import { isHappyHourActive, HAPPY_HOUR_MULTIPLIER } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });

const run = async () => {
  ok("multiplier x2", HAPPY_HOUR_MULTIPLIER === 2);
  ok("isHappyHourActive helper", isHappyHourActive(Date.now() + 1000) && !isHappyHourActive(Date.now() - 1000) && !isHappyHourActive(undefined));
  const sfx = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  a.emit("login", { email: `hh${sfx}a@t.vn`, accountName: `HHa${sfx}`, password: "test1234" });
  b.emit("login", { email: `hh${sfx}b@t.vn`, accountName: `HHb${sfx}`, password: "test1234" });
  await once(a, "player"); await once(b, "player");

  // Listen for the world event on BOTH clients.
  const evA = once(a, "worldEvent", 4000);
  const evB = once(b, "worldEvent", 4000);
  // Trigger from A.
  a.emit("devHappyHour");
  const [ea, eb] = await Promise.all([evA, evB]);
  ok("trigger broadcasts to triggerer", ea.kind === "happyHour" && isHappyHourActive(ea.until));
  ok("broadcasts server-wide to other player", eb.kind === "happyHour" && eb.multiplier === 2);

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
