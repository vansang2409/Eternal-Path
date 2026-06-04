# Eternal Path — Trạng thái sau Sprint 55 (cuối)

## Đã thêm trong batch Sprint 44-55 (làm khi user vắng mặt)

### Sprint 44 — Mobile touch controls
Virtual joystick (132×132 góc trái) + 5 action buttons F/Q/W/E/R (góc phải). Tự bật khi detect touch device. Joystick drag → 8-direction movement.

### Sprint 45 — Gem currency + Cosmetic shop
- Gem là currency premium song song với gold
- 7 cosmetic: 5 skin tints (Bích Ngọc / Khói Huyết / Bóng Đêm Xanh / Bóng Tối / Hoàng Kim) + 2 skill FX colors
- Modal "Cửa Hàng Gem" mở qua icon kim cương
- Daily login bonus: +8 Gem / 20h
- "Bóng Tối Vĩnh Hằng" mở khoá qua thành tựu (price 0)

### Sprint 46 — Login screen polish
- Animated star background (2 layers parallax 60s/90s)
- Class preview icons (Warrior/Mage/Ranger) — sell game ngay từ login
- Connection status indicator
- Sub-tagline "Eternal Path"

### Sprint 47 — Deploy ready
- Dockerfile multi-stage build
- docker-compose.yml (commented Postgres section)
- .dockerignore + DEPLOY.md hướng dẫn Railway/Fly.io/Render
- Server giờ serve client/dist static trên cùng port 3000 (single-port deploy)
- `/health` endpoint

### Sprint 48 — Anti-cheat
- Input validation (shape + bounded moveTarget)
- Movement speed cap 480 px/s (sprint + bonuses vẫn dưới ngưỡng)
- Chat message bounded 200 char

### Sprint 49 — Battle Pass
- 10 tiers, exp từ kill (5/mob) + quest (80/quest)
- Free track + Premium track (500 Gem)
- Modal đầy đủ: progress bar, claim buttons, premium banner
- Phần thưởng: gold/gem/material/scroll/title

### Sprint 50 — Friends + Private chat
- /friend, /unfriend, /w <tên> <tin>, /help
- friendList event (online dots 🟢/⚪)
- Private message hiển thị màu tím trong chat

### Sprint 51-52 — Stability
- Fix TDZ ReferenceError trong PlayerRepository
- Audit Sprint 44-50 → 0 bug
- Verify build + restart server

### Sprint 53 — VIP subscription
- 3 gói VIP: 7d / 30d / 90d (80/280/700 Gem)
- Buff: +20% EXP + +20% Gold + 30 Gem/ngày
- Server áp dụng multiplier trong grantExp + killMonster

### Sprint 54 — VIP modal UI
- Modal mua VIP với 3 package
- Status hiển thị (đang active + còn ngày)
- Nút "Nhận 30 💎 hôm nay"
- Badge 🌟 cạnh tên nếu VIP

### Sprint 55 — Currency badge polish
- Hiển thị `100 🪙 50 💎` ngay trong player panel

## Bảng kiếm tiền

| Item | Giá Gem | Notes |
|---|---|---|
| 7 cosmetic | 90-280 | Skin tint + skill FX |
| Battle Pass Premium | 500 | Track premium 10 tier |
| VIP 1 tuần | 80 | +20% buff + 30 Gem/ngày |
| VIP 1 tháng | 280 | Tiết kiệm so với 7d |
| VIP 3 tháng | 700 | Best value, danh hiệu VIP |

Daily Gem income (free path): 8 (daily) + 30 (VIP daily) = 38 Gem/day cho VIP, 8 Gem/day cho free. 1 tuần VIP cost 80 Gem nhưng kiếm lại 210 Gem qua daily → có thể đẩy player vào loop tự đầu tư.

## Build + Run

```bash
# Dev (2 servers)
npm run dev:server
npm run dev:client

# Production (1 server, serves client static)
npm run build
node server/dist/index.js
# Hoặc Docker:
docker compose up -d --build
```

URL: `http://localhost:3000` (production single-port) hoặc `http://localhost:5173` (dev với Vite HMR)

## Tổng commit

55 sprint completed (1-55). 60+ commits trên `master`.

Tất cả pushed lên `origin`.

Server đang chạy tại port 3000 + 5173 (HMR).
