# Eternal Path — Handoff for Next Session

## ▶ BẮT ĐẦU LẠI (đọc trước — kể cả khi là Claude/tài khoản khác)

Bạn đang tiếp quản một MMORPG trình duyệt đang phát triển dở. Hãy đọc hết file này rồi tiếp tục theo đúng cách làm dưới đây — **không cần hỏi lại chủ dự án** (anh ấy thường vắng và muốn cứ làm tới).

**Cách làm việc (BẮT BUỘC):**
- Trả lời **tiếng Việt** trong chat; code/comment bằng **tiếng Anh**.
- **Tự implement trực tiếp** (đừng giao Codex). Tự chọn sprint kế tiếp khi chủ vắng mặt, đừng chờ duyệt.
- **Mỗi sprint = 1 commit + push** lên `origin master` ngay (`feat:`/`fix:`/`docs:`). Build PASS trước khi commit.
- Mỗi sprint nên có **smoke test e2e** (`smoke-*.mjs`) và thêm vào `run-smoke.mjs`. Server test cần env `DEV_CHEATS=1` (bật event `devGrant`/`devGrantItem`/`devGrantMaterial`) + đường lưu test riêng (`MEMORY_SAVE_PATH`/`GUILD_SAVE_PATH`/`MARKET_SAVE_PATH`).
- Logic dễ sai (tính toán) → tách **hàm thuần trong `shared/`** rồi unit-test.
- Chủ THÍCH **đồ hoạ mạnh kiểu anime** (toàn bộ VFX ở `client/src/game/GameScene.ts`).

**Môi trường:** Node 24 (`nvm use`). `npm install` → `npm run build` → `npm start` (phục vụ client+server ở cổng 3000) → mở `http://localhost:3000`. Regression: `npm smoke` (hoặc `node run-smoke.mjs`, dùng `--half 1|2` nếu timeout). KHÔNG chạy nhiều smoke test thủ công cùng lúc (gây flaky "websocket error" — dùng runner có giãn cách 800ms).

**Lưu ý sandbox (chỉ khi chạy trong Cowork máy hiện tại):** mount đôi khi đọc stale file lớn vừa sửa — chạy build/test/git qua PowerShell, file tools (Read/Edit) đọc đúng.

**Còn lại cần CHỦ cung cấp:** payment thật (Stripe/VNPay), deploy public (cloud account), AdMob ads.

---

Resume point after **Sprint 139** (đồ hoạ anime), `origin/master` = `2745e9d`. Total: **~255 commits** on `master`, all pushed. (S134=CRIT!/MEGA! pop label on heavy hits, S135=camera viewport box on minimap, S136=camera kick when self casts AoE, S137=top boss HP bar for ANY boss you engage, S138=soft god-rays in sunlit forest, S139=**press G** to toggle ambient FX density High/Low [persists to localStorage `fxHigh`; Low culls motes/fireflies/weather/god-rays/water-shimmer but keeps all combat+UX feedback].) (S123=night shooting stars, S124=boss-aggro banner+red flash, S125=water specular shimmer, S126=pulsing boss halo on minimap, S127=monster HP-bar damage-lag ghost chunk, S128=dungeon dust motes, S129=other-player arrival fade-in + departure poof, S130=screen-space golden radiance on self level-up, S131=in-world chat speech bubbles above players, S132=off-screen party member edge arrows, S133=threat-level nameplate coloring vs player level.) S131-133 are gameplay/UX (chat bubbles, party arrows, con coloring), still client-only — server/shared untouched, 28 smoke suites unaffected. (S103=loot/chest ground shimmer, S104=monster projectile glow+trail+impact, S105=skill-ready flash on hotbar, S106=red hit-flash+shake, S107=achievement star confetti, S108=smooth day/night fade, S109=idle breathing bob, S110=monster respawn materialize shimmer, S111=MEGA-crit [≥120 dmg] chromatic split+ripple, S112=night/dusk drifting fireflies, S113=boss/elite enrage red-throb tint <30% HP, S114=pickup/chest gold burst, S115=universal skill cast wind-up charge ring, S116=squash-and-stretch impact punch, S117=dash speed-lines while sprinting, S118=living town NPCs [glow+idle bob], S119=animated lock-on target reticle, S120=biome weather layer [forest leaves/snow/swamp spores/desert dust], S121=red "!" aggro alert, S122=cinematic radial vignette deepening at night.) All client-only in `client/src/game/GameScene.ts`; servers/shared untouched so the 28 smoke suites are unaffected.

