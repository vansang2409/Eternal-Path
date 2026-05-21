# Linh Vuc / Eternal Path - Development Notes

## Current Prototype State

The project is a playable 2D browser MMORPG prototype with:

- Phaser 3 frontend
- Node.js, Express, Socket.IO backend
- Shared TypeScript contracts and formulas
- PostgreSQL schema with in-memory fallback when `DATABASE_URL` is not set
- Authoritative server-side movement, combat, loot, monster AI, and player state sync

Local URLs:

- Client: `http://localhost:5173`
- Server health: `http://localhost:3000/health`

## Implemented Gameplay

- WASD movement
- Right-click ground movement
- Camera follows player
- Tilemap-based world
- Runtime-generated pixel placeholder assets
- Player HP, EXP, level, attack, defense, gold
- HP regenerates while standing in town
- Floating HP bars above players
- Click monster to target
- Click another player to target them for lightweight PvP outside town
- Auto attack when close enough to selected target
- Floating damage, EXP, gold, loot, and level-up text
- Hit flash/slash effects and small camera shake when the local player is hit
- Monster random movement, aggro, chase, auto attack, death, respawn
- Monster labels show name and level
- Monster catalog includes different HP, attack, defense, size, tint color, drop rate, and loot themes
- Monster levels currently range from 1 to 10
- EXP curve and level-up stat growth
- Gold drops
- Monster gold drops scale by level and monster toughness
- Common, Rare, Epic equipment drops
- Equipment has a value field; higher value means stronger generated stats
- Town shop sells equipment for gold
- Inventory equipment can be sold for partial gold value while in town
- Inventory equipment can be dropped onto the world and picked up by nearby players
- Dropped ground items are server-authoritative and expire after a short lifetime
- Random item stat generation
- Inventory grid
- Equipment slots: weapon, helmet, armor, boots, ring
- Equipped gear is represented on the player sprite with simple visual overlays
- Equip by clicking item or dragging onto equipment slots
- Unequip by clicking equipped slot
- Global chat with last 50 messages and anti-spam cooldown
- Vietnamese and English client UI, with Vietnamese as the default
- Email login gate before entering the world
- Stitch-inspired dark fantasy UI styling for login, HUD, inventory, equipment, shop, chat, and log panels
- Save/load player stats, inventory, and equipped items through PostgreSQL when configured

## Folder Structure

```text
client/       Phaser frontend
server/       Express + Socket.IO backend
shared/       Shared TypeScript types, formulas, loot helpers
database/     PostgreSQL schema
docs/         Development notes and planning docs
```

## Important Files

- `client/src/game/GameScene.ts`: Phaser scene, map, entities, targeting, floating text
- `client/src/ui/hud.ts`: HUD, inventory, equipment, chat UI
- `server/src/game/GameWorld.ts`: authoritative world loop, combat, monsters, chat
- `server/src/db/PlayerRepository.ts`: PostgreSQL persistence with memory fallback
- `shared/src/types.ts`: socket contracts and game state types
- `shared/src/formulas.ts`: stats, EXP curve, damage, movement constants
- `shared/src/loot.ts`: rarity and item generation
- `shared/src/loot.ts`: item value, stat budget, shop stock, rarity and item generation
- `shared/src/monsters.ts`: monster definitions, visual scale/tint, stat multipliers, loot preferences
- `database/schema.sql`: database schema
- `Stitch/DESIGN.md`: UI direction reference generated from Stitch
- `Stitch/code.html`: Stitch HTML mockup used as visual reference

## UI Direction

- Keep the interface dark fantasy, readable, and game-first.
- Use stone/metal panels, gold highlights, recessed item slots, and clear rarity colors.
- Keep the right HUD compact enough for repeated farming, looting, shopping, and chatting.
- Avoid adding Tailwind or CDN dependencies just to match the Stitch mockup; translate useful design ideas into local CSS.
- Inventory, equipment, shop, chat, and log should stay visible while the player is farming.

## Development Principles

- Prioritize the farm/loot/level loop over graphics.
- Keep systems modular enough to replace prototype logic later.
- Avoid complex PvP for now.
- PvP is intentionally lightweight: outside town only, no loot loss, no EXP loss, defeated players return to town.
- Avoid blockchain/NFT systems.
- Keep the map small until the gameplay loop feels good.
- Add features in thin playable slices.

## Short-Term Roadmap

1. Improve inventory UX:
   - Better custom tooltip panel
   - Item compare against equipped gear
   - Inventory item count / capacity

2. Add gold economy:
   - Vendor NPC in town
   - Sell unwanted equipment
   - Basic potion buying

3. Add combat feel:
   - Attack range indicator
   - Clear selected monster name/HP panel
   - Small hit flash on monsters
   - Auto-retarget option after kill

4. Add persistence polish:
   - Save position
   - Save chat-independent account session name
   - Add schema migration notes

5. Add social systems:
   - Party or guild foundation
   - Guild name above player
   - Guild table schema

6. Add idle/AFK farming:
   - Select farming area
   - Offline EXP/gold calculation
   - 8-hour reward cap
   - No rare drops offline initially

## Backlog

- Character select screen
- Account password/auth flow
- Multiple maps or zones
- Monster families and drop tables
- Boss spawn timer
- Market board
- Consumable potions
- Basic NPC dialogue
- Simple quest board
- Admin debug commands
- Better animation frames
- Sound effects

## Local Commands

Install dependencies:

```bash
npm install
```

Run server:

```bash
npm run dev:server
```

Run client:

```bash
npm run dev:client
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

## PostgreSQL Setup

Optional for quick gameplay, required for real persistence.

```bash
createdb mmorpg_prototype
psql -d mmorpg_prototype -f database/schema.sql
```

Set server environment:

```bash
cp .env.example server/.env
```

Then update `server/.env`:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mmorpg_prototype
```

## Known Notes

- Phaser makes the client bundle large. This is expected for now.
- If PostgreSQL is not running or `DATABASE_URL` is missing, player saves use memory only.
- Current combat requires clicking a monster first, then standing near it.
- Manual WASD movement cancels the current right-click move destination.
- Inventory tooltip is currently browser-native `title`; replace with custom UI later.
- Chat history is in memory only.
- Server system messages are currently Vietnamese-first; make them fully localized later if needed.
- Email is now the account identity for save/load. Password verification is not implemented yet.
- Monster spawn positions are hardcoded in `GameWorld.ts`, but monster stats/visuals/loot are now catalog-driven.

## Next Good Task

The best next slice is a town vendor:

- Sell equipment for gold
- Buy basic HP potions
- Add potion item type or a dedicated consumable inventory path
- Save gold and inventory after transactions
