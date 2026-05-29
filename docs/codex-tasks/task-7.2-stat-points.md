# Task 7.2 — Stat points on level up

> Sprint 7 · Priority 2. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Give the player agency on level up: instead of fully automatic stat growth, grant 3 unspent points each level that the player allocates into Attack, Defense, or Max HP through the HUD.

## Context files

- `shared/src/types.ts` — `PlayerState` (add `unspentPoints`); add `allocateStat` event.
- `shared/src/formulas.ts` — `grantExp` (currently auto-adds +24 maxHp / +4 atk / +2 def per level — keep an auto baseline, but ALSO grant 3 points; OR reduce the auto baseline now that points exist, your call but document it).
- `server/src/game/GameWorld.ts` — `allocateStat` handler, `markDirty`.
- `server/src/db/PlayerRepository.ts` — persist `unspent_points` (memory + Postgres ALTER `ADD COLUMN IF NOT EXISTS`).
- `client/src/ui/hud.ts`, `client/index.html`, `client/src/styles.css`, `client/src/i18n.ts` — `+` buttons next to ATK/DEF/HP when `unspentPoints > 0`.

## Requirements

- Add `unspentPoints: number` on `PlayerState`, default 0. Persist on save/load (memory + Postgres column).
- On level up (`grantExp` reports leveled), increase `unspentPoints` by 3. Keep `grantExp` mechanically simple — emit the points-grant from the server side around the existing `grantExp` calls (e.g., in `killMonster`, in `claimQuest`, and in offline rewards), so each level confers 3 points regardless of source. Reduce the auto stat growth in `grantExp` to a modest baseline (your judgment; document in code) so points actually matter.
- Add a typed `allocateStat: (payload: { stat: "attack" | "defense" | "maxHp" }) => void` event. Server validates `unspentPoints > 0`, applies the increment (e.g. +1 attack / +1 defense / +6 maxHp per point — pick sensible values), decrements `unspentPoints`, marks dirty, and emits the updated player.
- HUD: in the stat panel, when `unspentPoints > 0`, render a small `+` button next to each stat showing "X điểm còn lại"/"X points left". Clicking emits `allocateStat`.

## DO NOT

- Do not let the client award points or apply stats unilaterally; the server is authoritative.
- Do not allow allocation when `unspentPoints <= 0`.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Reaching a new level grants 3 unspent points, shown in the HUD with a counter.
- [ ] Clicking `+` next to a stat in the HUD increments that stat and decrements the counter; trying to spend with zero points is rejected by the server.
- [ ] Points and applied stats survive a relog.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, briefly explain how to test (force a level, allocate, relog).
