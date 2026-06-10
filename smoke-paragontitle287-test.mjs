// Sprint 287: paragon titles. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { TITLES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("2 paragon titles in catalog", ["canh-gioi-gia", "vo-thuong-canh-gioi"].every((id) => TITLES.some((t) => t.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `pt287${sfx}@t.vn`, accountName: `PT287${sfx}`, password: "test1234" });
  await once(s, "player");

  s.emit("devGrant", { paragonPoints: 1 });
  await until((p) => (p.paragonPoints ?? 0) === 1);
  s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("canh-gioi-gia earned at 1 point", tu.earned.includes("canh-gioi-gia"));
  ok("max title not yet", !tu.earned.includes("vo-thuong-canh-gioi"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
