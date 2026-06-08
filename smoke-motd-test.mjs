// Sprint 89: guild MOTD shown to member on login.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-motd-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3235";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const email = `motd${sfx}@t.vn`, name = `Motd${sfx}`;
  const s = await connect();
  s.emit("login", { email, accountName: name, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 10000 });
  await waitPlayer(s, (p) => p.stats.gold >= 10000);
  s.emit("createGuild", { name: `MotdG ${sfx}`, tag: `MO${sfx % 10}` });
  await once(s, "guildUpdate");
  s.emit("setGuildMotd", { motd: "Tối nay 8h đánh boss!" });
  await sleep(400);
  s.disconnect();
  await sleep(400);

  // Relogin → should receive the MOTD as a system message.
  const s2 = await connect();
  const sys = [];
  s2.on("system", (m) => sys.push(m));
  s2.emit("login", { email, accountName: name, password: "test1234" });
  await once(s2, "player");
  await sleep(500);
  ok("MOTD shown on login", sys.some((m) => m.includes("Tối nay 8h đánh boss") && m.includes("📜")), sys.find((m) => m.includes("📜")) ?? "(none)");
  s2.disconnect();

  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
