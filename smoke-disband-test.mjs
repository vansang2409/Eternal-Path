// Sprint 74: disband guild (leader-only) clears all members + removes guild.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-disband-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3213";
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
  let mGuild = "x"; // sentinel
  member.on("system", (m) => mSys.push(m));
  member.on("guildUpdate", (v) => { mGuild = v; });

  leader.emit("login", { email: `dbl${sfx}@t.vn`, accountName: `DBL${sfx}`, password: "test1234" });
  await once(leader, "player");
  member.emit("login", { email: `dbm${sfx}@t.vn`, accountName: `DBM${sfx}`, password: "test1234" });
  await once(member, "player");

  leader.emit("devGrant", { gold: 10000 });
  await waitPlayer(leader, (p) => p.stats.gold >= 10000);
  leader.emit("createGuild", { name: `Disb ${sfx}`, tag: `DB${sfx % 10}` });
  await once(leader, "guildUpdate");
  const invP = once(member, "guildInvite");
  leader.emit("guildInvitePlayer", { name: `DBM${sfx}` });
  const inv = await invP;
  member.emit("acceptGuildInvite", { guildId: inv.guildId });
  await waitPlayer(member, (p) => !!p.guildId);
  ok("member joined guild", true);

  // Member (not leader) cannot disband.
  member.emit("disbandGuild");
  await sleep(400);
  ok("member cannot disband", mSys.some((m) => m.includes("Chỉ Hội Trưởng mới được giải tán")));

  // Leader disbands → member's guildId cleared + guildUpdate null + notified.
  leader.emit("disbandGuild");
  const mp = await waitPlayer(member, (p) => !p.guildId, 4000).catch(() => null);
  ok("member guildId cleared on disband", !!mp && !mp.guildId);
  await sleep(300);
  ok("member got guildUpdate null", mGuild === null);
  ok("member notified of disband", mSys.some((m) => m.includes("đã bị Hội Trưởng giải tán") || m.includes("đã giải tán")));

  // Leader also cleared.
  const lp = await new Promise((res) => { leader.emit("devGrant", { gold: 0 }); leader.once("player", res); });
  ok("leader guildId cleared", !lp.guildId);

  // Both can now create new guilds (proves old guild fully removed).
  leader.emit("devGrant", { gold: 10000 });
  await waitPlayer(leader, (p) => p.stats.gold >= 5000);
  leader.emit("createGuild", { name: `Fresh ${sfx}`, tag: `FR${sfx % 10}` });
  const fresh = await waitPlayer(leader, (p) => !!p.guildId, 4000).catch(() => null);
  ok("can create new guild after disband", !!fresh && !!fresh.guildId);

  leader.disconnect(); member.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
