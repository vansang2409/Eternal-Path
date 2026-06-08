// Sprint 62: unit-test earnedTitles + e2e set/reject active title.
// Server must run with DEV_CHEATS=1 + test save paths. Run: node smoke-titles-test.mjs
import { io } from "socket.io-client";
import { earnedTitles, isTitleEarned, titleLabel, TITLES } from "./shared/dist/titles.js";

const PORT = process.env.PORT || "3189";
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

// ── Unit tests on the pure title predicates ──
const base = { stats: { gold: 0, level: 1 }, totalKills: 0 };
ok("novice always earned", earnedTitles(base).includes("novice"));
ok("hunter needs 100 kills", !isTitleEarned("hunter", base) && isTitleEarned("hunter", { ...base, totalKills: 100 }));
ok("tycoon needs 50k gold", !isTitleEarned("tycoon", base) && isTitleEarned("tycoon", { stats: { gold: 50000, level: 1 } }));
ok("master needs level 20", !isTitleEarned("master", base) && isTitleEarned("master", { stats: { gold: 0, level: 20 } }));
ok("guildmate needs guildId", !isTitleEarned("guildmate", base) && isTitleEarned("guildmate", { ...base, guildId: "g1" }));
ok("devoted needs streak 7", !isTitleEarned("devoted", base) && isTitleEarned("devoted", { ...base, loginStreak: 7 }));
ok("collector needs 3 cosmetics", isTitleEarned("collector", { ...base, cosmetics: ["a", "b", "c"] }));
ok("titleLabel resolves", titleLabel("master") === "Cao Thủ" && titleLabel("nope") === undefined);
ok("earnedTitles scales with stats", earnedTitles({ stats: { gold: 99999, level: 40 }, totalKills: 1000, guildId: "g", loginStreak: 7 }).length >= 7);

// ── e2e: earn via devGrant, set + reject unearned ──
const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  let titles = null;
  s.on("system", (m) => sys.push(m));
  s.on("titlesUpdate", (p) => { titles = p; });
  s.emit("login", { email: `ttl${sfx}@t.vn`, accountName: `Ttl${sfx}`, password: "test1234" });
  await once(s, "player");
  await sleep(300);
  ok("titlesUpdate sent on login", titles && Array.isArray(titles.earned) && titles.earned.includes("novice"));

  // Try to set an unearned title (tycoon needs 50k gold; new player has little).
  s.emit("setActiveTitle", { titleId: "tycoon" });
  await sleep(400);
  ok("unearned title rejected", sys.some((m) => m.includes("chưa mở khoá")));

  // Set the always-earned novice title.
  s.emit("setActiveTitle", { titleId: "novice" });
  const p1 = await once(s, "player");
  ok("set earned title applies", p1.activeTitle === "novice", `active=${p1.activeTitle}`);

  // Grant 50k gold → tycoon becomes earned → set it.
  s.emit("devGrant", { gold: 60000 });
  await once(s, "player");
  s.emit("requestTitles");
  await sleep(400);
  ok("tycoon earned after gold grant", titles.earned.includes("tycoon"));
  s.emit("setActiveTitle", { titleId: "tycoon" });
  const p2 = await once(s, "player");
  ok("set tycoon applies", p2.activeTitle === "tycoon");

  // Unequip.
  s.emit("setActiveTitle", { titleId: null });
  const p3 = await once(s, "player");
  ok("unequip clears title", !p3.activeTitle);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
