// Sprint 57 smoke test: guild progression (donate, level-up, perks, boost).
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-guild57-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3179";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 120) : ""}`);
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

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  const sys = { a: [], b: [] };
  const views = { a: [], b: [] };
  a.on("system", (m) => sys.a.push(m));
  b.on("system", (m) => sys.b.push(m));
  a.on("guildUpdate", (v) => v && views.a.push(v));
  b.on("guildUpdate", (v) => v && views.b.push(v));
  const lastA = () => views.a.at(-1);

  a.emit("login", { email: `g57a${sfx}@t.vn`, accountName: `G57A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `g57b${sfx}@t.vn`, accountName: `G57B${sfx}`, password: "test1234" });
  await once(b, "player");

  a.emit("devGrant", { gold: 30000, gems: 500 });
  await once(a, "player");
  a.emit("createGuild", { name: `Tien Hoa ${sfx}`, tag: "gp7" });
  await once(a, "guildUpdate");
  ok("guild starts L1", lastA()?.level === 1 && lastA()?.expBonus === 0 && lastA()?.maxMembers === 20);

  // Donate below min rejected.
  a.emit("donateGuild", { amount: 50 });
  await sleep(400);
  ok("donate below min rejected", sys.a.some((m) => m.includes("tối thiểu")));

  // Donate 5000 → exp 5000, still L1, contribution tracked.
  a.emit("donateGuild", { amount: 5000 });
  await once(a, "guildUpdate");
  await sleep(200);
  const v1 = lastA();
  ok("donate adds exp + contribution", v1?.exp === 5000 && v1?.level === 1 &&
    v1?.members.find((m) => m.accountName === `G57A${sfx}`)?.contribution === 5000, `exp=${v1?.exp}`);

  // Donate another 5000 → exp 10000 → level 2.
  a.emit("donateGuild", { amount: 5000 });
  await sleep(600);
  const v2 = lastA();
  ok("level up to L2", v2?.level === 2 && v2?.expBonus === 0.02 && v2?.goldBonus === 0.02, `lvl=${v2?.level} bonus=${v2?.expBonus}`);
  ok("L2 member slot grows", v2?.maxMembers === 21, `max=${v2?.maxMembers}`);
  ok("level-up announced", sys.a.some((m) => m.includes("đạt cấp 2")));

  // Invite + accept B.
  const invP = once(b, "guildInvite");
  a.emit("guildInvitePlayer", { name: `G57B${sfx}` });
  const inv = await invP;
  b.emit("acceptGuildInvite", { guildId: inv.guildId });
  await once(b, "guildUpdate");
  ok("B joined", views.b.at(-1)?.members.length === 2);

  // Member B cannot buy boost.
  b.emit("buyGuildBoost");
  await sleep(400);
  ok("member cannot buy boost", sys.b.some((m) => m.includes("Hội Trưởng hoặc Sĩ Quan")));

  // Leader A buys boost.
  a.emit("buyGuildBoost");
  await sleep(600);
  const v3 = lastA();
  ok("boost active after purchase", v3?.boostActive === true && v3?.boostUntil > Date.now(), `active=${v3?.boostActive}`);
  const pa = await new Promise((res) => { a.emit("devGrant", { gold: 0 }); a.once("player", res); });
  // 500 granted + 20 (guild-founder achievement, Sprint 67) − 200 (boost) = 320.
  ok("gems deducted ~200", pa.gems === 320, `gems=${pa.gems}`);

  // Buying boost again rejected (already active).
  a.emit("buyGuildBoost");
  await sleep(400);
  ok("double boost rejected", sys.a.some((m) => m.includes("đang còn hiệu lực")));

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