Resume point after **Sprint 96**. Total: **210+ commits** on `master`, all pushed. (S90=guild recruit desc, S91=fix movement-freeze when focusing checkbox [isEditableFocused only blocks text inputs], S92=anime hit/crit/cast/levelup juice, S93=ambient motes + sprint afterimage, S94=per-element skill VFX [skillTheme/elementalAccent in GameScene], S95=cinematic boss finisher zoom-punch, S96=anime monster death dissolve.) **Live demo:** server chạy nền trên `http://localhost:3000` (PORT=3000, dùng data/saves.json thật) — restart bằng `npm start`; hard-refresh (Ctrl+Shift+R) để lấy client mới sau mỗi build. VFX toàn bộ ở `client/src/game/GameScene.ts`. (S81=sell-all-materials, S82=economy achievements, S83=README rewrite, S84=full regression checkpoint + `--half`, S85=prod deploy smoke + `npm start`/`npm smoke`, S86=`/pay` gold transfer, S87=`/who` online list, S88=server-wide raid-defeat announce, S89=guild MOTD on login.) **28 smoke suites, all green** (verified in 2 halves). prod boot serves /health+client 200 on Node 24. (S71=achievement titles, S72=guild bank, S73=raid costs bank, S74=disband guild, S75=/inspect, S76=ECONOMY.md audit, S77=buy bag slots, S78=gem→gold exchange, S79=gold boost potion, S80=friend online noti.) Smoke suites: 22 (`node run-smoke.mjs` — chạy tuần tự ~120s; nếu chỉ cần check 1 feature thì chạy `node smoke-<x>-test.mjs` riêng với server đã bật `DEV_CHEATS=1`). ECONOMY.md = faucet/sink audit. Project chuẩn hoá **Node 24** (`.nvmrc`, engines >=24, Dockerfile node:24-alpine). Cosmetics: 12, Pets: 9.

