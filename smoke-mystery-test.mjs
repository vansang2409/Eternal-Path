// Sprint 68: unit-test rollMysteryBox branches + e2e buy/apply/poor-guard.
// Server: DEV_CHEATS=1 + test save paths. Run: node smoke-mystery-test.mjs
import { io } from "socket.io-client";
import { rollMysteryBox, MYSTERY_COSMETIC_POOL, MYSTERY_PET_POOL, MYSTERY_BOX_GEM_COST } from "./shared/dist/mysterybox.js";

const PORT = process.env.PORT || "3201";
const URL = `http://localhost:${PORT}`;
const results = [];
const ok = (name, pass, extra = "") => {
  results.push([name, pass]);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? " — " + String(extra).slice(0, 120) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
  setTimeout(() => rej(new Error("connect timeout")), 5000);
});
const once = (s, ev, t = 5000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const waitPlayer = (s, pred, t = 4000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout player pred")), t);
  const fn = (p) => { if (pred(p)) { clearTimeout(h); s.off("player", fn); res(p); } };
  s.on("player", fn);
});

// ── Unit: deterministic roll branches (rng returns fixed sequence) ──
const fixed = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
ok("roll gold branch (r=0.1)", (() => { const x = rollMysteryBox(fixed([0.1, 0.5])); return x.kind === "gold" && x.amount >= 1000 && x.amount <= 5000; })());
ok("roll gems branch (r=0.5)", (() => { const x = rollMysteryBox(fixed([0.5, 0.5])); return x.kind === "gems" && x.amount >= 20 && x.amount <= 60; })());
ok("roll cosmetic branch (r=0.7)", (() => { const x = rollMysteryBox(fixed([0.7, 0])); return x.kind === "cosmetic" && MYSTERY_COSMETIC_POOL.includes(x.id); })());
ok("roll pet branch (r=0.95)", (() => { const x = rollMysteryBox(fixed([0.95, 0])); return x.kind === "pet" && MYSTERY_PET_POOL.includes(x.id); })());
ok("reward always has label", (() => { const x = rollMysteryBox(fixed([0.3, 0.3])); return typeof x.label === "string" && x.label.length > 0; })());
ok("pools non-empty", MYSTERY_COSMETIC_POOL.length > 0 && MYSTERY_PET_POOL.length > 0);

// ── e2e ──
const run = async () => {
  const sfx = Date.now() % 100000;
  const s = await connect();
  const sys = [];
  let result = null;
  s.on("system", (m) => sys.push(m));
  s.on("mysteryBoxResult", (r) => { result = r; });
  s.emit("login", { email: `mb${sfx}@t.vn`, accountName: `MB${sfx}`, password: "test1234" });
  await once(s, "player");

  // Poor: rejected.
  s.emit("buyMysteryBox");
  await sleep(400);
  ok("poor player rejected", sys.some((m) => m.includes("để mở Rương Bí Ẩn")));

  // Grant gems, open several boxes; each costs 50 and yields a result.
  s.emit("devGrant", { gems: 1000 });
  const pg = await waitPlayer(s, (p) => (p.gems ?? 0) >= 1000);
  let gemsBefore = pg.gems;
  s.emit("buyMysteryBox");
  const after = await once(s, "mysteryBoxResult");
  ok("box yields a result", after && ["gold", "gems", "cosmetic", "pet"].includes(after.kind), JSON.stringify(after));
  await sleep(300);
  // Net gem change accounts for the 50 cost (and any gem reward / dup conversion).
  const pAfter = await new Promise((res) => { s.emit("devGrant", { gems: 0 }); s.once("player", res); });
  ok("gems deducted at least cost when reward not gems", after.kind === "gems" || after.converted || pAfter.gems === gemsBefore - MYSTERY_BOX_GEM_COST, `kind=${after.kind} gems ${gemsBefore}->${pAfter.gems}`);

  // Open 20 boxes — must never error and always grant a result.
  let count = 0;
  for (let i = 0; i < 20; i++) {
    const rp = once(s, "mysteryBoxResult", 3000).catch(() => null);
    s.emit("buyMysteryBox");
    const r = await rp;
    if (r) count++;
    await sleep(60);
  }
  ok("20 rolls all returned results", count === 20, `count=${count}`);

  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
