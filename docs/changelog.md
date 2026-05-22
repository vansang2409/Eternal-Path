# Linh Vuc / Eternal Path - Changelog

## 2026-05-22 (Sprint 5)

### Sprint 5 · Task 5.1 — Save & restore player position

- Implemented directly by the manager (Codex out of tokens), following docs/codex-tasks/task-5.1-save-position.md
- `PlayerRepository` now persists and restores character position (the schema already had `position_x`/`position_y`, defaulting to the town spawn); works in both the Postgres and in-memory paths
- Login spawns the player at the saved position, or the town spawn for new characters
- `normalizeStats` rewritten to construct stats explicitly (no longer leaks position columns into the stats object)
- Self-reviewed against Task 5.1 acceptance criteria: PASS (build + logic; position persists on disconnect/relog in memory mode)
- `npm run typecheck` and `npm run build` passed

### Sprint 5 · Task 5.2 — Password auth + session token

- Implemented directly by the manager (Codex out of tokens), following docs/codex-tasks/task-5.2-password-session.md
- Passwords hashed with Node's built-in `crypto` (scrypt + per-account salt), stored in `accounts.password_hash` (Postgres) or an in-memory map (fallback); no new dependencies
- First login for an email sets the password; later logins verify it and reject mismatches with a clear message; minimum 4 characters enforced client- and server-side
- On successful login the server issues a session token; the client stores it and auto-logs-in on reload (tokens are in-memory, invalidated on server restart)
- Added a password field to the login form and a stale-token cleanup on any pre-login error
- Self-reviewed against Task 5.2 acceptance criteria: PASS (build + logic; full verification needs a running server)
- Note: in pure in-memory mode (no DATABASE_URL) auth/tokens reset on server restart, matching the ephemeral saves
- `npm run typecheck` and `npm run build` passed

### Sprint 5 · Task 5.3 — Reduce database write churn

- Implemented directly by the manager (Codex out of tokens), following docs/codex-tasks/task-5.3-reduce-db-churn.md
- Replaced the per-action immediate saves with a dirty-set + periodic flush (every 9s); a continuously farming player now triggers at most ~1 DB write per flush interval instead of one per kill
- Disconnect still flushes immediately (`saveNow`) so nothing is lost when a player leaves
- Self-reviewed against Task 5.3 acceptance criteria: PASS (build + logic; stats/inventory/position survive relog in memory mode)
- `npm run typecheck` and `npm run build` passed

### Sprint 5 complete

- All three Sprint 5 tasks (save position, password+session auth, batched saves) shipped and reviewed PASS
- Watchlist items resolved: save position, email-only auth, and DB write churn
- Remaining watchlist note: equipment stats are still "baked" into saved stats (consider separating base vs bonus later)

## 2026-05-22 (Sprint 4)

### Sprint 4 · Task 4.1 — Active skills

- Added two cooldown-based active skills, server-authoritative: Power Strike (E, single-target ~2.2x, ~4s cd) and Cleave (R, AoE within 90px ~1.3x each, ~8s cd)
- Added `SkillId` type, `useSkill` event, and per-player `skillCooldowns` on `PlayerState`
- Refactored monster damage into a shared `damageMonster` helper so auto-attack and skills share the same kill/loot/EXP/announcement path
- Skills hit monsters only (PvP unchanged); no mana system (cooldown-only)
- Client skill bar with E/R hotkeys and live cooldown countdown
- Reviewed by manager against Task 4.1 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed
- Note: with E/R/Q hotkeys now added, the pre-existing "game keys fire while chat input is focused" issue is more noticeable; queued as a quick fix

### Sprint 4 · Task 4.2 — Quest board

