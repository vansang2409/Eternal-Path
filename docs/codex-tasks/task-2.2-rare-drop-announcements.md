# Task 2.2 — Rare/Epic drop announcements + color-coded loot log

> Sprint 2 · Priority 2. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Make good drops feel exciting. Broadcast a global announcement when any player loots a Rare or Epic item, and color-code the local loot log by rarity.

## Context files

- `server/src/game/GameWorld.ts` — `killMonster` (where loot is created and the `loot` event is emitted), `io.emit` (global broadcast pattern, see chat).
- `shared/src/types.ts` — `ServerToClientEvents`, `Rarity`, `Item`.
- `client/src/game/GameScene.ts` — `loot` socket handler, `hud.log`.
- `client/src/ui/hud.ts` — `log()` method (combat/loot log rendering).
- `client/src/styles.css` — rarity colors already exist (`rarity-common/rare/epic`); reuse them.
- `client/src/i18n.ts` — add strings for the announcement.

## Requirements

- Add a typed server->client event `announce: (payload: { accountName: string; itemName: string; rarity: Rarity }) => void` in `shared/src/types.ts` `ServerToClientEvents`.
- Server: in `killMonster`, when the looted item is `rarity === "rare"` or `"epic"`, broadcast `announce` to ALL clients via `io.emit` with the looter's account name, item name, and rarity. Do NOT announce Common drops.
- Client: handle `announce` by showing a prominent, rarity-colored banner/log line visible to everyone, e.g. "🌟 {name} found {itemName}!" Make Epic visually more prominent than Rare (stronger color/emphasis). Keep it lightweight (a styled line in the log feed and/or a short-lived banner).
- Client: color-code the local loot log entries (the existing `hud.log` loot lines) by item rarity using the existing rarity color classes.
- Keep it non-spammy: only Rare/Epic trigger the global announcement.

## DO NOT

- Do not announce Common drops.
- Do not add new npm dependencies.
- Do not change loot generation rates or the loot/EXP/gold logic; this is presentation only.
- Keep the server authoritative; the client only renders what the server broadcasts.

## Acceptance criteria

- [ ] Looting a Rare or Epic item shows a global, rarity-colored announcement to all connected clients.
- [ ] Epic announcements are clearly more prominent than Rare.
- [ ] Common drops never trigger a global announcement.
- [ ] The local loot log is color-coded by rarity.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test with two browser sessions.
