// Sprint 208: social/economy titles. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { TITLES, earnedTitles } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const mk = (o) => ({ stats: { gold: 0, level: 1 }, achievements: [], inventory: { equipped: {} }, ...o });
ok("3 new titles present", ["courier","bargain-hunter","mogul"].every((id) => TITLES.some((t) => t.id === id)));
ok("courier via pen-pal", earnedTitles(mk({ achievements: ["pen-pal"] })).includes("courier"));
ok("bargain-hunter via lastDealDay", earnedTitles(mk({ lastDealDay: 5 })).includes("bargain-hunter"));
ok("mogul at 1M gold", earnedTitles(mk({ stats: { gold: 1000000, level: 1 } })).includes("mogul"));
ok("mogul NOT at 999k", !earnedTitles(mk({ stats: { gold: 999000, level: 1 } })).includes("mogul"));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `t208${sfx}@t.vn`, accountName: `T208${sfx}`, password: "test1234" });
  await once(s, "player"); s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("server serves titles", Array.isArray(tu.earned));
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