- Added 3 quest templates (defeat 5 any / defeat 4 of level >= 4 / reach level 5) with gold + EXP rewards
- Added `questList` / `acceptQuest` / `claimQuest` events and `QuestView`/`QuestListPayload` types
- Server tracks active quests per session (max 3), increments kill/level progress live, and validates completion before granting a reward once
- Client quest panel shows active/available quests with live progress bars and Accept/Claim buttons (Claim enabled only when complete)
- Quest progress is session-only (in-memory), as scoped; save/load unaffected
- Reviewed by manager against Task 4.2 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed

### Sprint 4 · Task 4.3 — Basic party system

- Implemented directly by the manager (Codex was out of tokens), following docs/codex-tasks/task-4.3-basic-party.md
- Added `PartyView`/`PartyMemberView`/`PartyInvite` types and `inviteParty`/`acceptParty`/`leaveParty` + `partyUpdate`/`partyInvite` events
- Session-only parties (max 4): invite a nearby targeted player, accept/decline prompt, leave; party disbands when it drops below 2 members; cleaned up on disconnect
- Shared EXP: party members within 360px of a kill all receive EXP; gold and loot stay with the killer
- Party panel shows members with leader marker, level, and live HP (refreshed from snapshots); party members' names are highlighted green in the world
- Self-reviewed against Task 4.3 acceptance criteria: PASS (build + logic review; two-client runtime test pending user)
- `npm run typecheck` and `npm run build` passed

### Sprint 4 complete

- All three Sprint 4 tasks (active skills, quest board, basic party) plus a chat-focus hotkey fix shipped and reviewed PASS
- Combat now has active skills, players have goals via quests, and groups can farm together with shared EXP

### Polish — Suppress game hotkeys while typing

- While a text input/textarea/contentEditable is focused, `update()` sends neutral input and skips WASD movement and the Q/E/R hotkeys; normal input resumes on blur
- Resolves the long-standing "game keys fire while chat is focused" issue
- Reviewed by manager: PASS
- `npm run typecheck` and `npm run build` passed

## 2026-05-22 (Sprint 3)

### Sprint 3 · Task 3.1 — Elite monsters

- Added an `elite` flag to `MonsterState`; ~15% chance on spawn and re-rolled on each respawn
- Elite stats boosted (HP x2.2, ATK x1.5, DEF x1.3); EXP and gold x2.5
- Elite loot has a higher drop rate (+0.35, capped 0.95) and a rarity floor of Rare (biased toward Epic); elite Epic still triggers the global announcement
- Client shows elites distinctly: gold tint, larger sprite, wider orange HP bar, and an "Elite/Tinh anh" name prefix (also in the target panel)
- Non-elite monsters are unchanged
- Reviewed by manager against Task 3.1 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed

### Sprint 3 · Task 3.2 — World boss

- Added a boss monster "Eternal Warden" (lvl 12, very high stats) at a fixed far-map location
- Added `boss` flag and `respawnDurationMs` to `MonsterState`; normal monsters keep the original respawn formula (now parameterized), boss respawns on a long timer (4 min)
- Boss grants ~8x EXP/gold and a guaranteed high-rarity (Rare/Epic) drop
- Added a `bossAnnounce` event; global announcements fire when the boss appears and when it is defeated
- Client renders the boss distinctly (large, gold tint, wider gold HP bar, "Boss/Trùm" prefix, in target panel too)
- Reviewed by manager against Task 3.2 acceptance criteria: PASS
- Minor cosmetic note: before its first timed spawn the boss shows as a faint respawning sprite at its spot (harmless)
- `npm run typecheck` and `npm run build` passed

### Sprint 3 · Task 3.3 — Deep zone + zone labels

- Regrouped monster spawns into difficulty bands: low-level near town, mid in the middle, highest-level + boss in the far "deep" region (stats and spawn count unchanged)
- Added on-map zone labels (Town / Greenwood / Midlands / Deeplands), localized VI/EN
- Added a distinct deep-zone ground tile (4th tileset tile, dark-purple) so the region reads as different
- Initial submission referenced tile index 3 without adding the tile (deep area would render blank); manager flagged it and Codex shipped a follow-up fix (`f4e574f`) extending the tileset to 4 tiles
- Reviewed by manager against Task 3.3 acceptance criteria: PASS (after fix)
- `npm run typecheck` and `npm run build` passed

