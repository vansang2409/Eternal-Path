// Sprint 265: guild raid tier II — gating + constants. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { GUILD_RAID_T2_MIN_LEVEL, GUILD_RAID_T2_HP_MULT, GUILD_RAID_T2_GOLD_FACTOR, GUILD_RAID_T2_TOP_GEM, GUILD_RAID_T2_COST_MULT, GUILD_CREATE_COST_GOLD } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("tier-2 constants", GUILD_RAID_T2_MIN_LEVEL === 5 && GUILD_RAID_T2_HP_MULT === 2.5 && GUILD_RAID_T2_GOLD_FACTOR === 0.3 && GUILD_RAID_T2_TOP_GEM === 40 && GUILD_RAID_T2_COST_MULT === 2);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `r2x265${sfx}@t.vn`, accountName: `R2X265${sfx}`, password: "test1234" });
  await once(s, "player");

  // Found a level-1 guild, then try a tier-2 summon → rejected by level gate.
  s.emit("devGrant", { gold: GUILD_CREATE_COST_GOLD + 10_000 });
  await until((p) => p.stats.gold >= GUILD_CREATE_COST_GOLD);
  s.emit("createGuild", { name: `RaidT2 ${sfx}`, tag: `R${String(sfx).slice(0, 3)}` });
  await until((p) => Boolean(p.guildId));
  s.emit("summonGuildRaid", { tier: 2 });
  await sleepMs(500);
  ok("tier-2 gated below guild level 5", sysMsgs.some((m) => m.includes("Bậc II") && m.includes("cấp 5")));

  // Tier-1 summon still works (after funding the guild BANK).
  s.emit("depositGuildBank", { amount: 5000 });
  await sleepMs(400);
  s.emit("summonGuildRaid", {});
  const raid = await once(s, "guildRaidUpdate", 4000);
  ok("tier-1 summon works", Boolean(raid) && raid.bossName.includes("Hỗn Độn"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
