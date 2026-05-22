# Task 3.2 — World boss with spawn timer

> Sprint 3 · Priority 2. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Add a single world boss that appears on a timer at a fixed location, takes real effort to kill, and rewards big loot with a global announcement. This gives players something to anticipate and rally around.

## Context files

- `shared/src/monsters.ts` — `MONSTER_DEFINITIONS` (add a boss definition), stat helpers.
- `shared/src/types.ts` — `MonsterState`, `ServerToClientEvents` (the `announce` event already exists from Task 2.2).
- `server/src/game/GameWorld.ts` — `createMonsterSpawns`, `killMonster`, `updateRespawns`, the tick loop, `goldForMonster`.
- `client/src/game/GameScene.ts` — `renderMonster` (boss visual), monster labels.
- `client/src/i18n.ts` — boss name + announcement strings.

## Requirements

- Add one boss monster (e.g. "Eternal Warden") with very high HP/attack/defense, a high level, and a large unique visual. Place it at a fixed spawn location.
- The boss uses a long, timer-based respawn (e.g. 3–5 minutes) instead of the normal short respawn. Add a per-monster respawn-duration concept rather than hard-coding the normal formula for the boss.
- Broadcast a global `announce` (or a dedicated boss broadcast) when the boss SPAWNS ("A boss has appeared!") and when it is DEFEATED ("{player} defeated {boss}!").
- On death the boss grants large EXP and gold and a guaranteed high-rarity drop (at least Rare, ideally biased toward Epic).
- The boss should be killable by normal combat (it can aggro/attack like other monsters, just much stronger). It must NOT block normal farming elsewhere.

## DO NOT

- Do not enlarge the world dimensions; place the boss within the existing map.
- Do not make the boss spawn constantly; respect the timer.
- Do not break the existing monster respawn behavior for normal monsters.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] The boss appears at a fixed spot on a timer and is visually distinct with a clear label.
- [ ] Killing the boss grants large EXP/gold and a high-rarity drop, and triggers a global "defeated" announcement.
- [ ] A global "boss appeared" announcement fires on spawn.
- [ ] The boss respawns only after its long timer; normal monsters are unaffected.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test (you may temporarily shorten the boss timer to verify, then set it back).