### Sprint 3 complete

- All three Sprint 3 tasks (elite monsters, world boss, deep zone + labels) shipped and manager-reviewed PASS
- World now has progression of place (town -> greenwood -> midlands -> deeplands), elite spikes, and a timed boss with global announcements

## 2026-05-22 (Sprint 2)

### Sprint 2 · Task 2.1 — Inventory capacity + sell junk

- Added shared `INVENTORY_CAPACITY` (30); applies to carried items, not equipped gear
- Bag full now blocks: monster loot is skipped with a message (EXP and gold still granted), shop purchase is blocked before any gold is deducted, and ground pickup is blocked
- Added a `sellJunk` socket event; in town it sells only Common equipment (keeps consumables, Rare/Epic, and equipped gear) and grants gold
- HUD shows a live inventory counter (`x / 30`) and a "Sell junk" button
- Reviewed by manager against Task 2.1 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed

### Sprint 2 · Task 2.2 — Rare/Epic drop announcements + colored loot log

- Added an `announce` server->client event; `killMonster` broadcasts it to all clients only for Rare/Epic loot (never Common)
- Client shows a rarity-colored announcement line; Epic is more prominent than Rare (glow vs plain border)
- Local loot log lines are now color-coded by item rarity
- Reviewed by manager against Task 2.2 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed

### Sprint 2 · Task 2.3 — Town safe-zone guard

- Monsters no longer target or damage players standing in town (`findMonsterTarget` and the monster-attack loop now check `isInTown`)
- Monsters drop aggro and walk back to spawn when their target enters town or when they exceed leash range
- No changes to monster stats, spawns, speed, leash, or aggro values
- Reviewed by manager against Task 2.3 acceptance criteria: PASS (one harmless dead branch noted: in-town check inside the `if (target)` block can never fire since town players are already filtered)
- `npm run typecheck` and `npm run build` passed

### Sprint 2 complete

- All three Sprint 2 tasks (inventory capacity + sell junk, rare/epic drop announcements, town safe-zone guard) shipped and manager-reviewed PASS
- Watchlist item "town safe zone inconsistency" is now resolved by Task 2.3

## 2026-05-22

### Sprint 1 · Task 1.1 — Netcode smoothness

- Raised server `SNAPSHOT_RATE` from 10 to 15 (tick rate unchanged at 20)
- Added client snapshot buffering with server-clock offset estimation
- Added entity interpolation (~100ms render delay) for other players and monsters
- Added client-side prediction for the local player using shared movement math
- Added reconciliation toward the authoritative server position (soft lerp, snap when gap > 64px)
- Made name labels, HP bars, equipment overlays, and monster labels follow interpolated/predicted positions
- Reviewed by manager against Task 1.1 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed

### Sprint 1 · Task 1.2 — Selected-target panel + auto-retarget

- Added a "Selected Target" HUD panel showing target name, level, and live HP bar; hides when no living target
- Added an "Auto-retarget" toggle (default OFF) wired to a new `setAutoRetarget` socket event
- Server picks the nearest living monster within 260px when the current target dies and auto-retarget is on; clears target if none in range
- Refactored target selection so a target stays selected out of range (panel persists) but attacks only fire within range
- PvP targeting remains manual; auto-retarget never targets players
- Reviewed by manager against Task 1.2 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed
- Note: target panel currently displays monster targets only; PvP targets do not populate the panel (acceptable for now)

### Sprint 1 · Task 1.3 — HP potions + town vendor (consumables)

