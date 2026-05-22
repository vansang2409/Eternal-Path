# Eternal Path - Session Handoff

## Project State

Playable 2D browser MMORPG prototype in `D:\Eternal Path`.

Stack:

- Client: Phaser 3 + Vite + TypeScript + Socket.IO client
- Server: Node.js + Express + Socket.IO + TypeScript
- Shared: TypeScript contracts, formulas, loot, monster catalog
- Database: PostgreSQL schema with in-memory fallback when `DATABASE_URL` is not set

Local URLs:

- Client: `http://localhost:5173`
- Server health: `http://localhost:3000/health`

## Current Features

- Email login gate before entering the world
- WASD movement
- Right-click movement
- Camera follows player
- Left-click monster/player targeting
- PvE monster combat
- Lightweight PvP outside town
- Town safe zone and HP regeneration
- Player stats: HP, attack, defense, EXP, level, gold
- EXP gain, level-up, gold drops
- Multiple monster types and levels with different HP, size, color, stats, and drops
- Monster AI: random movement, aggro, chase, auto attack, respawn
- Inventory and equipment slots
- Equip/unequip items
- Visible equipped gear overlays on player sprites
- Shop in town
- Buy equipment with gold
- Sell inventory equipment for partial gold while in town
- Drop inventory equipment onto the map
- Other players can pick up dropped ground items if close enough
- Dropped items are server-authoritative and expire after a while
- Common/Rare/Epic item rarities
- Random stat generation and item value scaling
- Floating damage/EXP/gold/loot text
- Player HP bars and monster HP/name/level display
- Global chat with message history and anti-spam cooldown
- Vietnamese/English UI, Vietnamese default
- Stitch-inspired dark fantasy UI styling

## Important Files

- `client/src/game/GameScene.ts`: Phaser scene, input, player/monster rendering, ground item rendering, socket events
- `client/src/ui/hud.ts`: HUD, inventory, equipment, shop, chat, sell/drop/equip actions
- `client/src/styles.css`: Stitch-inspired UI styling
- `client/src/i18n.ts`: Vietnamese/English strings
- `server/src/game/GameWorld.ts`: authoritative world loop, combat, monsters, shop, sell/drop/pickup, chat
- `server/src/db/PlayerRepository.ts`: PostgreSQL persistence with memory fallback
- `shared/src/types.ts`: socket contracts and world state types
- `shared/src/formulas.ts`: movement, combat, EXP/stat formulas
- `shared/src/loot.ts`: item generation, value scaling, shop stock
- `shared/src/monsters.ts`: monster definitions
- `database/schema.sql`: PostgreSQL schema
- `docs/changelog.md`: development history
- `docs/development-notes.md`: current notes and roadmap
- `Stitch/DESIGN.md`, `Stitch/code.html`, `Stitch/screen.png`: UI mockup/reference

## How To Run

Install dependencies:

```powershell
npm install
```

Build/check:

```powershell
npm run typecheck
npm run build
```

Run server:

```powershell
npm run dev:server
```

Run client:

```powershell
npm run dev:client
```

If using the already-built server:

```powershell
node server\dist\index.js
```

## Git State

Local git repo has been initialized and committed.

Commit:

```text
2d0db1d Initial Eternal Path MMORPG prototype
```

Current branch:

```text
master
```

Remote:

```text
origin https://github.com/vansang2409/Eternal-Path.git
```

The branch is currently tracking:

```text
origin/master
```

If there are new local commits or files, push with:

```text
git push
```

If GitHub authentication fails, log into GitHub on this machine and run:

```powershell
git push -u origin master
```

## Good Next Steps

1. Add clearer in-game item action UX:
   - custom tooltip
   - compare selected item vs equipped item
   - sell value shown before selling

2. Improve player progression:
   - potion system
   - stronger monster zones
   - elite monsters
   - rare drop announcements

3. Improve world feel:
   - NPC vendor in town
   - town storage/stash
   - map zone labels
   - more tile variety

4. Improve social systems:
   - party basics
   - guild name display
   - friend list

5. Improve persistence:
   - save position
   - proper migrations
   - sessions/auth tokens instead of email-only login

## Notes For Next Codex Session

- User prefers Vietnamese replies.
- Continue from `D:\Eternal Path`.
- Read this file first, then `docs/development-notes.md` and `docs/changelog.md`.
- Do not reinitialize the project.
- Be careful not to commit `node_modules`, logs, `dist`, or `.env`.
- The current gameplay priority is still fast MMORPG grinding/progression, not graphics-heavy polish.
