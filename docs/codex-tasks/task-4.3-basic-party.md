# Task 4.3 — Basic party system

> Sprint 4 · Priority 3. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Let players group up and farm together with shared EXP, a first step toward social play. Keep it minimal and session-only.

## Context files

- `shared/src/types.ts` — `PlayerState`, socket contracts; add party types/events.
- `server/src/game/GameWorld.ts` — players map, `killMonster` (EXP grant), `grantExp`, distance helpers, `emitFloating`, disconnect cleanup.
- `client/src/game/GameScene.ts` — player rendering/targeting (invite via clicking a player), socket events.
- `client/src/ui/hud.ts`, `client/index.html`, `client/src/styles.css`, `client/src/i18n.ts` — party panel UI.

## Requirements

- Add a session-only party concept (max 4 members). Add typed events: `inviteParty: (payload: { playerId }) => void`, `acceptParty: (payload: { partyId }) => void`, `leaveParty: () => void`, plus a server->client `partyUpdate` carrying the current party roster (ids, names, level, HP) for members.
- Inviting: a player can invite another nearby player (e.g. select a player and click "Invite", reusing the existing player-targeting click). The invitee gets a system prompt and can accept.
- Shared EXP: when a party member kills a monster, split/share EXP among party members who are within a reasonable range (e.g. 360px) of the kill. Keep gold and loot going to the killer only (simple and fair). Reuse `grantExp` and emit EXP floating text for each recipient.
- Client: a party panel listing members with live HP/level. Highlight party members in the world (e.g. a colored name or marker).
- Clean up party membership on disconnect (reuse the existing disconnect handler); if the party drops below 2 members, disband it.

## DO NOT

- Do not add guilds, persistent parties, party chat channels, or party-vs-party PvP.
- Do not share gold or loot (killer keeps those) — only EXP is shared.
- Do not persist parties across reconnects (session-only).
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Two players can form a party (invite + accept) and see each other in a party panel with live HP/level.
- [ ] Killing a monster near a party member grants shared EXP to in-range members (gold/loot stay with the killer).
- [ ] Leaving or disconnecting removes the member; a party below 2 members disbands.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test with two browser sessions.