- Reworked the shared `Item` type into a discriminated union (`EquipmentItem | ConsumableItem`) with a `kind` field; `equipped` now only accepts equipment
- Added Minor (45 HP / 28g) and Major (130 HP / 95g) potions to the town shop
- Added a `useItem` socket event; server heals capped at maxHp, removes one potion, emits floating heal text, and saves
- Buying potions reuses the in-town + gold checks; equipping a consumable is rejected
- Inventory/shop show potions distinctly (drink icon), with tooltips showing heal amount; use via button, double-click, or the `Q` hotkey (first potion)
- Extended PostgreSQL schema (kind/heal columns, nullable slot, idempotent ALTERs) and PlayerRepository so consumables persist in both memory and Postgres modes
- Reviewed by manager against Task 1.3 acceptance criteria: PASS
- `npm run typecheck` and `npm run build` passed

### Sprint 1 complete

- All three Sprint 1 tasks (netcode smoothness, target panel + auto-retarget, potions + vendor) shipped and manager-reviewed PASS
- Known follow-up (pre-existing): game hotkeys (WASD/Q) still fire while the chat input is focused; suppress them when chat is focused in a later polish pass

## 2026-05-21

### Initial Prototype

- Created monorepo structure: `client`, `server`, `shared`, `database`
- Added Phaser 3 frontend
- Added Node.js, Express, Socket.IO backend
- Added shared TypeScript contracts and gameplay formulas
- Added PostgreSQL schema
- Added in-memory persistence fallback
- Added tilemap world
- Added WASD movement and camera follow
- Added monster spawning, AI, aggro, combat, respawn
- Added EXP, level, HP, attack, defense
- Added equipment drops with Common/Rare/Epic rarity
- Added inventory and equipment UI

### Prototype Upgrade

- Added click-to-target monster combat
- Added right-click ground movement with server-authoritative destination handling
- Added town HP regeneration
- Added Vietnamese/English UI language selector with Vietnamese as default
- Changed basic server system messages to Vietnamese
- Added email login gate before entering the game
- Added account email storage and email-based save/load identity
- Added lightweight player-vs-player combat outside town
- Added player targeting, hit flash, slash hit effect, and local damage camera shake
- Added item value/price and stat budget scaling
- Added town equipment shop with gold purchases
- Added selling inventory equipment for gold while in town
- Added dropping inventory equipment onto the world for other players to pick up
- Added ground item synchronization, pickup range checks, and automatic cleanup for dropped items
- Updated monster gold drops to scale with level and toughness
- Added visible equipped gear overlays on player sprites
- Added floating player HP bars
- Added monster name/level labels
- Expanded monster spawns from level 1 to level 8
- Reworked monsters into a shared catalog with different HP, size, tint color, stat multipliers, drop rates, and loot themes
- Expanded monster variety to 16 monster types across levels 1 to 10
- Added gold to player stats and monster drops
- Added inventory grid
- Added item tooltip through native hover title
- Added drag-to-equip support
- Added unequip by clicking equipped item slot
- Added global chat over Socket.IO
- Added 50-message chat history
- Added chat anti-spam cooldown
- Updated README controls and feature list

### Stitch UI Pass

- Reviewed the Stitch mockup in `Stitch/DESIGN.md` and `Stitch/code.html`
- Applied a dark fantasy stone-and-gold HUD style to the Phaser client
- Restyled login, side HUD, inventory, equipment, shop, chat, and combat log panels
- Added recessed inventory/equipment slots, stronger rarity colors, and liquid-style HP/EXP bars
- Kept the implementation CSS-native without adding Tailwind or external UI dependencies
- Reworked the UI pass to more closely match Stitch: full-screen gameplay canvas, fixed right sidebar overlay, full-screen blurred login modal, larger white login inputs, gold-leaf login button, compact square equipment slots, and separated stat cards

### Verification

- `npm run typecheck` passed
- `npm run build` passed
- Local server verified at `http://localhost:3000/health`
- Local client verified at `http://localhost:5173`
