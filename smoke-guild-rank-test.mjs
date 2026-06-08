// Sprint 60 smoke test: global guild leaderboard ordering + fields.
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-guild-rank-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3185";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 140) : ""}`);
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

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  let aRank = [];
  a.on("guildLeaderboard", (rows) => { aRank = rows; });

  a.emit("login", { email: `gra${sfx}@t.vn`, accountName: `GRankA${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `grb${sfx}@t.vn`, accountName: `GRankB${sfx}`, password: "test1234" });
  await once(b, "player");

  // Both create guilds; A donates more so it ranks higher.
  a.emit("devGrant", { gold: 60000 });
  await waitPlayer(a, (p) => p.stats.gold >= 60000);
  b.emit("devGrant", { gold: 60000 });
  await waitPlayer(b, (p) => p.stats.gold >= 60000);

  a.emit("createGuild", { name: `Alpha ${sfx}`, tag: `AA${sfx % 10}` });
  await once(a, "guildUpdate");
  b.emit("createGuild", { name: `Beta ${sfx}`, tag: `BB${sfx % 10}` });
  await once(b, "guildUpdate");

  // A donates 25000 → level 3; B donates 10000 → level 2.
  a.emit("donateGuild", { amount: 25000 });
  await sleep(600);
  b.emit("donateGuild", { amount: 10000 });
  await sleep(600);

  a.emit("requestGuildLeaderboard");
  await sleep(500);
  ok("leaderboard populated", aRank.length >= 2, `n=${aRank.length}`);
  const ai = aRank.findIndex((r) => r.name === `Alpha ${sfx}`);
  const bi = aRank.findIndex((r) => r.name === `Beta ${sfx}`);
  ok("higher-exp guild ranks above", ai >= 0 && bi >= 0 && ai < bi, `alpha#${ai} beta#${bi}`);
  ok("rank numbers sequential from 1", aRank[0].rank === 1 && aRank[1].rank === 2);
  const alpha = aRank[ai];
  ok("row fields correct", alpha.level === 3 && alpha.exp === 25000 && alpha.memberCount === 1, `lvl=${alpha.level} exp=${alpha.exp} mc=${alpha.memberCount}`);
  ok("viewer's own guild flagged mine", alpha.mine === true);
  ok("other guild not flagged mine", aRank[bi].mine === false);

  // Sorted by level desc then exp desc (Alpha L3 before Beta L2).
  ok("sorted by level desc", aRank[0].level >= aRank[1].level);

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
