# Eternal Path — Handoff for Next Session

Resume point after **Sprint 58** (player marketplace). Total: **135 commits** on `master`, all pushed. Project chuẩn hoá **Node 24** (`.nvmrc`, engines >=24, Dockerfile node:24-alpine).

## TL;DR

Browser MMORPG đầy đủ tính năng + monetization. Mục đích: **kiếm tiền**.

- **Stack:** Phaser 3 + Vite + TS (client), Node + Express + Socket.IO + TS (server), npm workspaces
- **Render:** 2.5D isometric 64×32 tiles, client-only projection (server vẫn 2D Cartesian)
- **Persist:** Filesystem JSON `data/saves.json` (Postgres ready, commented out)
- **Deploy:** Docker single-port serves Socket.IO + client static trên port 3000
- **Remote:** `github.com/vansang2409/Eternal-Path.git` branch `master`

## Run

```bash
# Dev (2 servers)
npm run dev:server   # localhost:3000
npm run dev:client   # localhost:5173 with Vite HMR

# Production (1 server)
npm run build
node server/dist/index.js  # serves client/dist + Socket.IO trên :3000

# Docker
docker compose up -d --build
```

## Features (high level — chi tiết trong STATUS-SPRINT-50.md + STATUS-SPRINT-55.md)

- **Combat:** 24 mob (3 ranged casters), 4 boss (1 world + 3 dungeon), 16 skills × 3 ranks (+25%/rank) × 3 classes
- **Loot:** 15 crafting recipes (6 endgame), 8+ materials, 18 treasure chests respawn 5min, enchant re-roll, set bonuses 2/3/4 cùng theme
- **Status FX:** Burn/Freeze/Bleed DOT, slow, particle VFX
- **World:** Procedural 200×150 + 12 biomes + collision, day/night 10min/4 phases, 8 ambient music moods
- **Progression:** 3 classes, 21 quests (5 tutorial auto + 8 story + 3 daily reset 24h), 20 achievements with progress, 3 loadout presets, talents
- **Social:** Party 4, chat + timestamps + slash commands, PvP arena + leaderboard, friends list + private msg `/w`, town NPCs
- **Guild (Sprint 56):** tạo 5000g, rank leader/officer/member, invite/kick/promote/MOTD, chat `/g`, tag `[TAG]` cạnh tên, hotkey U, persist `data/guilds.json` (GuildStore riêng, không đụng saves.json). E2E smoke: `node smoke-guild-test.mjs` + `smoke-guild-persist.mjs`
- **Guild progression (Sprint 57):** 10 cấp guild, góp vàng → EXP guild (1g=1exp, max Lv10 @ 800k). Mỗi cấp +2% EXP & +2% vàng cho TOÀN guild + 1 slot (Lv10 = +18%, 30 người). `donateGuild`, `buyGuildBoost` (200💎, +10% EXP 48h cho cả guild). Multiplier stack với VIP trong `grantExpAndStatPoints` + `killMonster`. Bảng đóng góp từng member. E2E: `node smoke-guild57-test.mjs` (11 checks)
- **Marketplace (Sprint 58):** chợ đấu giá người chơi, hotkey M, modal 3 tab (Chợ/Bán/Của tôi). Rao item từ túi → item giữ escrow trên listing (rời túi); mua bằng vàng; **phí 5%** đốt (gold sink), người bán nhận net. Hủy tin → hoàn item. Bán khi seller offline → proceeds vào "mailbox" `collectPending`, cộng vàng lúc relog. Tối đa 8 tin/người. `MarketStore` persist `data/market.json` (escrow sống qua restart — đã test). Dev cheat `devGrantItem {name,rarity,value}` (chỉ khi `DEV_CHEATS=1`). E2E: `node smoke-market-test.mjs` (14 checks) + `smoke-market-persist.mjs`. Server test env cần `DEV_CHEATS=1` + `MARKET_SAVE_PATH`
- **Mobile:** Virtual joystick + 5 action buttons (touch auto-detect)
- **UX:** Minimap, hotkeys (I/C/K/N/V/H/G/J/B/?), Top banner notifications, collapse panels, skill cooldown sweep

## 💰 Monetization (built, no real payment yet)

