// Sprint 88: server-wide announcement when a guild defeats its raid boss.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-raidannounce-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3234";
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
  const outsider = await connect(); // NOT in the guild
  const oSys = [];
  outsider.on("system", (m) => oSys.push(m));
  leader.emit("login", { email: `ral${sfx}@t.vn`, accountName: `RaL${sfx}`, password: "test1234" });
  await once(leader, "player");
  outsider.emit("login", { email: `rao${sfx}@t.vn`, accountName: `RaO${sfx}`, password: "test1234" });
  await once(outsider, "player");

  leader.emit("devGrant", { gold: 10000 });
  await waitPlayer(leader, (p) => p.stats.gold >= 10000);
  leader.emit("createGuild", { name: `Announcers ${sfx}`, tag: `AN${sfx % 10}` });
  await once(leader, "guildUpdate");
  leader.emit("depositGuildBank", { amount: 5000 });
  await waitPlayer(leader, (p) => p.stats.gold <= 5000);

  // One-shot weapon to defeat the raid quickly.
  leader.emit("devGrantItem", { name: "RaidOneShot", slot: "weapon", stats: { attack: 99999 }, value: 1 });
  const lp = await waitPlayer(leader, (p) => p.inventory.items.some((i) => i.name === "RaidOneShot"));
  leader.emit("equipItem", { itemId: lp.inventory.items.find((i) => i.name === "RaidOneShot").id });
  await waitPlayer(leader, (p) => p.stats.attack >= 99999);

  leader.emit("summonGuildRaid");
  await sleep(600);
  leader.emit("raidAttack");
  await sleep(800);

  ok("outsider received server-wide raid defeat announce", oSys.some((m) => m.includes("vừa hạ gục") && m.includes(`Announcers ${sfx}`)), oSys.slice(-2).join(" | "));

  leader.disconnect(); outsider.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
