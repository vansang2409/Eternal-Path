// Sprint 194: demigod + perfectionist titles (predicate tests). DEV_CHEATS=1.
import { io } from "socket.io-client";
import { TITLES, earnedTitles } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const mk = (over) => ({ stats: { gold: 0, level: 1 }, achievements: [], inventory: { equipped: {} }, ...over });

ok("2 new S194 titles present", ["demigod","perfectionist"].every((id) => TITLES.some((t) => t.id === id)));
ok("demigod earned at level 80", earnedTitles(mk({ stats: { gold: 0, level: 80 } })).includes("demigod"));
ok("demigod NOT at level 79", !earnedTitles(mk({ stats: { gold: 0, level: 79 } })).includes("demigod"));
ok("perfectionist earned at +N total 20", earnedTitles(mk({ inventory: { equipped: { weapon: { kind: "equipment", plusLevel: 12 }, armor: { kind: "equipment", plusLevel: 8 } } } })).includes("perfectionist"));
ok("perfectionist NOT below 20", !earnedTitles(mk({ inventory: { equipped: { weapon: { kind: "equipment", plusLevel: 10 } } } })).includes("perfectionist"));

// Light live sanity: server still serves titles list.
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `t194${sfx}@t.vn`, accountName: `T194${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("server serves titles", Array.isArray(tu.earned));
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
