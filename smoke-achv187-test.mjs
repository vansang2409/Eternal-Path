// Sprint 187: achievements + title for socketing/fusion. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { ACHIEVEMENTS, TITLES } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => { results.push([name, pass]); console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });
const waitPlayer = (s, pred, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout")), t); const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } }; s.on("player", fn); });
const has = (p, id) => (p.achievements ?? []).includes(id);

const run = async () => {
  ok("ACHIEVEMENTS count >= 42", ACHIEVEMENTS.length >= 42, `len=${ACHIEVEMENTS.length}`);
  ok("jeweler/fusionist + gem-lord title", ["jeweler","fusionist"].every((id)=>ACHIEVEMENTS.some(a=>a.id===id)) && TITLES.some(t=>t.id==="gem-lord"));
  const sfx = Date.now() % 100000;
  const s = await connect();
  s.emit("login", { email: `a187${sfx}@t.vn`, accountName: `A187${sfx}`, password: "test1234" });
  await once(s, "player");

  // jeweler: socket a gem.
  s.emit("devGrant", { gems: 500 });
  s.emit("devGrantItem", { name: "G", rarity: "epic", slot: "weapon", stats: { attack: 10 } });
  const pg = await waitPlayer(s, (p) => p.inventory.items.some((i) => i.id.startsWith("dev-")) && (p.gems ?? 0) >= 500);
  const id = pg.inventory.items.find((i) => i.id.startsWith("dev-")).id;
  s.emit("socketGem", { itemId: id, gemId: "ruby" });
  const pj = await waitPlayer(s, (p) => has(p, "jeweler"), 5000);
  ok("jeweler unlocked by socketing", has(pj, "jeweler"));

  // fusionist: fuse 3 commons.
  for (let i = 0; i < 3; i++) s.emit("devGrantItem", { name: `C${i}`, rarity: "common", slot: "boots" });
  await waitPlayer(s, (p) => p.inventory.items.filter((i) => i.kind === "equipment" && i.rarity === "common").length >= 3);
  s.emit("fuseGear");
  const pf = await waitPlayer(s, (p) => has(p, "fusionist"), 5000);
  ok("fusionist unlocked by fusion", has(pf, "fusionist"));

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
