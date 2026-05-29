# Task 6.1 — Choose an AFK farming zone

> Sprint 6 · Priority 1. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Let players pick which zone their character "farms" while they are offline. This selection will drive offline EXP/gold rewards in Task 6.2.

## Context files

- `shared/src/types.ts` — `PlayerState`, socket contracts; add an `AfkZone` type and `afkZone` field.
- `shared/src/formulas.ts` — good place for zone definitions (effective level + reward rate).
- `server/src/game/GameWorld.ts` — login handler (init from saved or default), new `setAfkZone` handler, `markDirty`.
- `server/src/db/PlayerRepository.ts` — persist `afkZone` (memory + Postgres). The `characters` table already has a `map_id` column; either reuse it or add a new `afk_zone` column with idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Memory fallback should store it on `SavedPlayer` too.
- `client/src/ui/hud.ts`, `client/index.html`, `client/src/i18n.ts`, `client/src/styles.css` — small AFK panel with the 3 zones to choose from.

## Requirements

- Define 3 AFK zones in shared code, matching the in-world zones: `"greenwood"`, `"midlands"`, `"deeplands"`. Each carries an effective level used to derive offline rewards (e.g. roughly 2 / 4 / 7).
- Add `AfkZone` to `shared/src/types.ts` and `afkZone: AfkZone` to `PlayerState`. Default new characters to `"greenwood"`.
- Add a typed `setAfkZone: (payload: { zone: AfkZone }) => void` event in `ClientToServerEvents`.
- Server handler validates the zone, updates `player.afkZone`, calls `markDirty(player)`, and emits `player` so the client reflects it.
- Persist `afkZone` in `PlayerRepository.load` / `save` (both Postgres and memory). On load for an existing character without a value, default to `"greenwood"`.
- Client AFK panel in the HUD with three buttons (or a small button group), localized VI/EN; the current selection is visually highlighted. Clicking emits `setAfkZone`.

## DO NOT

- Do not implement any auto-farming or rewards while the player is online (Task 6.2 handles offline rewards only).
- Do not let the client decide the zone unilaterally; the server is authoritative.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Player can switch AFK zone in the HUD; the highlighted option matches the server state.
- [ ] The chosen zone persists across relog (memory mode).
- [ ] Brand-new characters default to `"greenwood"`.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, briefly explain how to test (switch zone, relog, confirm it sticks).
