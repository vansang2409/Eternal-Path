// Sprint 71: achievement-gated titles (founder/raidlord/...).
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-titles2-test.mjs
import { io } from "socket.io-client";
import { TITLES } from "./shared/dist/titles.js";

const PORT = process.env.PORT || "3207";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

ok("4 achievement-gated titles present", ["raidlord", "petlord", "merchant-prince", "founder"].every((id) => TITLES.some((t) => t.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  let titles = null;
  s.on("system", (m) => sys.push(m));
  s.on("titlesUpdate", (p) => { titles = p; });
  s.emit("login", { email: `t2${sfx}@t.vn`, accountName: `T2${sfx}`, password: "test1234" });
  await once(s, "player");
  await sleep(300);

  // "founder" not earned yet → equip rejected.
  s.emit("setActiveTitle", { titleId: "founder" });
  await sleep(400);
  ok("founder rejected before guild", sys.some((m) => m.includes("chưa mở khoá")));

  // Create a guild → unlocks guild-founder achievement → founder title earned.
  s.emit("devGrant", { gold: 10000 });
  await waitPlayer(s, (p) => p.stats.gold >= 10000);
  s.emit("createGuild", { name: `T2 ${sfx}`, tag: `T${sfx % 100}` });
  await waitPlayer(s, (p) => (p.achievements ?? []).includes("guild-founder"));
  s.emit("requestTitles");
  await sleep(400);
  ok("founder title now earned", titles && titles.earned.includes("founder"));

  // Equip founder title → succeeds.
  s.emit("setActiveTitle", { titleId: "founder" });
  const pf = await waitPlayer(s, (p) => p.activeTitle === "founder");
  ok("founder title equippable after unlock", pf.activeTitle === "founder");

  // raidlord still locked (no raid achievement).
  s.emit("setActiveTitle", { titleId: "raidlord" });
  await sleep(400);
  ok("raidlord still locked", titles && !titles.earned.includes("raidlord"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
