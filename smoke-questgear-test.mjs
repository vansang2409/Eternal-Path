// Sprint 166: daily quests tied to the gear loop (salvage/upgrade). DEV_CHEATS=1.
// Run: node smoke-questgear-test.mjs
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
  const s = await connect();
  let lastQuests = null;
  s.on("questList", (p) => { lastQuests = p; });
  const activeProg = (id) => lastQuests?.active.find((q) => q.id === id);
  const waitQuest = (id, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout quest " + id)), t); const iv = setInterval(() => { const q = activeProg(id); if (q && pred(q)) { clearInterval(iv); clearTimeout(h); res(q); } }, 100); });
  s.emit("login", { email: `qg${sfx}@t.vn`, accountName: `QG${sfx}`, password: "test1234" });
  await once(s, "player");
  // Clear auto-seeded tutorial/daily quests so slots are free (DEV_CHEATS).
  s.emit("devClearQuests");
  await sleep(300);

  // ── upgradeGear quest ──
  s.emit("acceptQuest", { questId: "daily-upgrade-1" });
  await waitQuest("daily-upgrade-1", (q) => q.progress === 0);
  ok("accepted upgrade quest at 0", activeProg("daily-upgrade-1").progress === 0);
  s.emit("devGrant", { gold: 10000 });
  s.emit("devGrantItem", { name: "Q Item", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")) && p.stats.gold >= 10000);
  const upId = pg.inventory.items.find((i) => i.id.startsWith("dev-")).id;
  s.emit("upgradeItem", { itemId: upId });
  await waitQuest("daily-upgrade-1", (q) => q.completed);
  ok("upgrade quest completed after upgrade", activeProg("daily-upgrade-1").completed);
  const goldBeforeClaim = (await waitPlayer(s, () => true, 1500).catch(() => pg)).stats.gold;
  const gBefore = (await new Promise((res) => { s.emit("devGrant", { gold: 0 }); s.once("player", res); })).stats.gold;
  s.emit("claimQuest", { questId: "daily-upgrade-1" });
  const claimed = await waitPlayer(s, (p) => p.stats.gold >= gBefore + 300, 4000);
  ok("upgrade quest reward gold +300", claimed.stats.gold >= gBefore + 300, `gold ${gBefore}->${claimed.stats.gold}`);

  // ── salvageGear quest ──
  s.emit("acceptQuest", { questId: "daily-salvage-3" });
  await waitQuest("daily-salvage-3", (q) => q.progress === 0);
  for (let i = 0; i < 3; i++) s.emit("devGrantItem", { name: `S${i}`, rarity: "common", slot: "boots" });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "equipment" && i.rarity === "common").length >= 3);
  s.emit("salvageAll", { rarity: "junk" });
  await waitQuest("daily-salvage-3", (q) => q.completed, 4000);
  ok("salvage quest completed after mass salvage", activeProg("daily-salvage-3").completed);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
