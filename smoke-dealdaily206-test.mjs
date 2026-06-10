// Sprint 206: daily featured deal. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { dailyDealCosmetic, dailyDealPrice, DAILY_DEAL_DISCOUNT } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });

const run = async () => {
  ok("discount 35%", DAILY_DEAL_DISCOUNT === 0.35);
  const deal = dailyDealCosmetic(); const price = dailyDealPrice();
  ok("deal price < original", price < deal.gemPrice, `${price}<${deal.gemPrice}`);
  const sfx = Date.now() % 100000; const s = await connect();
  const sys = []; s.on("system", (m) => sys.push(m));
  s.emit("login", { email: `dd${sfx}@t.vn`, accountName: `DD${sfx}`, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gems: 1000 });
  await waitPlayer(s, (p) => (p.gems ?? 0) >= 1000);
  const gems0 = (await new Promise((r) => { s.emit("devGrant", { gems: 0 }); s.once("player", r); })).gems;
  s.emit("buyDailyDeal");
  const pb = await waitPlayer(s, (p) => (p.cosmetics ?? []).includes(deal.id), 4000);
  ok("deal cosmetic owned after buy", (pb.cosmetics ?? []).includes(deal.id));
  ok("charged discounted price", pb.gems === gems0 - price, `gems ${gems0}->${pb.gems}`);
  ok("lastDealDay set", (pb.lastDealDay ?? 0) > 0);
  // Second buy same day → rejected.
  sys.length = 0; s.emit("buyDailyDeal"); await sleep(300);
  ok("second buy same day rejected", sys.some((m) => m.includes("đã mua khuyến mãi hôm nay")));
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
