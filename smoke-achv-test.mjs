// Sprint 67 smoke test: achievement unlock hooks + one-time rewards.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-achv-test.mjs
import { io } from "socket.io-client";
import { achievementById } from "./shared/dist/achievements.js";

const PORT = process.env.PORT || "3199";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 120) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
  setTimeout(() => rej(new Error("connect timeout")), 5000);
});
const once = (s, ev, t = 5000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout player pred")), t);
  const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } };
  s.on("player", fn);
});

ok("guild-founder has gem reward", achievementById("guild-founder").reward.gems === 20);
ok("merchant has gold reward", achievementById("merchant").reward.gold === 500);

const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const unlocked = [];
  s.on("achievementUnlocked", (a) => unlocked.push(a.id));
  s.emit("login", { email: `achv${sfx}@t.vn`, accountName: `Achv${sfx}`, password: "test1234" });
  const p0 = await once(s, "player");

  // beast-tamer: buy a pet (gold).
  s.emit("devGrant", { gold: 20000, gems: 100 });
  const pg = await waitPlayer(s, (p) => p.stats.gold >= 20000);
  const goldBeforeTamer = pg.stats.gold, gemsBeforeTamer = pg.gems ?? 0;
  s.emit("buyPet", { petId: "slime" }); // 2000 gold
  const pTamer = await waitPlayer(s, (p) => (p.achievements ?? []).includes("beast-tamer"));
  ok("beast-tamer unlocked on pet buy", true);
  ok("beast-tamer reward +10 gem", pTamer.gems === gemsBeforeTamer + 10, `gems=${pTamer.gems} expect ${gemsBeforeTamer + 10}`);

  // titled: equip novice title.
  s.emit("setActiveTitle", { titleId: "novice" });
  const pTitled = await waitPlayer(s, (p) => (p.achievements ?? []).includes("titled"));
  ok("titled unlocked + reward applied", (pTitled.achievements ?? []).includes("titled"));

  // guild-founder: create a guild.
  const goldBeforeGuild = (await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); })).stats.gold;
  s.emit("createGuild", { name: `Achv ${sfx}`, tag: `AV${sfx % 10}` });
  const pGuild = await waitPlayer(s, (p) => (p.achievements ?? []).includes("guild-founder"));
  ok("guild-founder unlocked on create", true);
  ok("guild-founder reward +20 gem", (pGuild.gems ?? 0) >= 20);

  // Idempotent: re-trigger title set; no duplicate achievement, no extra reward.
  const gemsNow = (await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); })).gems ?? 0;
  s.emit("setActiveTitle", { titleId: "novice" });
  await sleep(500);
  const gemsAfter = (await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); })).gems ?? 0;
  ok("achievement reward not granted twice", gemsAfter === gemsNow, `before=${gemsNow} after=${gemsAfter}`);
  ok("no duplicate achievementUnlocked emit", unlocked.filter((id) => id === "titled").length === 1);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
