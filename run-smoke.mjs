// One-command smoke-test runner (Sprint 70).
//
// Boots the server on an isolated port with DEV_CHEATS + throwaway save
// files, runs every smoke-*.mjs sequentially WITH SPACING (running them all
// back-to-back triggers websocket connection-storm false negatives), prints a
// summary, tears the server down, and exits non-zero if any suite failed.
//
// Usage: node run-smoke.mjs            (runs the fast suites)
//        node run-smoke.mjs --slow     (also runs the 30s+ persistence tests)
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const PORT = "3250";
const SAVE = { MEMORY_SAVE_PATH: "data/_smoke-s.json", GUILD_SAVE_PATH: "data/_smoke-g.json", MARKET_SAVE_PATH: "data/_smoke-m.json" };
const env = { ...process.env, PORT, DEV_CHEATS: "1", ...SAVE };

const FAST = [
  "smoke-guild-test", "smoke-guild57-test", "smoke-guild-rank-test",
  "smoke-market-test", "smoke-market59-test", "smoke-streak-test",
  "smoke-titles-test", "smoke-pets-test", "smoke-petlevel-test",
  "smoke-setbonus-test", "smoke-raid-test", "smoke-achv-test",
  "smoke-mystery-test", "smoke-content2-test", "smoke-titles2-test", "smoke-guildbank-test", "smoke-disband-test", "smoke-inspect-test", "smoke-bagslot-test", "smoke-exchange-test", "smoke-goldboost-test", "smoke-friendnoti-test", "smoke-sellmat-test", "smoke-ecoachv-test", "smoke-pay-test", "smoke-who-test", "smoke-raidannounce-test", "smoke-motd-test", "smoke-guilddesc-test", "smoke-salvage-test", "smoke-content3-test", "smoke-achv146-test", "smoke-itemlock-test", "smoke-salvageall-test", "smoke-xpboost-test", "smoke-upgrade-test", "smoke-respec-test", "smoke-recipes158-test", "smoke-achv159-test", "smoke-content4-test", "smoke-rage-test", "smoke-titles164-test", "smoke-milestone-test", "smoke-questgear-test", "smoke-happyhour-test", "smoke-arena169-test", "smoke-streak170-test", "smoke-brew171-test", "smoke-mounts172-test", "smoke-achmile174-test", "smoke-autosalvage176-test", "smoke-content5-test", "smoke-achv179-test", "smoke-starter180-test", "smoke-fuse181-test", "smoke-titles182-test", "smoke-sacpet184-test", "smoke-content6-test", "smoke-socket186-test", "smoke-achv187-test", "smoke-questsocket189-test", "smoke-weekly190-test", "smoke-recipes192-test", "smoke-titles194-test", "smoke-content7-test", "smoke-collect196-test", "smoke-broadcast198-test", "smoke-content200-test", "smoke-mail201-test", "smoke-mailitem202-test", "smoke-mailquest204-test", "smoke-content8-test", "smoke-dealdaily206-test", "smoke-mailall207-test", "smoke-titles208-test", "smoke-gift210-test", "smoke-monsters211-test", "smoke-affix212-test", "smoke-recipes214-test", "smoke-titles215-test", "smoke-gems216-test", "smoke-bestiary217-test", "smoke-rested219-test", "smoke-firstkill220-test"
];
const SLOW = ["smoke-guild-persist", "smoke-market-persist"]; // 2-phase / 30s waits

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runTest(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [`${file}.mjs`], { env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => {
      const last = out.trim().split("\n").pop() ?? "";
      resolve({ file, code, last });
    });
  });
}

const run = async () => {
  // Clean any leftover throwaway save files.
  for (const f of Object.values(SAVE)) if (existsSync(f)) rmSync(f);

  const server = spawn(process.execPath, ["server/dist/index.js"], { env });
  let booted = false;
  server.stdout.on("data", (d) => { if (String(d).includes("listening")) booted = true; });
  for (let i = 0; i < 20 && !booted; i++) await sleep(300);
  await sleep(500);

  let list = process.argv.includes("--slow") ? [...FAST, ...SLOW] : FAST;
  // --half 1|2 runs a slice so the full sweep fits inside short tool timeouts.
  const halfArg = process.argv.indexOf("--half");
  if (halfArg !== -1) {
    const half = Number(process.argv[halfArg + 1]);
    const mid = Math.ceil(FAST.length / 2);
    list = half === 2 ? FAST.slice(mid) : FAST.slice(0, mid);
  }
  const results = [];
  for (const file of list) {
    const r = await runTest(file);
    results.push(r);
    console.log(`${r.code === 0 ? "✅" : "❌"} ${file.padEnd(24)} ${r.last}`);
    await sleep(800); // spacing to avoid connection-storm false negatives (350ms was too tight at 22 suites)
  }

  server.kill();
  await sleep(300);
  for (const f of Object.values(SAVE)) if (existsSync(f)) rmSync(f);

  const failed = results.filter((r) => r.code !== 0);
  console.log("─".repeat(50));
  console.log(failed.length === 0 ? `ALL ${results.length} SUITES PASS` : `${failed.length}/${results.length} SUITES FAILED: ${failed.map((f) => f.file).join(", ")}`);
  process.exit(failed.length === 0 ? 0 : 1);
};

run().catch((e) => { console.error("RUNNER ERROR", e); process.exit(2); });
