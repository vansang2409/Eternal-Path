# Task 1.1 — Netcode smoothness (interpolation + client prediction)

> Sprint 1 · Priority 1. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Make movement look smooth. Today the server emits `snapshot` at `SNAPSHOT_RATE = 10`, and the client sets sprite positions directly in `applySnapshot()`, so even the local player stutters in ~100 ms steps. Fix with entity interpolation for remote entities and client-side prediction for the local player.

## Context files

- `server/src/game/GameWorld.ts` — `SNAPSHOT_RATE` constant, `broadcastSnapshot`, `WorldSnapshot.serverTime`, `updatePlayers` (movement math).
- `client/src/game/GameScene.ts` — `applySnapshot`, `renderPlayer`, `renderMonster`, `update` loop.
- `shared/src/formulas.ts` — `PLAYER_SPEED`, `clampToWorld`, `TILE_SIZE`, world bounds.
- `shared/src/types.ts` — `WorldSnapshot` already has `serverTime`.

## Requirements

- Raise `SNAPSHOT_RATE` from 10 to 15 in `GameWorld.ts`. Keep `TICK_RATE` at 20.
- On the client, keep a small buffer of the last few snapshots with their `serverTime`.
- Render REMOTE entities (other players and all monsters) with entity interpolation: draw them ~100 ms in the past, lerping position between the two surrounding buffered snapshots. No instant teleport between snapshots.
- For the LOCAL player, add client-side prediction: each frame, move the local sprite immediately using the same input + `PLAYER_SPEED` + `clampToWorld` logic from `@mmorpg/shared` (mirror the server's `updatePlayers` math so prediction matches).
- Reconcile the local player against the server position from snapshot/`player` events: small gap → smoothly lerp toward server position; large gap (e.g. > 64 px, after death/teleport) → snap.
- Make name labels, HP bars, equipment overlays, and monster labels follow the interpolated/predicted positions, not raw snapshot positions.
- Keep HUD updates (stats, EXP) driven by the authoritative `player` event as today.

## DO NOT

- Do not move combat, loot, damage, or final position authority to the client.
- Do not add new npm dependencies.
- Do not change the socket event contract in `shared/src/types.ts` (`serverTime` already exists).
- Do not introduce large maps or change gameplay constants other than `SNAPSHOT_RATE`.

## Acceptance criteria

- [ ] Local player moves smoothly at 60fps, no ~100 ms stutter.
- [ ] Other players and monsters glide between positions, no teleport jumps.
- [ ] After death/return-to-town, position snaps correctly (no long rubber-band).
- [ ] Combat/loot behavior unchanged; server still owns final position.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test smoothness locally.
