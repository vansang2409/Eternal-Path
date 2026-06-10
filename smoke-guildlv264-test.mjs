// Sprint 264: guild perk tier II — levels 11-15. DEV_CHEATS=1.
import { guildLevelForExp, guildTier, guildMaxMembers, GUILD_LEVELS } from "@mmorpg/shared";
const results = []; const ok = (n, p, e = "") => { results.push([n, p]); console.log(`${p ? "PASS" : "FAIL"} ${n}${e ? " — " + e : ""}`); };

ok("15 tiers", GUILD_LEVELS.length === 15);
ok("L10 boundary intact", guildLevelForExp(800_000) === 10 && guildLevelForExp(799_999) === 9);
ok("L11 at 1.1M", guildLevelForExp(1_100_000) === 11);
ok("L15 at 3.3M", guildLevelForExp(3_300_000) === 15 && guildLevelForExp(99_999_999) === 15);
ok("L15 perks +28%/35 slots", guildTier(15).expBonus === 0.28 && guildMaxMembers(15) === 35);
ok("monotonic exp curve", GUILD_LEVELS.every((t, i, a) => i === 0 || t.expRequired > a[i - 1].expRequired));

const failed = results.filter(([, p]) => !p);
console.log(failed.length === 0 ? `ALL PASS (${results.length} checks)` : `${failed.length} FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
