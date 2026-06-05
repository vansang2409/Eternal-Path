// Sprint 56 smoke test: guild create/invite/accept/chat/promote/kick/leave.
// Server must run with DEV_CHEATS=1 and test save paths. Run: node smoke-guild-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3177";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 120) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  const s = io(URL, { transports: ["websocket"] });
  return new Promise((resolve, reject) => {
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 5000);
  });
}

function once(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), timeoutMs);
    socket.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });
}

const run = async () => {
  const suffix = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  const sys = { a: [], b: [] };
  const guildViews = { a: [], b: [] };
  a.on("system", (m) => sys.a.push(m));
  b.on("system", (m) => sys.b.push(m));
  a.on("guildUpdate", (v) => guildViews.a.push(v));
  b.on("guildUpdate", (v) => guildViews.b.push(v));

  a.emit("login", { email: `gta${suffix}@t.vn`, accountName: `GTestA${suffix}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `gtb${suffix}@t.vn`, accountName: `GTestB${suffix}`, password: "test1234" });
  await once(b, "player");
  ok("login both", true);

  // Validation: poor player can't create.
  a.emit("createGuild", { name: `Linh Vuc ${suffix}`, tag: "LV" });
  await sleep(500);
  ok("create blocked when poor", sys.a.some((m) => m.includes("vàng")));

  // Grant gold, create for real.
  a.emit("devGrant", { gold: 10000 });
  await once(a, "player");
  a.emit("createGuild", { name: `Linh Vuc ${suffix}`, tag: "lv9" });
  const view1 = await once(a, "guildUpdate");
  ok("guild created", view1?.tag === "LV9" && view1.members.length === 1 && view1.members[0].rank === "leader", JSON.stringify(view1?.members));

  // Duplicate tag rejected.
  b.emit("devGrant", { gold: 10000 });
  await once(b, "player");
  b.emit("createGuild", { name: `Khac ${suffix}`, tag: "LV9" });
  await sleep(500);
  ok("duplicate tag rejected", sys.b.some((m) => m.includes("đã tồn tại")));

  // Invite + accept.
  const invitePromise = once(b, "guildInvite");
  a.emit("guildInvitePlayer", { name: `GTestB${suffix}` });
  const invite = await invitePromise;
  ok("invite received", invite?.tag === "LV9" && invite.from === `GTestA${suffix}`);
  b.emit("acceptGuildInvite", { guildId: invite.guildId });
  const viewB = await once(b, "guildUpdate");
  ok("accept joins", viewB?.members.length === 2);

  // Guild chat reaches both.
  const chatA = once(a, "guildChatMessage");
  const chatB = once(b, "guildChatMessage");
  b.emit("guildChat", { message: "xin chào guild" });
  const [ca, cb] = await Promise.all([chatA, chatB]);
  ok("guild chat broadcast", ca.message === "xin chào guild" && cb.tag === "LV9");

  // Promote B to officer (leader only).
  a.emit("promoteGuildMember", { accountName: `GTestB${suffix}` });
  await sleep(500);
  const lastA = guildViews.a.at(-1);
  ok("promote to officer", lastA?.members.find((m) => m.accountName === `GTestB${suffix}`)?.rank === "officer");

  // Officer B cannot kick leader A.
  b.emit("kickGuildMember", { accountName: `GTestA${suffix}` });
  await sleep(500);
  ok("officer cannot kick leader", sys.b.some((m) => m.includes("không có quyền")));

  // MOTD by officer.
  b.emit("setGuildMotd", { motd: "Tối nay đánh boss!" });
  await sleep(500);
  ok("motd updated", guildViews.b.at(-1)?.motd === "Tối nay đánh boss!");

  // Leader kicks B.
  a.emit("kickGuildMember", { accountName: `GTestB${suffix}` });
  const nullView = await once(b, "guildUpdate");
  await sleep(300);
  ok("kick removes member", nullView === null && guildViews.a.at(-1)?.members.length === 1);

  // Leader leaves → guild disbands (announced globally).
  a.emit("leaveGuild");
  await sleep(500);
  ok("disband on last leave", sys.a.some((m) => m.includes("giải tán")));

  // Tag visible in snapshot for guild members: create again and check snapshot.
  a.emit("createGuild", { name: `Tag Check ${suffix}`, tag: "TC" });
  await once(a, "guildUpdate");
  const snap = await once(a, "snapshot");
  const selfInSnap = snap.players.find((p) => p.accountName === `GTestA${suffix}`);
  ok("guildTag in snapshot", selfInSnap?.guildTag === "TC");

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? "ALL PASS (13 checks)" : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
