# Task 7.3 — Achievements / milestones

> Sprint 7 · Priority 3. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Add a small set of achievements that fire once when the player crosses a milestone, with a brief toast notification and a HUD panel listing earned vs locked. Gives players collectible progress markers.

## Context files

- `shared/src/types.ts` — `Achievement` view type + `achievementUnlocked` server->client event.
- `server/src/game/GameWorld.ts` — hooks in `killMonster`, level-up paths, and `claimQuest` / loot handlers to check + unlock.
- `server/src/db/PlayerRepository.ts` — persist `achievements: string[]` (Postgres jsonb column `achievements` with idempotent ALTER + memory).
- `client/src/game/GameScene.ts`, `client/src/ui/hud.ts`, `client/index.html`, `client/src/styles.css`, `client/src/i18n.ts` — toast + achievements panel.

## Requirements

- Define a small fixed set (about 6–8) of achievements in shared code with id + title + description. Suggested set:
  - `first-blood` — defeat any monster for the first time.
  - `reach-level-5`, `reach-level-10` — level milestones.
  - `slay-elite` — kill any elite monster.
  - `slay-boss` — kill the world boss.
  - `epic-find` — loot an Epic item.
  - `idler` — receive offline rewards for the first time.
  - `socialite` — join a party for the first time.
- Add `achievements: string[]` to the server-side `PlayerState` (or a per-player Set in `GameWorld`, persisted). When a relevant server event happens, check if the achievement is already unlocked; if not, add it and emit a typed `achievementUnlocked: (payload: { id: string; title: string; description: string }) => void` event.
- Persist `achievements` (Postgres jsonb column + memory). New characters start with an empty list.
- Client toast: a small transient banner (3–4 seconds) when an `achievementUnlocked` event arrives, with the title and a localized "Achievement unlocked" prefix.
- HUD panel: list all achievements with title/description; earned ones are visually distinct from locked ones. Localize titles/descriptions VI/EN.

## DO NOT

- Do not let the client unlock achievements unilaterally; the server is authoritative.
- Do not add new npm dependencies.
- Do not change loot/EXP/combat balance.

## Acceptance criteria

- [ ] First-time triggers (first kill, hitting level 5/10, killing an elite, killing the boss, looting Epic, first offline rewards, first party join) each unlock the matching achievement exactly once.
- [ ] A toast appears at the moment of unlock.
- [ ] The HUD panel shows locked vs unlocked clearly.
- [ ] Earned achievements survive a relog.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, briefly explain how to test (force a kill, force a level, etc.).
