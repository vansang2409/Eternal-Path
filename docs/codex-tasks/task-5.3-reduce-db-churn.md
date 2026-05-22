# Task 5.3 — Reduce database write churn

> Sprint 5 · Priority 3. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

`PlayerRepository.save` deletes and re-inserts the whole inventory, and it is called after almost every action (every kill, equip, buy, sell, pickup, quest claim...). Under continuous farming this hammers the database. Reduce write frequency without losing data.

## Context files

- `server/src/game/GameWorld.ts` — the many `await this.repository.save(player)` / `void this.repository.save(player)` call sites, the tick loop, the disconnect handler.
- `server/src/db/PlayerRepository.ts` — `save`.

## Requirements

- Replace the per-action immediate saves with a "mark dirty" approach: when a player's persistent state changes, mark them dirty instead of saving immediately.
- Add a periodic flush (e.g. every 8-10 seconds) that saves all dirty players, then clears their dirty flag.
- Always flush a player immediately on disconnect (so nothing is lost when they leave).
- Keep the in-memory fallback behavior correct (memory save can stay cheap; the throttling applies to the heavy DB path too).
- Net effect: a continuously farming player triggers at most ~1 DB write per flush interval instead of one per kill.

## DO NOT

- Do not lose data on disconnect or server-intended saves.
- Do not add new npm dependencies.
- Do not change gameplay logic.

## Acceptance criteria

- [ ] Farming many kills in a row no longer triggers a DB write per kill; writes are batched on the flush interval.
- [ ] Disconnecting still persists the latest state.
- [ ] Stats/inventory/position still survive a relog (memory mode).
- [ ] `npm run typecheck` and `npm run build` pass.
