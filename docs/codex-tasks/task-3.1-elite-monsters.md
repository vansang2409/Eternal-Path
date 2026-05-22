# Task 3.1 — Elite monsters

> Sprint 3 · Priority 1. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Add occasional "elite" monsters: tougher, visually distinct, and much more rewarding. They create exciting spikes in the farm loop and pair well with the Rare/Epic announcement system from Sprint 2.

## Context files

- `shared/src/types.ts` — `MonsterState` (add an `elite` flag here).
- `shared/src/monsters.ts` — `MONSTER_DEFINITIONS`, `monsterMaxHp`, `monsterAttack`, `monsterDefense`.
- `shared/src/loot.ts` — `createLoot`, `rollRarity` (loot generation).
- `server/src/game/GameWorld.ts` — `createMonsterSpawns`, `updateRespawns`, `killMonster`, `goldForMonster`.
- `client/src/game/GameScene.ts` — `renderMonster`, monster labels/tint/scale.
- `client/src/i18n.ts` — monster name translation, "Elite" prefix.

## Requirements

- Add an `elite: boolean` field to `MonsterState`.
- On spawn AND on respawn, give each monster a chance (about 15%) to become elite. Determinate per-monster (re-rolled each respawn).
- Elite monsters get boosted derived stats (e.g. ~2.2x maxHp, ~1.5x attack, ~1.3x defense), a larger scale, and a distinct visual on the client (e.g. brighter tint or an outline/glow + an "Elite" prefix on the name label).
- Elites grant more EXP and gold (e.g. ~2.5x EXP and gold).
- Elites have a much higher drop rate and their loot is guaranteed to be at least Rare (bias `createLoot`/rarity upward for elites — pass an `elite` flag or a rarity floor into the loot path).
- Keep everything server-authoritative; elites flow through the existing combat/loot/announcement pipeline (so an elite Epic still triggers the global announcement automatically).

## DO NOT

- Do not make every monster elite; keep the chance modest (~15%) so they stay special.
- Do not change base (non-elite) monster stats, the monster catalog values, or spawn positions.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Some monsters spawn/respawn as elite (~15%), visibly distinct with an "Elite" label and stronger look.
- [ ] Elites are noticeably tougher and give clearly more EXP/gold.
- [ ] Elite loot drops more often and is at least Rare; an elite Epic still fires the global announcement.
- [ ] Non-elite monsters are unchanged.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test (you may temporarily raise the elite chance to verify, then set it back to ~15%).
