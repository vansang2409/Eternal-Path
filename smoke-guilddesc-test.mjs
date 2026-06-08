// Sprint 90: guild recruitment description shown in leaderboard.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-guilddesc-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3236";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const leader = await connect();
  const member = await connect();
  const mSys = [];
  let board = [];
  member.on("system", (m) => mSys.push(m));
  member.on("guildLeaderboard", (rows) => { board = rows; });
  leader.emit("login", { email: `gdl${sfx}@t.vn`, accountName: `GdL${sfx}`, password: "test1234" });
  await once(leader, "player");
  member.emit("login", { email: `gdm${sfx}@t.vn`, accountName: `GdM${sfx}`, password: "test1234" });
  await once(member, "player");

  leader.emit("devGrant", { gold: 10000 });
  await waitPlayer(leader, (p) => p.stats.gold >= 10000);
  leader.emit("createGuild", { name: `Recruiters ${sfx}`, tag: `RC${sfx % 10}` });
  await once(leader, "guildUpdate");

  // Member (not in guild) cannot set desc.
  member.emit("setGuildDescription", { desc: "hack" });
  await sleep(300);

  // Leader sets recruitment desc.
  leader.emit("setGuildDescription", { desc: "Tuyển thành viên cày cuốc, vui vẻ!" });
  await sleep(500);

  // Member requests leaderboard → sees the desc on the guild row.
  member.emit("requestGuildLeaderboard");
  await sleep(500);
  const row = board.find((g) => g.name === `Recruiters ${sfx}`);
  ok("guild appears in leaderboard", !!row);
  ok("recruitment desc visible in leaderboard", row && row.desc === "Tuyển thành viên cày cuốc, vui vẻ!", `desc=${row?.desc}`);

  leader.disconnect(); member.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
