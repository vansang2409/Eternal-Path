# Task 1.2 — Selected-target panel + auto-retarget

> Sprint 1 · Priority 2. Read AGENTS.md first. Keep the server authoritative for targeting.

## Goal

Clicking a monster sets `player.targetId` on the server, but the HUD shows no target panel, and when a monster dies you must click another one — breaking the farm rhythm. Add a clear selected-target panel and an optional auto-retarget to the nearest monster after a kill.

## Context files

- `client/src/ui/hud.ts` — HUD panels; add the target panel here.
- `client/src/game/GameScene.ts` — knows `selfPlayer`, monster snapshot data, target highlight.
- `server/src/game/GameWorld.ts` — `targetMonster` handler, `updateCombat`, `killMonster`, `selectedLivingMonster`.
- `shared/src/types.ts` — socket event contracts.

## Requirements

- Add a "Selected Target" panel in the HUD showing the target's name, level, HP bar, and numeric `hp / maxHp`. Update live from snapshots. Hide when there is no living target.
- Add an "Auto-retarget" toggle (checkbox/button) in the HUD, default OFF. Persist the choice in memory for the session (a simple in-page variable is fine; do not require localStorage).
- Send the preference to the server via a new typed socket event (e.g. `setAutoRetarget: (payload: { enabled: boolean }) => void`) added to `ClientToServerEvents` in `shared/src/types.ts`. Store it per-player on the server.
- Server behavior when auto-retarget is ON: when the current monster target dies or becomes invalid, automatically select the nearest living monster within 260 px of that player. If none in range, clear the target.
- Keep manual click-to-target working exactly as before; auto-retarget only kicks in when there is no valid target.

## DO NOT

- Do not auto-target other players (PvP stays fully manual).
- Do not auto-target across the whole map; respect the 260 px radius.
- Do not let the client decide damage or kills; server stays authoritative.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Target panel shows name/level/HP of the selected monster, updates real-time, hides when none.
- [ ] With auto-retarget ON, killing a monster jumps to the nearest one in range — farm without re-clicking.
- [ ] No monster in range → target clears, no errors.
- [ ] PvP still requires manual player selection.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test it.
