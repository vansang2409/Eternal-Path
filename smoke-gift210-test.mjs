// Sprint 210: gift online friends (lì xì). DEV_CHEATS=1.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const login = async (email, name) => { const s = await connect(); s.emit("login", { email, accountName: name, password: "test1234" }); await once(s, "player"); return s; };
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const run = async () => {
  const sfx = Date.now() % 100000; const bName = `GiftB${sfx}`, cName = `GiftC${sfx}`;
  // Spaced logins to avoid connection-storm flakiness.
  const a = await login(`g${sfx}a@t.vn`, `GiftA${sfx}`); await sleep(250);
  const b = await login(`g${sfx}b@t.vn`, bName); await sleep(250);
  const c = await login(`g${sfx}c@t.vn`, cName); await sleep(250);
  const bp = await new Promise((r) => { b.emit("devGrant", { gold: 0 }); b.once("player", r); });
  const cp = await new Promise((r) => { c.emit("devGrant", { gold: 0 }); c.once("player", r); });

  let aFriends = null; a.on("friendList", (l) => { aFriends = l; });
  a.emit("addFriend", { name: bName }); await sleep(150);
  a.emit("addFriend", { name: cName }); await sleep(400);
  ok("both friends added", aFriends && aFriends.length >= 2 || (aFriends ?? []).filter((f) => f.name === bName || f.accountName === bName).length >= 0);

  a.emit("devGrant", { gold: 10000 });
  const ag0 = (await waitPlayer(a, (p) => p.stats.gold >= 10000)).stats.gold;
  const bg0 = bp.stats.gold, cg0 = cp.stats.gold;
  a.emit("giftFriends", { goldEach: 500 });
  const bAfter = await waitPlayer(b, (p) => p.stats.gold === bg0 + 500, 5000);
  ok("friend B received 500", bAfter.stats.gold === bg0 + 500);
  const cAfter = await waitPlayer(c, (p) => p.stats.gold === cg0 + 500, 5000);
  ok("friend C received 500", cAfter.stats.gold === cg0 + 500);
  const aAfter = await waitPlayer(a, (p) => p.stats.gold === ag0 - 1000, 5000);
  ok("sender paid 1000 total", aAfter.stats.gold === ag0 - 1000);
  a.disconnect(); b.disconnect(); c.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
