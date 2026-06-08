// Sprint 66 smoke test: guild raid summon/attack/defeat/rewards + perms.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-raid-test.mjs
import { io } from "socket.io-client";
import { guildRaidMaxHp } from "./shared/dist/guild.js";

const PORT = process.env.PORT || "3197";
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

ok("raid maxHp scales with level", guildRaidMaxHp(1) === 30000 && guildRaidMaxHp(3) === 60000);

const run = async () => {
  const sfx = Date.now() % 100000;
  const leader = await connect();
  const member = await connect();
  const lSys = [], mSys = [];
  let lRaid = null, mRaid = null;
  leader.on("system", (m) => lSys.push(m));
  member.on("system", (m) => mSys.push(m));
  leader.on("guildRaidUpdate", (v) => { lRaid = v; });
  member.on("guildRaidUpdate", (v) => { mRaid = v; });

  leader.emit("login", { email: `rl${sfx}@t.vn`, accountName: `RaidL${sfx}`, password: "test1234" });
  await once(leader, "player");
  member.emit("login", { email: `rm${sfx}@t.vn`, accountName: `RaidM${sfx}`, password: "test1234" });
  await once(member, "player");

  // Leader creates guild, member joins.
  leader.emit("devGrant", { gold: 10000 });
  await waitPlayer(leader, (p) => p.stats.gold >= 10000);
  leader.emit("createGuild", { name: `Raiders ${sfx}`, tag: `RD${sfx % 10}` });
  await once(leader, "guildUpdate");
  const invP = once(member, "guildInvite");
  leader.emit("guildInvitePlayer", { name: `RaidM${sfx}` });
  const inv = await invP;
  member.emit("acceptGuildInvite", { guildId: inv.guildId });
  await once(member, "guildUpdate");

  // Summon needs 2000 gold in the guild bank (Sprint 73) — empty bank rejects.
  leader.emit("summonGuildRaid");
  await sleep(400);
  ok("summon rejected when bank empty", lSys.some((m) => m.includes("Quỹ Guild để triệu hồi")));

  // Fund the guild bank.
  leader.emit("depositGuildBank", { amount: 5000 });
  await waitPlayer(leader, (p) => p.stats.gold <= 5000);

  // Member (rank member) cannot summon.
  member.emit("summonGuildRaid");
  await sleep(400);
  ok("member cannot summon", mSys.some((m) => m.includes("Hội Trưởng hoặc Sĩ Quan")));

  // Leader summons → both see the raid.
  leader.emit("summonGuildRaid");
  await sleep(500);
  ok("raid visible to leader", lRaid && lRaid.hp === lRaid.maxHp && lRaid.maxHp === 30000, `hp=${lRaid?.hp}`);
  ok("raid broadcast to member too", mRaid && mRaid.maxHp === 30000);

  // Cannot summon twice.
  leader.emit("summonGuildRaid");
  await sleep(300);
  ok("double summon rejected", lSys.some((m) => m.includes("đang xuất hiện rồi")));

  // Give both huge attack so a couple hits defeat the boss (test reward path).
  leader.emit("devGrantItem", { name: "OneShot", slot: "weapon", stats: { attack: 20000 }, value: 1 });
  const lp = await waitPlayer(leader, (p) => p.inventory.items.some((i) => i.name === "OneShot"));
  leader.emit("equipItem", { itemId: lp.inventory.items.find((i) => i.name === "OneShot").id });
  await waitPlayer(leader, (p) => p.stats.attack >= 20000);
  member.emit("devGrantItem", { name: "OneShot2", slot: "weapon", stats: { attack: 8000 }, value: 1 });
  const mp = await waitPlayer(member, (p) => p.inventory.items.some((i) => i.name === "OneShot2"));
  member.emit("equipItem", { itemId: mp.inventory.items.find((i) => i.name === "OneShot2").id });
  await waitPlayer(member, (p) => p.stats.attack >= 8000);

  const lGoldBefore = (await new Promise((res) => { leader.emit("devGrant", { gold: 0 }); leader.once("player", res); })).stats.gold;
  const lGemsBefore = (await new Promise((res) => { leader.emit("devGrant", { gold: 0 }); leader.once("player", res); })).gems ?? 0;

  // Member hits once (registers contribution), then leader finishes it.
  member.emit("raidAttack");
  await sleep(300);
  ok("attack reduces hp + records contributor", lRaid && lRaid.hp < lRaid.maxHp && lRaid.contributors.some((c) => c.accountName === `RaidM${sfx}`), `hp=${lRaid?.hp}`);

  // Leader attacks repeatedly (respect 1s cooldown) until defeated.
  let defeated = false;
  for (let i = 0; i < 6 && !defeated; i++) {
    leader.emit("raidAttack");
    await sleep(1100);
    if (lRaid === null || (lRaid && lRaid.hp <= 0)) defeated = true;
  }
  await sleep(400);
  ok("boss defeated (raid cleared)", lRaid === null, `raid=${JSON.stringify(lRaid)}`);
  ok("leader got gold reward", lSys.some((m) => m.includes("Hạ") && m.includes("vàng")));
  ok("top contributor gem bonus", lSys.some((m) => m.includes("nhiều sát thương nhất")));
  ok("guild defeat announced", lSys.some((m) => m.includes("đã hạ")));

  // Re-summon blocked by cooldown.
  leader.emit("summonGuildRaid");
  await sleep(400);
  ok("re-summon on cooldown", lSys.some((m) => m.includes("phút nữa")));

  leader.disconnect(); member.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
