# Task 2.3 — Town safe-zone guard for monster combat

> Sprint 2 · Priority 3 (quick win). Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Town is meant to be safe, but monster aggro/attack code never checks for town — today it only works by luck of spawn distance and leashing. Make the safe zone an explicit rule: monsters never target or damage players standing in town.

## Context files

- `server/src/game/GameWorld.ts` — `findMonsterTarget` (monster target selection), `updateCombat` (the monster-attacks-player loop), `updateMonsters` (aggro/leash), `isInTown` (already exists).

## Requirements

- In `findMonsterTarget`, skip any player who is in town (`isInTown(player.position)`), so monsters never acquire a town-standing player as a target.
- In the monster-attacks-player section of `updateCombat`, if the target player is in town, the monster deals no damage (skip the hit).
- When a monster's current target moves into town, the monster should drop aggro: clear `targetPlayerId` so it stops chasing and leashes back toward its spawn.

## DO NOT

- Do not change monster stats, spawns, speeds, leash, or aggro radius values.
- Do not change PvP rules (PvP already excludes town).
- Do not add new npm dependencies.
- Keep the server authoritative.

## Acceptance criteria

- [ ] Standing in town, monsters never target you and never deal damage to you.
- [ ] Stepping out of town, normal aggro/chase/attack resumes.
- [ ] A monster chasing you drops aggro and leashes back once you enter town.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test by luring a monster toward the town edge.
