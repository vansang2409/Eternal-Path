// Sprint 164: new milestone & gear-loop titles. DEV_CHEATS=1.
// Run: node smoke-titles164-test.mjs
import { io } from "socket.io-client";
import { TITLES, earnedTitles } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

ok("4 new S164 titles present", ["wealthlord", "ascended", "forgemaster", "apexlord"].every((id) => TITLES.some((t) => t.id === id)));
ok("earnedTitles derives wealthlord by gold", earnedTitles({ stats: { gold: 200000, level: 1 }, achievements: [] }).includes("wealthlord"));
ok("earnedTitles derives forgemaster by achievement", earnedTitles({ stats: { gold: 0, level: 1 }, achievements: ["enhancer"] }).includes("forgemaster"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `t164${sfx}@t.vn`, accountName: `T164${sfx}`, password: "test1234" });
  await once(s, "player");

  // wealthlord locked before gold.
  s.emit("setActiveTitle", { titleId: "wealthlord" });
  await sleep(300);
  ok("wealthlord locked before gold", sys.some((m) => m.includes("chưa mở khoá")));

  // Grant 200k gold → earned + equippable.
  s.emit("devGrant", { gold: 200000 });
  await waitPlayer(s, (p) => p.stats.gold >= 200000);
  s.emit("requestTitles");
  const tu = await once(s, "titlesUpdate");
  ok("wealthlord earned after 200k gold", tu.earned.includes("wealthlord"));
  s.emit("setActiveTitle", { titleId: "wealthlord" });
  const pw = await waitPlayer(s, (p) => p.activeTitle === "wealthlord");
  ok("wealthlord equippable", pw.activeTitle === "wealthlord");

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