**Regression nhanh:** `node run-smoke.mjs` (tự boot server + chạy 14 smoke suite tuần tự có giãn cách + summary + exit code). `--slow` để thêm 2 test persistence. LƯU Ý: đừng chạy nhiều smoke test dồn dập cùng lúc — gây "websocket error" false-negative; dùng runner. Khi thêm reward (gem/gold) vào hệ thống cũ, nhớ chạy runner để bắt test có assertion gem/gold bị lệch.

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
- **Marketplace v2 (Sprint 59):** tab Chợ có tìm theo tên + lọc theo loại (equip/consumable/material) + sort (featured/newest/price/rarity). Helper thuần `filterListings`/`sortListings` trong shared/marketplace.ts (unit-test được, không cần server). **Tin nổi bật** (`featureMarketListing`, 30💎/48h) ghim listing lên đầu chợ kèm ✨ — Gem sink mới. `marketView` sort featured-first server-side. E2E: `node smoke-market59-test.mjs` (9 unit helper + 5 e2e)
- **Guild leaderboard (Sprint 60):** BXH guild toàn server, sort theo level desc → exp desc, top 20, hiện trong modal guild (cả khi chưa có guild) kèm 🥇🥈🥉 + highlight guild mình. `requestGuildLeaderboard` khi mở modal; auto broadcast sau mọi guild level-up. E2E: `node smoke-guild-rank-test.mjs` (7 checks)
- **Daily login streak (Sprint 61):** lịch điểm danh 7 ngày, thưởng tăng dần (200g…ngày7 100💎 jackpot), ngày liên tiếp +1, lỡ 1 ngày reset về 1. Hotkey **L**. Logic chuỗi tách thành hàm thuần `computeStreakClaim`/`streakRewardFor`/`dateKeyAddDays` trong shared/dailyStreak.ts (unit-test kỹ theo ngày, không cần fake clock). Persist `loginStreak`+`streakLastClaimDate`. Tách biệt với daily-gem 20h và VIP daily. E2E: `node smoke-streak-test.mjs` (12 unit + 5 e2e)
- **Titles (Sprint 62):** 10 danh hiệu derived từ stat (level/kills/gold/guild/VIP/streak/cosmetics) trong shared/titles.ts. Hotkey **T** mở modal gắn/bỏ; «Danh hiệu» hiện cạnh tên ở HUD + trên đầu nhân vật cho mọi người thấy (`displayName` = title + [TAG] + name). Chỉ persist `activeTitle` (titles tự suy từ stat). Hàm thuần `earnedTitles`/`isTitleEarned` unit-test. E2E: `node smoke-titles-test.mjs` (9 unit + 6 e2e)
- **Pets (Sprint 63):** 6 linh thú (shared/pets.ts), mua bằng vàng (slime/wolf/owl) hoặc Gem (spirit/drake/phoenix), buff thụ động atk/def/hp. `recomputePetBonus` mirror `recomputeSetBonus` (subtract-old/add-new). **QUAN TRỌNG:** petBonus* fields ĐƯỢC persist (khác set-bonus) nên relogin không double-count — recompute CHỈ chạy khi đổi pet, không chạy lúc login. Orb nhỏ đi theo player (Phaser arc tinted). Hotkey **P**. E2E: `node smoke-pets-test.mjs` (14 checks gồm swap + relog no-double-count).
- **Set-bonus relogin fix (Sprint 64):** sửa bug double-count — `setBonus*` bake vào stats lưu nhưng KHÔNG persist, nên sau login reset 0 và lần equip kế tiếp cộng lại không trừ (giữ bonus sau khi tháo set). Đã persist `setBonusAttack/Defense/MaxHp`. `devGrantItem` mở rộng nhận `slot`/`themeId`/`stats` để test. E2E: `node smoke-setbonus-test.mjs` (equip→relog→unequip về base).
- **Season 2 content (Sprint 69):** +5 cosmetics (skin-rose/jade-storm/obsidian-gold, skill-fx-ember/void) → 12 total; +3 pets (kirin epic-gem, turtle epic-gem tank, cat rare-gold) → 9 total. Skin tint tự hoạt động (client `cosmeticSkinTint` đọc từ catalog). Gem-priced entries tự vào pool gacha. E2E: `node smoke-content2-test.mjs` (8 checks). Lưu ý: stale test fix — pets-test gem assertion phải tính +10 beast-tamer (S67).
- **Mystery Box gacha (Sprint 68):** Rương Bí Ẩn 50💎 trong gem shop, roll trọng số 40% vàng/25% gem/25% cosmetic/10% pet; trùng cosmetic/pet → đền 30💎. Hàm thuần `rollMysteryBox(rng)` (rng tiêm vào, unit-test từng nhánh). `MYSTERY_COSMETIC_POOL`/`MYSTERY_PET_POOL` lọc từ catalog gem-priced. E2E: `node smoke-mystery-test.mjs` (6 unit + 4 e2e gồm stress 20 roll).
- **Achievements + rewards (Sprint 67):** 8 thành tựu mới (guild-founder/merchant/big-spender/beast-tamer/beast-master/raid-slayer/devout/titled), `Achievement.reward {gold,gems}` cấp 1 lần khi mở khoá trong `unlockAchievement`. Hook ở createGuild/buyMarketItem(seller+buyer)/buyPet/grantPetXp(L5)/resolveGuildRaid/claimLoginStreak/setActiveTitle. Idempotent (không thưởng 2 lần). E2E: `node smoke-achv-test.mjs` (9 checks).
- **Guild raid boss (Sprint 66):** Hội Trưởng/Sĩ Quan triệu hồi boss co-op (HP theo cấp guild, 5 phút, có cooldown), thành viên bấm Tấn công (dmg = attack, cd 1s), thanh máu chung realtime trong guild modal. Hạ → chia vàng theo % sát thương + top contributor +20💎 + guild EXP. Raid ephemeral in-memory (`guildRaids` map), expire qua `updateGuildRaids` trong tick. E2E: `node smoke-raid-test.mjs` (11 checks).
- **Pet leveling (Sprint 65):** linh thú lên cấp tối đa 5, mỗi cấp +25% buff. Cho ăn (vàng 500/50xp) hoặc bánh thưởng (Gem 30/250xp) cho pet đang trang bị. XP lưu per-pet trong `petXp` map (persist). `recomputePetBonus` dùng `petBuffAtLevel` scale theo cấp; re-scale khi level-up (subtract-old/add-new → không double-count qua relogin). Hàm thuần `petLevelForXp/petBuffAtLevel/petXpProgress` unit-test. Thanh XP + nút cho ăn/bánh trong modal P. E2E: `node smoke-petlevel-test.mjs` (7 unit + 9 e2e).
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
| Guild Boost | 200 | 48h +10% EXP cho cả guild (Sprint 57) |
| Featured listing | 30 | Ghim tin chợ lên đầu 48h (Sprint 59) |
| Daily streak ngày 3/5/7 | faucet | +20/40/100 Gem theo chuỗi điểm danh (Sprint 61) |
| Pet (gem) | 150-300 | Linh Hồ/Tiểu Long/Phượng Hoàng (Sprint 63) |
| Pet treat | 30 | Bánh thưởng +250 XP nuôi pet lên cấp (Sprint 65) |
| Mystery Box | 50 | Gacha vàng/gem/cosmetic/pet (Sprint 68) |

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
