// Sprint 212: elite affixes. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ELITE_AFFIXES, getAffix } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
ok("4+ affixes defined", ELITE_AFFIXES.length >= 4);
ok("getAffix(fiery) = +40% atk", getAffix("fiery").atkMult === 1.4);
const validIds = new Set(ELITE_AFFIXES.map((a) => a.id));
const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `af${sfx}@t.vn`, accountName: `AF${sfx}`, password: "test1234" });
  const init = await once(s, "init");
  const mons = init.snapshot?.monsters ?? [];
  const elites = mons.filter((m) => m.elite && !m.boss);
  ok("world has elite monsters", elites.length > 0, `elites=${elites.length}`);
  ok("every elite has a valid affix", elites.every((m) => validIds.has(m.affix)), `sample=${elites[0]?.affix}`);
  ok("non-elite monsters have no affix", mons.filter((m) => !m.elite && !m.boss).every((m) => !m.affix));
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
