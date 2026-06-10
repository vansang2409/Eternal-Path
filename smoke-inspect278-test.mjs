// Sprint 278: extended /inspect profile fields. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect(); const b = await connect();
  a.emit("login", { email: `ip278a${sfx}@t.vn`, accountName: `IP278A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `ip278b${sfx}@t.vn`, accountName: `IP278B${sfx}`, password: "test1234" });
  await once(b, "player");

  // A catches 2 fish so the profile has something to show.
  for (let i = 0; i < 2; i++) { a.emit("devFish", { roll: 0.2 }); await once(a, "fishResult"); }
  await sleepMs(300);

  b.emit("inspectPlayer", { name: `IP278A${sfx}` });
  const prof = await once(b, "playerProfile");
  ok("profile returned", Boolean(prof) && prof.accountName === `IP278A${sfx}`);
  ok("fishCaught in profile", prof.fishCaught === 2, `fish=${prof.fishCaught}`);
  ok("craftLevel present", prof.craftLevel === 1);
  ok("storyChapter + seasonKills present", prof.storyChapter === 0 && prof.seasonKills === 0 && prof.evolvedPets === 0);

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
