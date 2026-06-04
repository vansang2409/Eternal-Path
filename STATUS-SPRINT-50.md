# Eternal Path — Trạng thái sau Sprint 50

## Mục tiêu thương mại

Hệ thống đầy đủ cho **kiếm tiền**:

| Cột | Trạng thái |
|---|---|
| **Premium currency** (Gem) | ✓ Lưu mỗi player, mua qua daily / battle pass / cosmetic |
| **Cosmetic shop** | ✓ 7 cosmetic (5 skin tints + 2 skill VFX colors) — giá 90-280 Gem |
| **Battle Pass** | ✓ 10 tier, free track + premium track 500 Gem, exp từ kill (5) + quest (80) |
| **Daily login bonus** | ✓ +8 Gem / 20h |
| **Mobile touch controls** | ✓ Virtual joystick + 5 action button (F/Q/W/E/R) tự bật khi detect touch |
| **Anti-cheat cơ bản** | ✓ Input validation, movement speed cap 400px/s, chat length 200 char |
| **Deploy ready** | ✓ Dockerfile + docker-compose + DEPLOY.md, single-port static serve, /health endpoint |
| **Login screen** | ✓ Animated star bg, class preview icons, connection status |
| **Friends + private chat** | ✓ /friend /unfriend /w slash commands, friendList event |
| **Filesystem persistence** | ✓ data/saves.json, survives server restart |

## Roadmap kiếm tiền tiếp theo (gợi ý)

| Mức ưu tiên | Sprint tiếp |
|---|---|
| **Cao** | Tích hợp payment thật (Stripe / VNPay / momo) → bán Gem thành tiền VND |
| **Cao** | Deploy public (Railway/Fly.io) — có URL share được |
| **Cao** | Banner ads + reward video ads (AdSense / AdMob) |
| **Trung** | Battle Pass mùa mới (xoay vòng 1 tháng) |
| **Trung** | Skin sets premium (4-piece, hiệu ứng đặc biệt) |
| **Trung** | VIP subscription (HP regen +10%, exp x1.1, drop x1.1) |
| **Thấp** | Guild system + guild war |
| **Thấp** | Trading / marketplace giữa người chơi |

## Build & Run

```bash
# Dev
npm run dev:server  # localhost:3000
npm run dev:client  # localhost:5173

# Production / Docker
docker compose up -d --build
# Truy cập http://localhost:3000 (single-port deploy)
```

## Endpoint health

`GET http://localhost:3000/health` → `{"ok": true, "uptime": ...}`

## File quan trọng

- `shared/src/cosmetics.ts` — catalog skin & FX
- `shared/src/battlepass.ts` — catalog tier + reward
- `Dockerfile` + `docker-compose.yml` + `DEPLOY.md` — deploy
- `data/saves.json` — persistence
- `STATUS-SPRINT-50.md` — file này

## Tổng commit

51 sprint hoàn thành. Branch `master`. Tất cả push lên `origin`.
