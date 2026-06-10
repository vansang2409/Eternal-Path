// Sprint 202: mail item attachments. DEV_CHEATS=1.
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
  const aName = `MIA${sfx}`, bName = `MIB${sfx}`;
  const a = await connect();
  const b = await connect();
  let bMail = null; b.on("mailList", (l) => { bMail = l; });
  a.emit("login", { email: `mi${sfx}a@t.vn`, accountName: aName, password: "test1234" });
  b.emit("login", { email: `mi${sfx}b@t.vn`, accountName: bName, password: "test1234" });
  await once(a, "player"); await once(b, "player");

  // A gets an epic item.
  a.emit("devGrantItem", { name: "Mail Blade", rarity: "epic", slot: "weapon", stats: { attack: 12 } });
  const ap = await waitPlayer(a, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")));
  const item = ap.inventory.items.find((i) => i.id.startsWith("dev-"));

  // Send item (gold 0) to B.
  a.emit("sendMail", { to: bName, gold: 0, message: "tặng kiếm", itemId: item.id });
  const aAfter = await waitPlayer(a, (p) => !p.inventory.items.some((i) => i.id === item.id), 4000);
  ok("item escrowed out of sender bag", !aAfter.inventory.items.some((i) => i.id === item.id));
  await sleep(400);
  ok("recipient sees mail with item", bMail && bMail.some((m) => m.item && m.item.name === "Mail Blade"));

  // B claims → receives the item.
  const mailId = bMail.find((m) => m.item && m.item.name === "Mail Blade").id;
  b.emit("claimMail", { mailId });
  const bAfter = await waitPlayer(b, (p) => p.inventory.items.some((i) => i.name === "Mail Blade"), 4000);
  ok("recipient received the item", bAfter.inventory.items.some((i) => i.kind === "equipment" && i.name === "Mail Blade" && i.rarity === "epic"));

  // Cannot send a locked item.
  const aSys = []; a.on("system", (m) => aSys.push(m));
  a.emit("devGrantItem", { name: "Locked Item", rarity: "rare", slot: "ring" });
  const ap2 = await waitPlayer(a, (p) => p.inventory.items.some((i) => i.name === "Locked Item"));
  const lockedItem = ap2.inventory.items.find((i) => i.name === "Locked Item");
  a.emit("toggleItemLock", { itemId: lockedItem.id });
  await waitPlayer(a, (p) => p.inventory.items.find((i) => i.id === lockedItem.id)?.locked);
  aSys.length = 0;
  a.emit("sendMail", { to: bName, gold: 0, itemId: lockedItem.id, message: "" });
  await sleep(300);
  ok("cannot mail a locked item", aSys.some((m) => m.includes("đang khóa")));

  a.disconnect(); b.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
