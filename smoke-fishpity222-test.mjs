// Sprint 222: fishing pity — 8th cast without a fine catch is upgraded. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { FISHING_PITY_CASTS, isFineCatch } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });

ok("pity at 8 casts", FISHING_PITY_CASTS === 8);
ok("fine catch ids", isFineCatch("fine-fish") && isFineCatch("giant-fish") && !isFineCatch("boot") && !isFineCatch("common-fish"));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `fp222${sfx}@t.vn`, accountName: `FP222${sfx}`, password: "test1234" });
  await once(s, "player");

  // 7 deliberate common catches (roll 0.2) — pity builds, no upgrade yet.
  const ids = [];
  for (let i = 0; i < 7; i++) {
    s.emit("devFish", { roll: 0.2 });
    const r = await once(s, "fishResult");
    ids.push(r.id);
  }
  ok("7 commons stay common", ids.every((id) => id === "common-fish"), ids.join(","));

  // 8th cast with a common roll must be upgraded to fine-fish.
  s.emit("devFish", { roll: 0.2 });
  const r8 = await once(s, "fishResult");
  ok("8th cast upgraded to fine", r8.id === "fine-fish", r8.id);

  // Pity reset: the next common roll stays common again.
  s.emit("devFish", { roll: 0.2 });
  const r9 = await once(s, "fishResult");
  ok("pity reset after fine catch", r9.id === "common-fish", r9.id);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
