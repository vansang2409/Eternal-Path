# Task 6.2 — Offline rewards on login

> Sprint 6 · Priority 2. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

When a player logs back in after being offline, grant EXP and gold based on elapsed time and their chosen AFK zone, capped at 8 hours. No item drops in this first version.

## Context files

- `shared/src/types.ts` — add an `offlineRewards` server->client event payload type.
- `shared/src/formulas.ts` — zone reward rates (EXP per hour, gold per hour) + helpers.
- `server/src/db/PlayerRepository.ts` — add a `last_seen_at` timestamp (idempotent ALTER for Postgres + memory). Store it on save.
- `server/src/game/GameWorld.ts` — on login, compute elapsed and apply rewards; on disconnect/save the existing flow already updates the timestamp through save.

## Requirements

- Add `last_seen_at timestamptz` to `characters` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, plus a corresponding optional field in the memory `SavedPlayer`.
- `PlayerRepository.save` stores `last_seen_at = now()` so any save (including the disconnect flush) refreshes it. `load` returns it as a `Date` / `number` (ms since epoch).
- Define per-zone reward rates in `shared/src/formulas.ts`, scaled by the zone's effective level (e.g. roughly `expPerHour = 60 * effectiveLevel`, `goldPerHour = 25 * effectiveLevel`). Pick sensible values that feel rewarding but not game-breaking; document them in code comments.
- On login (both password and token paths), if a saved `last_seen_at` exists:
  - Compute `elapsedMs = min(8h, now - last_seen_at)` and `cappedAtMax = (now - last_seen_at) >= 8h`.
  - If `elapsedMs < 5 min`, skip (avoid double-granting on quick reconnects).
  - Otherwise compute exp/gold based on the player's `afkZone` rate × hours, apply via `grantExp` (level-ups flow normally) and add gold to `player.stats`. Mark dirty.
  - Emit a new `offlineRewards` server->client event with `{ elapsedMs, exp, gold, cappedAtMax }`.
- No item drops yet.

## DO NOT

- Do not grant items, only EXP and gold.
- Do not allow real-time farming while the player is online.
- Do not change the rules for a brand-new character (no `last_seen_at` → no rewards on first login).
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Logging in after being offline grants EXP + gold matching the chosen AFK zone and elapsed time.
- [ ] Elapsed time is capped at 8 hours; the `cappedAtMax` flag reflects this.
- [ ] Quick reconnects (< 5 minutes) do not grant offline rewards.
- [ ] A brand-new character does not receive rewards on first login.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test by temporarily shortening the minimum threshold or backdating `last_seen_at` to simulate elapsed time.
