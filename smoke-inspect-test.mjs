// Sprint 75: /inspect player profile (public fields, online-only).
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-inspect-test.mjs
import { io } from "socket.io-client";

const PORT = process.env.PORT || "3215";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  const sfx = Date.now() % 100000;
  const a = await connect();
  const b = await connect();
  a.emit("login", { email: `insa${sfx}@t.vn`, accountName: `InsA${sfx}`, password: "test1234" });
  await once(a, "player");
  b.emit("login", { email: `insb${sfx}@t.vn`, accountName: `InsB${sfx}`, password: "test1234" });
  await once(b, "player");

  // Inspect unknown/offline → null + system message.
  const nullP = once(a, "playerProfile");
  a.emit("inspectPlayer", { name: "NobodyHere999" });
  const np = await nullP;
  ok("inspect offline returns null", np === null);

  // Give B a guild + pet + title so the profile has rich fields.
  b.emit("devGrant", { gold: 20000, gems: 200 });
  await waitPlayer(b, (p) => p.stats.gold >= 20000);
  b.emit("createGuild", { name: `InsGuild ${sfx}`, tag: `IG${sfx % 10}` });
  await waitPlayer(b, (p) => !!p.guildId);
  b.emit("buyPet", { petId: "slime" });
  await waitPlayer(b, (p) => (p.ownedPets ?? []).includes("slime"));
  b.emit("equipPet", { petId: "slime" });
  await waitPlayer(b, (p) => p.activePet === "slime");
  b.emit("setActiveTitle", { titleId: "novice" });
  await waitPlayer(b, (p) => p.activeTitle === "novice");

  // A inspects B.
  const profP = once(a, "playerProfile");
  a.emit("inspectPlayer", { name: `InsB${sfx}` });
  const prof = await profP;
  ok("profile returned for online player", prof && prof.accountName === `InsB${sfx}`);
  ok("profile has level", prof.level >= 1);
  ok("profile shows guild tag", typeof prof.guildTag === "string" && prof.guildTag.startsWith("IG"));
  ok("profile shows guild name", prof.guildName === `InsGuild ${sfx}`);
  ok("profile shows pet", prof.petName === "Tiểu Slime" && prof.petLevel >= 1);
  ok("profile shows title", prof.title === "Tân Binh");
  ok("profile has pvp/total kill counts", typeof prof.pvpKills === "number" && typeof prof.totalKills === "number");

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
