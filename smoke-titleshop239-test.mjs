// Sprint 239: gold title shop. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { GOLD_TITLE_SHOP, TITLES, goldTitleOffer } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

ok("3 offers", GOLD_TITLE_SHOP.length === 3 && goldTitleOffer("phu-ho")?.goldPrice === 5000);
ok("titles registered", ["phu-ho", "dai-thuong-gia", "vuong-gia"].every((id) => TITLES.some((t) => t.id === id)));

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  let lastPlayer = null;
  s.on("player", (p) => { lastPlayer = p; });
  const until = async (pred, t = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { if (lastPlayer && pred(lastPlayer)) return lastPlayer; await sleepMs(100); } throw new Error("until timeout"); };
  const sysMsgs = [];
  s.on("system", (m) => sysMsgs.push(String(m)));
  s.emit("login", { email: `ts239${sfx}@t.vn`, accountName: `TS239${sfx}`, password: "test1234" });
  await once(s, "player");

  // Broke → reject.
  s.emit("buyTitle", { titleId: "phu-ho" });
  await sleepMs(400);
  ok("broke buyer rejected", sysMsgs.some((m) => m.includes("Cần 5.000")));

  // Fund + buy → earned via titlesUpdate, set as active works.
  s.emit("devGrant", { gold: 6000 });
  await until((p) => p.stats.gold >= 6000);
  const gold0 = lastPlayer.stats.gold;
  s.emit("buyTitle", { titleId: "phu-ho" });
  const tu = await once(s, "titlesUpdate");
  ok("phu-ho earned after buy", tu.earned.includes("phu-ho"));
  const p1 = await until((p) => (p.boughtTitles ?? []).includes("phu-ho"));
  ok("gold deducted 5000", p1.stats.gold === gold0 - 5000);

  // Double-buy rejected.
  s.emit("buyTitle", { titleId: "phu-ho" });
  await sleepMs(400);
  ok("double buy rejected", sysMsgs.some((m) => m.includes("đã sở hữu")) && p1.stats.gold === gold0 - 5000);

  // Fake title rejected.
  s.emit("buyTitle", { titleId: "khong-ton-tai" });
  await sleepMs(400);
  ok("unknown title rejected", sysMsgs.some((m) => m.includes("không bán")));

  s.disconnect();
  const failed = results.filter(([, p]) => !p);
  console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message ?? e); process.exit(1); });
