// Sprint 268: elite affix wave II (frenzied/ancient). DEV_CHEATS=1.
import { ELITE_AFFIXES, getAffix, affixLabel } from "@mmorpg/shared";
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };

ok("6 affixes total", ELITE_AFFIXES.length === 6);
ok("frenzied glass cannon", getAffix("frenzied")?.atkMult === 1.6 && getAffix("frenzied")?.hpMult === 0.85);
ok("ancient bulwark", getAffix("ancient")?.hpMult === 1.9 && getAffix("ancient")?.defMult === 1.35);
ok("labels resolve", affixLabel("frenzied") === "Cuồng Loạn" && affixLabel("ancient") === "Viễn Cổ");
ok("unique tints", new Set(ELITE_AFFIXES.map((a) => a.tint)).size === 6);

const failed = results.filter(([, p]) => !p);
console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
