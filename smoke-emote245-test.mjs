// Sprint 245: /roll dice + emotes — broadcast, whitelist, cooldowns. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { EMOTES, getEmote } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("5 emotes whitelisted", EMOTES.length === 5 && Boolean(getEmote("dance")) && !getEmote("hack"));

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect(); const b = await connect();
  const bSys = []; b.on("system", (m) => bSys.push(String(m)));
  const bEmotes = []; b.on("emoteShown", (p) => bEmotes.push(p));
  a.emit("login", { email: `em245a${sfx}@t.vn`, accountName: `EM245A${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `em245b${sfx}@t.vn`, accountName: `EM245B${sfx}`, password: "test1234" });
  await once(b, "player");
  await sleepMs(300);

  // Dice roll is server-rolled and broadcast to everyone.
  a.emit("rollDice");
  await sleepMs(500);
  const rolls = bSys.filter((m) => m.includes("🎲") && m.includes(`EM245A${sfx}`));
  ok("roll broadcast reaches others", rolls.length === 1, rolls[0]);
  const n = Number(rolls[0]?.match(/: (\d+)\/100/)?.[1]);
  ok("roll within 1-100", n >= 1 && n <= 100, `n=${n}`);

  // Cooldown: instant second roll is swallowed.
  a.emit("rollDice");
  await sleepMs(400);
  ok("roll cooldown holds", bSys.filter((m) => m.includes("🎲") && m.includes(`EM245A${sfx}`)).length === 1);

  // Emote broadcast with whitelist.
  a.emit("emote", { emote: "dance" });
  await sleepMs(400);
  ok("emote bubble broadcast", bEmotes.some((e) => e.emote === "dance"));
  a.emit("emote", { emote: "not-real" });
  await sleepMs(300);
  ok("invalid emote ignored", !bEmotes.some((e) => e.emote === "not-real"));

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
