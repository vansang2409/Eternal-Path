// Sprint 82: economy-feature achievements (high-roller, philanthropist, bag-master).
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-ecoachv-test.mjs
import { io } from "socket.io-client";
import { achievementById } from "./shared/dist/achievements.js";
import { BAG_MAX_BONUS } from "./shared/dist/formulas.js";

const PORT = process.env.PORT || "3227";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

ok("3 new achievements defined", ["bag-master", "high-roller", "philanthropist"].every((id) => achievementById(id)));

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const unlocked = [];
  s.on("achievementUnlocked", (a) => unlocked.push(a.id));
  s.emit("login", { email: `eca${sfx}@t.vn`, accountName: `Eca${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 500000, gems: 500 });
  await waitPlayer(s, (p) => p.stats.gold >= 500000);

  // high-roller: open a mystery box.
  s.emit("buyMysteryBox");
  await waitPlayer(s, (p) => (p.achievements ?? []).includes("high-roller"));
  ok("high-roller on mystery box", unlocked.includes("high-roller"));

  // philanthropist: create guild + deposit to bank.
  s.emit("createGuild", { name: `Eco ${sfx}`, tag: `EC${sfx % 10}` });
  await waitPlayer(s, (p) => !!p.guildId);
  s.emit("depositGuildBank", { amount: 1000 });
  await waitPlayer(s, (p) => (p.achievements ?? []).includes("philanthropist"));
  ok("philanthropist on bank deposit", unlocked.includes("philanthropist"));

  // bag-master: buy bag packs until max.
  let safety = 0;
  while (safety++ < 12) {
    s.emit("buyBagSlots");
    const pp = await waitPlayer(s, (p) => (p.bagBonus ?? 0) >= BAG_MAX_BONUS || (p.achievements ?? []).includes("bag-master"), 3000).catch(() => null);
    if (pp && ((pp.bagBonus ?? 0) >= BAG_MAX_BONUS)) break;
    await sleep(60);
  }
  await sleep(300);
  ok("bag-master at max bag", unlocked.includes("bag-master"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
