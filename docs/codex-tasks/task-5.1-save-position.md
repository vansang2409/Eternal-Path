# Task 5.1 — Save & restore player position

> Sprint 5 · Priority 1. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Players currently always respawn at the town spawn on login. Persist the character's last position and restore it on login (both the Postgres path and the in-memory fallback).

## Context files

- `database/schema.sql` — `characters` table.
- `server/src/db/PlayerRepository.ts` — `SavedPlayer`, `load`, `save`, `loadMemory`, `normalizeStats`.
- `server/src/game/GameWorld.ts` — login handler (`townSpawn` default), disconnect save.
- `shared/src/types.ts` — `Vec2`.

## Requirements

- Add nullable `pos_x` / `pos_y` columns to `characters` (with idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- Extend `SavedPlayer` with an optional `position?: Vec2`.
- `PlayerRepository.load` returns the saved position when present (both DB and memory); returns `undefined` for brand-new characters.
- `PlayerRepository.save` persists `player.position` (DB UPDATE + memory).
- In the login handler, spawn the player at `saved.position` when present, otherwise at `townSpawn`.
- Do not break existing stats/inventory save/load.

## DO NOT

- Do not add new npm dependencies.
- Do not change combat/movement logic.

## Acceptance criteria

- [ ] Move away from town, disconnect, log back in → character is at the last position (memory mode).
- [ ] A brand-new character still starts at town.
- [ ] Existing stats/inventory still load correctly.
- [ ] `npm run typecheck` and `npm run build` pass.
