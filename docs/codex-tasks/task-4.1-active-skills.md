# Task 4.1 — Active skills (cooldown abilities)

> Sprint 4 · Priority 1. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Combat is currently auto-attack only. Add two active skills on cooldowns so combat has decisions and "juice", deepening the farm loop.

## Context files

- `shared/src/types.ts` — `ClientToServerEvents`/`ServerToClientEvents`, `PlayerState`, `FloatingTextEvent`.
- `shared/src/formulas.ts` — `rollDamage`, `PLAYER_ATTACK_RANGE`, cooldown constants (add skill cooldown/damage constants here).
- `server/src/game/GameWorld.ts` — `updateCombat`, `killMonster`, `selectedLivingMonster`, `emitFloating`, `rollDamage` usage, distance helpers.
- `client/src/game/GameScene.ts` — input/hotkeys (`Q` already used for potion), socket events, hit/slash effects.
- `client/src/ui/hud.ts`, `client/index.html`, `client/src/styles.css`, `client/src/i18n.ts` — skill bar UI + cooldown display.

## Requirements

- Add two active skills, server-authoritative, on per-player cooldowns (cooldown-only, no mana system for now):
  - **Power Strike** (hotkey `E`): a heavy hit on the current monster target (must be in `PLAYER_ATTACK_RANGE`), ~2.2x normal attack damage, cooldown ~4s.
  - **Cleave** (hotkey `R`): an area hit damaging all living monsters within a radius (~90px) around the player, ~1.3x attack each, cooldown ~8s.
- Add a typed `useSkill: (payload: { skillId: "powerStrike" | "cleave" }) => void` event in `ClientToServerEvents`.
- Server validates the skill exists, is off cooldown for that player, and (for Power Strike) that a valid living target is in range; applies damage via the existing `rollDamage`, reuses the existing kill/loot/EXP path when a monster dies (refactor `killMonster` if needed so skills can trigger kills), and emits floating damage text + lets the client play an effect.
- Track cooldowns per player on the server; reject (silently or with a brief message) skills used while on cooldown.
- Client: a small skill bar showing the two skills with key hints (E/R) and a visual cooldown indicator; pressing E/R (or clicking) sends `useSkill`. Reuse existing slash/hit effects for feedback.

## DO NOT

- Do not add a mana/energy system yet (cooldown-only).
- Do not let skills target or damage other players (skills hit monsters only; PvP stays the lightweight auto-attack model).
- Do not add new npm dependencies.
- Keep the client from deciding damage/kills; the server is authoritative.

## Acceptance criteria

- [ ] `E` lands a strong single-target hit on the selected in-range monster, on a ~4s cooldown.
- [ ] `R` damages multiple monsters around the player, on a ~8s cooldown.
- [ ] Cooldowns are enforced server-side and shown in the skill bar UI.
- [ ] Kills via skills grant EXP/gold/loot exactly like normal kills (including elite/boss announcements).
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test both skills and their cooldowns.