| Item | Price (Gem) | Notes |
|---|---|---|
| 7 cosmetics | 90-280 | Skin tints + skill FX colors |
| Battle Pass Premium | 500 | 10 tiers × 2 tracks |
| VIP 1 tuần | 80 | +20% EXP/gold + 30 Gem/ngày |
| VIP 1 tháng | 280 | Best ROI |
| VIP 3 tháng | 700 | Plus VIP title |
| Daily Gem (free) | +8/day | 20h cooldown |
| Daily Gem (VIP) | +30/day | Stacks with above |
| Guild Boost | 500 → 200 | 48h +10% EXP cho cả guild (Sprint 57) |

## ⚠️ Cần làm tiếp (user sẽ chỉ đạo)

1. **Tích hợp payment thật** — Stripe / VNPay / Momo để convert Gem → VND
2. **Deploy public** — cần cloud account của user (Railway/Fly.io/Render). Dockerfile + DEPLOY.md sẵn sàng
3. **Banner ads / reward video ads** — AdSense / AdMob
4. ~~Guild system~~ — ✅ DONE Sprint 56
5. ~~Marketplace trading~~ — ✅ DONE Sprint 58 (auction house + escrow + tax sink)
6. ~~Guild monetize~~ — ✅ DONE Sprint 57 (Guild Boost 200💎 + progression)
7. **Còn lại:** payment thật (Stripe/VNPay — cần tài khoản user), deploy public (cần cloud user), AdMob ads, guild-vs-guild/raid, mùa cosmetic mới, marketplace nâng cao (search/filter/sort, Gem premium listing)

## Working style với user

- **Vietnamese trong chat, English trong code/comments**
- **Implement trực tiếp**, không pass cho Codex (đã đổi từ Sprint 8)
- **Push sau mỗi sprint** — user thường không xem từng commit nhưng kiểm tra branch
- **Khi user vắng mặt**, cứ tự pick sprint tiếp theo, đừng chờ chỉ đạo
- **Build trước commit** — `npm run build` PASS
- **Restart dev server khi shared types đổi** (tsx watch không auto-pickup shared dist đôi khi)
- User đặc biệt thích: gem 💎, VIP 🌟, top banner notifications, sprite có hồn
- User đã từng: confused tại sao đánh quái không trúng (fixed bằng tăng PLAYER_ATTACK_RANGE 42→64 + auto-stop on close target)

## Khu vực dễ kiếm bug nếu reset

- `server/src/db/PlayerRepository.ts`: TDZ order — `memoryAuth` phải declare TRƯỚC `loadFromDisk()`
- `client/src/game/GameScene.ts:1156` — sprite scale theo class (12×14 tăng scale 2, fallback 8×8 scale 3)
- Iso projection: tất cả entity dùng `worldToIso(x, y)` + `setDepth(iso.y)` để Y-sort
- Player có cosmetic skin → `sprite.setTint()`, không có thì `sprite.clearTint()`

## File quan trọng

```
D:\Eternal Path\
├── STATUS-SPRINT-50.md          # Milestone Sprint 50 (Vietnamese)
├── STATUS-SPRINT-55.md          # Milestone Sprint 55 (Vietnamese)
├── HANDOFF.md                   # File này
├── DEPLOY.md                    # Deploy guide (3 cloud providers)
├── Dockerfile + docker-compose.yml
├── shared/src/
│   ├── cosmetics.ts             # 7 cosmetic catalog
│   ├── battlepass.ts            # 10-tier BP catalog
│   ├── vip.ts                   # 3 VIP packages
│   ├── crafting.ts              # 15 recipes + 9 materials
│   ├── classes.ts               # 3 classes catalog
│   ├── world/biomes.ts + mapGen.ts  # procedural world
├── server/src/
│   ├── game/GameWorld.ts        # ~2700 lines — main game logic
│   ├── db/PlayerRepository.ts   # FS persistence
│   └── index.ts                 # express + io + static serve
├── client/src/
│   ├── game/GameScene.ts        # Phaser scene
│   ├── game/assets.ts           # all pixel art
│   ├── ui/hud.ts                # ~1500 lines — all HUD logic
│   └── styles.css               # all styles
└── data/saves.json              # persistent player state
```
