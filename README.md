# 2D Browser MMORPG Prototype

A small but playable old-school MMORPG prototype focused on the core loop: move, farm monsters, gain EXP, loot gear, level up, return to town, and repeat.

## Tech

- Frontend: Phaser 3, TypeScript, Vite, Socket.IO client
- Backend: Node.js, Express, Socket.IO, TypeScript
- Database: PostgreSQL schema included, with graceful in-memory fallback if Postgres is not running
- Shared: TypeScript contracts and gameplay formulas

## Project Structure

```text
.
├── client/              # Phaser frontend
│   └── src/
│       ├── game/        # Phaser scene and generated pixel-art textures
│       ├── net/         # Socket.IO client wrapper
│       ├── ui/          # DOM inventory/status panels
│       └── main.ts
├── server/              # Express + Socket.IO authoritative backend
│   └── src/
│       ├── db/          # PostgreSQL pool and player persistence
│       ├── game/        # World loop, combat, monsters, loot
│       └── index.ts
├── shared/              # Shared TypeScript types and formulas
│   └── src/
└── database/
    └── schema.sql       # PostgreSQL schema
```

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Optional: create the PostgreSQL database and tables:

```bash
createdb mmorpg_prototype
psql -d mmorpg_prototype -f database/schema.sql
```

3. Copy environment values:

```bash
cp .env.example server/.env
```

4. Start the backend:

```bash
npm run dev:server
```

5. In a second terminal, start the frontend:

```bash
npm run dev:client
```

6. Open `http://localhost:5173`.

If PostgreSQL is unavailable, the server still runs with in-memory save data so the gameplay loop can be tested immediately. Set `ACCOUNT_NAME` in `server/.env` or connect with `?account=yourName` in the browser.

## Controls

- You must enter a valid email before the server creates your character.
- The UI supports Vietnamese and English from the language selector.
- `WASD`: Move
- Right-click the ground to move there
- Left-click a monster to target it
- Left-click another player outside town to target them for lightweight PvP
- Stand near your target to auto-attack
- Return to town to regenerate HP
- Loot and gold are added automatically when a monster dies
- Click inventory items to equip gear, or drag them onto equipment slots
- Click equipped items to unequip
- Use the chat box for global chat

## Gameplay Systems Included

- Authoritative server movement validation and state sync
- Monster spawning, random wander, aggro, chasing, attacking, death, and respawn
- Floating player HP bars and monster level labels
- Diverse monster catalog with per-monster HP, attack, defense, size, color, and loot themes
- Combat formulas with attack, defense, crit chance, and mitigation
- EXP curve and level-up stat growth
- Town HP regeneration
- Gold drops plus Common/Rare/Epic loot with generated stats
- Monster gold drops scale with monster level and toughness
- Town shop with purchasable equipment
- Equipment value/price drives generated stat strength
- Grid inventory, equipment slots, tooltip details, equip, and unequip
- Equipped gear is shown directly on player sprites with simple rarity-colored overlays
- Click-to-target monster combat
- Lightweight open-world PvP outside town, with no item or EXP loss
- Hit flash, slash effect, floating damage, and small camera shake when damaged
- Global Socket.IO chat with recent message history and anti-spam cooldown
- PostgreSQL schema for accounts, characters, inventory, and equipment
