# Task 4.2 — Quest board (kill quests)

> Sprint 4 · Priority 2. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Give players concrete goals and an extra reward loop with a simple town quest board offering kill quests.

## Context files

- `shared/src/types.ts` — types and socket contracts; add a `Quest` type and quest events.
- `server/src/game/GameWorld.ts` — `killMonster` (where kills happen), per-player session state maps, `isInTown`, `repository.save`.
- `client/src/ui/hud.ts`, `client/index.html`, `client/src/styles.css`, `client/src/i18n.ts` — quest panel UI.

## Requirements

- Define a small fixed set of quest templates (e.g. 3): "Defeat N monsters", "Defeat N monsters of level >= L", "Reach level L". Keep objectives simple and computable from existing data.
- Add typed events: `questList` (server->client, available + active quests with progress), `acceptQuest: (payload: { questId }) => void`, and `claimQuest: (payload: { questId }) => void`.
- Server tracks each player's active quest(s) and progress in their session state. Update progress on relevant events (e.g. increment kill counters in `killMonster`, check level on level-up). Cap a player to a small number of active quests (e.g. 3).
- When a quest's objective is met, the player can claim it for a gold + EXP reward; then it is removed/refreshed. Enforce that claiming only works when the objective is actually complete.
- Client: a quest panel (in the HUD or as a town board) listing available quests to accept and active quests with live progress bars and a Claim button when complete.
- Persisting quest progress to the database is OPTIONAL for this task; tracking it in the server session (in-memory) is acceptable for the prototype. Do not break existing save/load.

## DO NOT

- Do not add branching dialogue, quest chains, or NPC pathfinding.
- Do not let the client award itself rewards; the server validates completion and grants rewards.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Player can accept a kill quest from the quest panel.
- [ ] Killing relevant monsters increases the quest progress live.
- [ ] Completing the objective enables Claim, which grants the gold + EXP reward exactly once.
- [ ] Claiming an incomplete quest is rejected.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test accepting, progressing, and claiming a quest.
