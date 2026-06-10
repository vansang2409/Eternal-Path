// Sprint 237: loot pity — forced rare+ drop after 30 dry kills. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { LOOT_PITY_KILLS } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("pity threshold 30", LOOT_PITY_KILLS === 30);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  s.emit("login", { email: `lp237${sfx}@t.vn`, accountName: `LP237${sfx}`, password: "test1234" });
  await once(s, "player");

  // Prime the pity counter to 29 (next kill is the 30th dry kill).
  s.emit("devGrant", { lootPity: 29 });
  await until((p) => (p.lootPity ?? 0) === 29);

  s.emit("devSimKill", {});
  const p1 = await until((p) => (p.lootPity ?? -1) === 0 || p.inventory.items.some((i) => i.kind === "equipment" && i.rarity !== "common"));
  await sleepMs(300);
  const rarePlus = lastPlayer.inventory.items.filter((i) => i.kind === "equipment" && (i.rarity === "rare" || i.rarity === "epic"));
  ok("rare+ item dropped on pity kill", rarePlus.length >= 1, `n=${rarePlus.length}`);
  ok("pity reset to 0", (lastPlayer.lootPity ?? -1) === 0, `pity=${lastPlayer.lootPity}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
