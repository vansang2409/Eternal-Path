// Sprint 301: AOI snapshots — far players invisible, near visible, party
// always visible, monsters radius-bounded. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { AOI_RADIUS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect(); const b = await connect();
  let aSnap = null; a.on("snapshot", (s2) => { aSnap = s2; });
  const untilSnap = async (pred, t = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (aSnap && pred(aSnap)) return aSnap; await sleepMs(120); } throw new Error("untilSnap timeout"); };

  a.emit("login", { email: `ao301a${sfx}@t.vn`, accountName: `AO301A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `ao301b${sfx}@t.vn`, accountName: `AO301B${sfx}`, password: "test1234" });
  await once(b, "player");

  // Place A at (400,400), B far away (5500,4300) — well beyond AOI_RADIUS.
  a.emit("devTeleport", { x: 400, y: 400 });
  b.emit("devTeleport", { x: 5500, y: 4300 });
  await sleepMs(600);
  const s1 = await untilSnap((s2) => s2.players.some((p) => p.accountName === `AO301A${sfx}` && Math.abs(p.position.x - 400) < 50));
  ok("far player NOT in snapshot", !s1.players.some((p) => p.accountName === `AO301B${sfx}`));
  ok("self always in snapshot", s1.players.some((p) => p.accountName === `AO301A${sfx}`));
  const me = s1.players.find((p) => p.accountName === `AO301A${sfx}`);
  ok("all monsters within AOI radius", s1.monsters.every((m) => dist(m.position, me.position) <= AOI_RADIUS + 1), `n=${s1.monsters.length}`);
  ok("snapshot is a real subset", s1.monsters.length > 0 && s1.monsters.length < 200);

  // B teleports next to A → appears in A's snapshot.
  b.emit("devTeleport", { x: 700, y: 400 });
  await untilSnap((s2) => s2.players.some((p) => p.accountName === `AO301B${sfx}`));
  ok("near player appears", true);

  // Party: A invites B (they are near), B accepts, B teleports far — A still sees B.
  const bId = aSnap.players.find((p) => p.accountName === `AO301B${sfx}`).id;
  const invitePromise = once(b, "partyInvite", 5000);
  a.emit("inviteParty", { playerId: bId });
  const invite = await invitePromise;
  b.emit("acceptParty", { partyId: invite.partyId });
  await sleepMs(500);
  b.emit("devTeleport", { x: 5500, y: 4300 });
  await sleepMs(800);
  const s3 = await untilSnap((s2) => s2.players.some((p) => p.accountName === `AO301B${sfx}` && p.position.x > 4000));
  ok("party member visible beyond AOI", Boolean(s3));

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
