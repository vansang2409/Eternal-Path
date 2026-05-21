# Linh Vực / Eternal Path - Web MMORPG Prototype

## 1. Ý tưởng game

**Thể loại:** Web MMORPG 2D / Idle MMO nhẹ  
**Phong cách:** Cày cuốc, farm quái, lên cấp, săn đồ, lập bang, giao dịch  
**Không tập trung vào:** PvP tạo trận, match-based PvP, đồ họa phức tạp, blockchain/NFT

Người chơi bắt đầu như một người bình thường trong thế giới fantasy/tu luyện, đi farm quái, nhặt đồ, tăng cấp, quay về thị trấn, giao dịch, tham gia bang hội và dần mạnh lên.

---

## 2. Tên game

### Tên tiếng Việt
- Linh Vực

### Tên quốc tế
- Eternal Path

---

## 3. Prompt tổng cho Codex

```text
Create a 2D browser MMORPG prototype using Phaser.js for the frontend and Node.js + Socket.IO for the backend.

Game name:
Linh Vực / Eternal Path

Game style:
- Top-down 2D fantasy RPG
- Inspired by old-school MMORPGs like MU Online, Ragnarok, Metin2, and Albion Online
- Focus on progression, grinding monsters, loot drops, leveling, and social systems
- NOT match-based PvP
- The world should feel alive and persistent

Core gameplay loop:
- Player logs in
- Move around a map
- Kill monsters
- Gain EXP
- Loot items
- Level up
- Return to town
- Continue farming

Requirements:

Frontend:
- Phaser.js
- Tilemap support
- WASD movement
- Camera follows player
- Basic pixel-art placeholder assets
- Health bar
- EXP bar
- Inventory UI
- Monster HP display
- Floating damage numbers

Backend:
- Node.js
- Express
- Socket.IO
- Authoritative server logic
- Player state synchronization
- Monster spawning
- Combat calculations
- Loot drop system
- Save/load player data

Gameplay systems:
- Basic stats:
  - HP
  - Attack
  - Defense
  - EXP
  - Level

Monster AI:
- Random movement
- Aggro nearby players
- Auto attack

Item system:
- Common/Rare/Epic rarity
- Equipment slots
- Random stat generation
- Loot drops
- Respawn system

Database:
- PostgreSQL

Store:
- accounts
- inventory
- character stats
- equipped items

Architecture:
- Clean scalable folder structure
- Separate client/server/shared logic
- Use TypeScript if possible

DO NOT:
- Add complex PvP
- Add blockchain/NFT
- Add advanced graphics
- Add huge maps
- Add overly complicated skill trees

The goal:
- Build a playable MMORPG prototype quickly
- Make the gameplay addictive and progression satisfying
- Prioritize gameplay loop over graphics

Generate:
1. Full project structure
2. Backend setup
3. Frontend setup
4. Example combat system
5. Inventory system
6. Monster spawning system
7. Socket.IO synchronization
8. PostgreSQL schema
9. Instructions to run locally
```

---

## 4. Prompt nhỏ: Di chuyển nhân vật

```text
Add WASD movement to the Phaser.js player character.

Requirements:
- Camera smoothly follows the player
- Add simple idle and walking animation
- Keep the code clean and easy to extend
- Use placeholder sprites only
```

---

## 5. Prompt nhỏ: Combat

```text
Create a simple MMORPG combat system.

Requirements:
- Click monster to target
- Auto attack every 1 second
- Damage formula based on attack and defense
- Monster HP bar
- Floating damage text
- Player gains EXP when monster dies
- Monster respawns after a short delay
```

---

## 6. Prompt nhỏ: Loot

```text
Add a loot drop system.

Requirements:
- Monsters can drop gold and equipment
- Add item rarity:
  - Common
  - Rare
  - Epic
- Add random stat generation
- Show loot notification when an item drops
- Save dropped items to the player inventory
```

---

## 7. Prompt nhỏ: Inventory

```text
Create an MMORPG inventory UI.

Requirements:
- Grid inventory
- Drag and drop equipment
- Equipment slots:
  - Weapon
  - Helmet
  - Armor
- Tooltip with item name, rarity, and stats
- Equip and unequip items
- Character stats update when equipment changes
```

---

## 8. Prompt nhỏ: Level và chỉ số

```text
Add character progression.

Requirements:
- Player has level, EXP, HP, Attack, Defense
- EXP required increases each level
- On level up:
  - Increase max HP
  - Increase Attack
  - Increase Defense
  - Restore HP
- Show level and EXP bar in UI
```

---

## 9. Prompt nhỏ: Chat

```text
Add a simple global chat system using Socket.IO.

Requirements:
- Players can send messages
- Messages appear in a chat box
- Show player name before each message
- Keep recent 50 messages in memory
- Basic anti-spam cooldown
```

---

## 10. Prompt nhỏ: Lưu dữ liệu

```text
Add PostgreSQL persistence.

Requirements:
- Save player account
- Save character level, EXP, stats, gold
- Save inventory
- Save equipped items
- Load player data when logging in
- Create SQL migration/schema file
```

---

## 11. Prompt nhỏ: Bang hội

```text
Add a basic guild system.

Requirements:
- Create guild
- Join guild
- Leave guild
- Show guild name above player name
- Store guild data in PostgreSQL
- Keep the system simple for now
```

---

## 12. Prompt nhỏ: Idle / AFK farming

```text
Add a lightweight idle farming system.

Requirements:
- Player can choose an area to AFK farm
- While offline, calculate earned EXP and gold based on elapsed time
- Limit offline rewards to a maximum of 8 hours
- Show reward summary when player logs back in
- Do not allow rare equipment drops while offline yet
```

---

## 13. Nguyên tắc phát triển

Không làm game hoàn chỉnh ngay từ đầu.

Thứ tự nên làm:

1. Di chuyển nhân vật
2. Quái + combat
3. EXP + level
4. Loot + inventory
5. Save/load account
6. Chat
7. Guild
8. Market
9. Boss
10. Event

Mục tiêu đầu tiên:

> Làm prototype khiến chính mình muốn farm thêm 5 phút.

---

## 14. Ghi chú quan trọng cho Codex

```text
Use placeholder assets only.
Focus on gameplay systems.
Do not spend time on advanced graphics.
Keep the code modular and easy to refactor.
After generating code, also explain how to run and test the project locally.
```
