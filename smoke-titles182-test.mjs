// Sprint 182: titles for mounts/alchemy/arena. DEV_CHEATS=1.
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

ok("3 new S182 titles present", ["knight-errant","alchemy-master","arena-legend"].every((id) => TITLES.some((t) => t.id === id)));
ok("earnedTitles derives knight-errant", earnedTitles({ stats: { gold: 0, level: 1 }, achievements: ["rider"] }).includes("knight-errant"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `t182${sfx}@t.vn`, accountName: `T182${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("setActiveTitle", { titleId: "knight-errant" });
  await sleep(300);
  ok("title locked before achievement", sys.some((m) => m.includes("chưa mở khoá")));
  s.emit("devGrantAchievement", { id: "rider" });
  await waitPlayer(s, (p) => (p.achievements ?? []).includes("rider"));
  s.emit("setActiveTitle", { titleId: "knight-errant" });
  const pw = await waitPlayer(s, (p) => p.activeTitle === "knight-errant");
  ok("knight-errant equippable after achievement", pw.activeTitle === "knight-errant");
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
