// Sprint 72: guild bank deposit/withdraw + leader-only withdraw.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-guildbank-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3209";
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
  const lSys = [], mSys = [];
  let lView = null;
  leader.on("system", (m) => lSys.push(m));
  member.on("system", (m) => mSys.push(m));
  leader.on("guildUpdate", (v) => { if (v) lView = v; });

  leader.emit("login", { email: `gbl${sfx}@t.vn`, accountName: `GBL${sfx}`, password: "test1234" });
  await once(leader, "player");
  member.emit("login", { email: `gbm${sfx}@t.vn`, accountName: `GBM${sfx}`, password: "test1234" });
  await once(member, "player");

  leader.emit("devGrant", { gold: 20000 });
  await waitPlayer(leader, (p) => p.stats.gold >= 20000);
  member.emit("devGrant", { gold: 20000 });
  await waitPlayer(member, (p) => p.stats.gold >= 20000);
  leader.emit("createGuild", { name: `Bank ${sfx}`, tag: `BK${sfx % 10}` });
  await once(leader, "guildUpdate");
  const invP = once(member, "guildInvite");
  leader.emit("guildInvitePlayer", { name: `GBM${sfx}` });
  const inv = await invP;
  member.emit("acceptGuildInvite", { guildId: inv.guildId });
  await once(member, "guildUpdate");

  // Member deposits 5000 → gold down, bank up.
  const mBefore = (await new Promise((res) => { member.emit("devGrant", { gold: 0 }); member.once("player", res); })).stats.gold;
  member.emit("depositGuildBank", { amount: 5000 });
  const mAfter = await waitPlayer(member, (p) => p.stats.gold === mBefore - 5000);
  ok("deposit deducts member gold", mAfter.stats.gold === mBefore - 5000, `gold=${mAfter.stats.gold}`);
  await sleep(300);
  ok("bank balance reflects deposit", lView && lView.bank === 5000, `bank=${lView?.bank}`);

  // Deposit below min rejected.
  member.emit("depositGuildBank", { amount: 50 });
  await sleep(400);
  ok("deposit below min rejected", mSys.some((m) => m.includes("tối thiểu")));

  // Member cannot withdraw (leader-only).
  member.emit("withdrawGuildBank", { amount: 1000 });
  await sleep(400);
  ok("member cannot withdraw", mSys.some((m) => m.includes("Chỉ Hội Trưởng")));

  // Leader withdraws 3000 → bank down, gold up.
  const lBefore = (await new Promise((res) => { leader.emit("devGrant", { gold: 0 }); leader.once("player", res); })).stats.gold;
  leader.emit("withdrawGuildBank", { amount: 3000 });
  const lAfter = await waitPlayer(leader, (p) => p.stats.gold === lBefore + 3000);
  ok("leader withdraw adds gold", lAfter.stats.gold === lBefore + 3000, `gold=${lAfter.stats.gold}`);
  await sleep(300);
  ok("bank balance reflects withdraw", lView && lView.bank === 2000, `bank=${lView?.bank}`);

  // Over-withdraw rejected.
  leader.emit("withdrawGuildBank", { amount: 999999 });
  await sleep(400);
  ok("over-withdraw rejected", lSys.some((m) => m.includes("Quỹ không đủ")));

  leader.disconnect(); member.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
