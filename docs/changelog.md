# Linh Vuc / Eternal Path - Changelog

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
