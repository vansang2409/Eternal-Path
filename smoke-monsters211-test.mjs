// Sprint 211: 3 new monsters present in catalog + spawned in world. DEV_CHEATS=1.
import { io } from "socket.io-client";
import { getMonsterDefinition } from "@mmorpg/shared";
const PORT = process.env.PORT || "3251"; const URL = `http://localhost:${PORT}`;
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };
const connect = () => new Promise((res, rej) => { const s = io(URL, { transports: ["websocket"] }); s.on("connect", () => res(s)); s.on("connect_error", rej); setTimeout(() => rej(new Error("timeout")), 5000); });
const once = (s, ev, t = 5000) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error("timeout " + ev)), t); s.once(ev, (p) => { clearTimeout(h); res(p); }); });

ok("thornBeast in catalog (lvl 3)", getMonsterDefinition("thornBeast").level === 3);
ok("magmaGolem ranged (lvl 7)", getMonsterDefinition("magmaGolem").ranged === true && getMonsterDefinition("magmaGolem").level === 7);
ok("voidReaper in catalog (lvl 11)", getMonsterDefinition("voidReaper").level === 11);

const run = async () => {
  const sfx = Date.now() % 100000; const s = await connect();
  s.emit("login", { email: `mn${sfx}@t.vn`, accountName: `MN${sfx}`, password: "test1234" });
  const init = await once(s, "init");
  const types = new Set((init.snapshot?.monsters ?? []).map((m) => m.type));
  ok("new monsters spawned in world", types.has("thornBeast") && types.has("magmaGolem") && types.has("voidReaper"), `count=${(init.snapshot?.monsters ?? []).length}`);
  s.disconnect();
  const failed = results.filter(([, p]) => !p).length;
  console.log(failed === 0 ? `ALL PASS (${results.length} checks)` : `${failed} FAILED`); process.exit(failed === 0 ? 0 : 1);
};
run().catch((e) => { console.error("ERROR", e.message); process.exit(2); });
