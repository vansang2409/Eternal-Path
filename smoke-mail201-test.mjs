// Sprint 201: mailbox — send gold to players, delivered offline. DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const aName = `MailA${sfx}`, bName = `MailB${sfx}`, cName = `MailC${sfx}`;
  const a = await connect();
  const b = await connect();
  a.emit("login", { email: `m${sfx}a@t.vn`, accountName: aName, password: "test1234" });
  b.emit("login", { email: `m${sfx}b@t.vn`, accountName: bName, password: "test1234" });
  const ap = await once(a, "player"); await once(b, "player");
  a.emit("devGrant", { gold: 10000 });
  await waitPlayer(a, (p) => p.stats.gold >= 10000);
  const aGold0 = (await new Promise((r) => { a.emit("devGrant", { gold: 0 }); a.once("player", r); })).stats.gold;

  // Reject: send to self.
  const aSys = []; a.on("system", (m) => aSys.push(m));
  a.emit("sendMail", { to: aName, gold: 100, message: "x" });
  await sleep(300);
  ok("cannot mail self", aSys.some((m) => m.includes("cho chính mình")));

  // A → B online: B gets a mailList push.
  let bMail = null; b.on("mailList", (l) => { bMail = l; });
  a.emit("sendMail", { to: bName, gold: 500, message: "quà nhé" });
  const aAfter = await waitPlayer(a, (p) => p.stats.gold === aGold0 - 500, 4000);
  ok("sender gold deducted", aAfter.stats.gold === aGold0 - 500);
  await sleep(400);
  ok("recipient received mail push", bMail && bMail.some((m) => m.from === aName && m.gold === 500));

  // B claims.
  const bGold0 = (await new Promise((r) => { b.emit("devGrant", { gold: 0 }); b.once("player", r); })).stats.gold;
  const mailId = bMail.find((m) => m.from === aName).id;
  b.emit("claimMail", { mailId });
  const bAfter = await waitPlayer(b, (p) => p.stats.gold === bGold0 + 500, 4000);
  ok("recipient claimed gold", bAfter.stats.gold === bGold0 + 500);
  await sleep(300);
  ok("mail removed after claim", bMail && !bMail.some((m) => m.id === mailId));

  // OFFLINE delivery: A → C (not connected). Then C logs in & claims.
  a.emit("sendMail", { to: cName, gold: 777, message: "offline gift" });
  await sleep(400);
  const c = await connect();
  const cSys = []; c.on("system", (m) => cSys.push(m));
  let cMail = null; c.on("mailList", (l) => { cMail = l; });
  c.emit("login", { email: `m${sfx}c@t.vn`, accountName: cName, password: "test1234" });
  await once(c, "player");
  await sleep(300);
  ok("offline recipient notified on login", cSys.some((m) => m.includes("thư trong Hòm Thư")));
  c.emit("requestMail");
  await sleep(300);
  ok("offline mail waiting", cMail && cMail.some((m) => m.from === aName && m.gold === 777));
  const cGold0 = (await new Promise((r) => { c.emit("devGrant", { gold: 0 }); c.once("player", r); })).stats.gold;
  c.emit("claimMail", { mailId: cMail.find((m) => m.from === aName).id });
  const cAfter = await waitPlayer(c, (p) => p.stats.gold === cGold0 + 777, 4000);
  ok("offline recipient claimed", cAfter.stats.gold === cGold0 + 777);

  a.disconnect(); b.disconnect(); c.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
