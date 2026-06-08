# Eternal Path — Economy Audit (Sprint 76)

Mục tiêu: game kiếm tiền, nên hai loại tiền tệ phải cân bằng — **Vàng (gold)** là tiền chơi, **Gem (💎)** là tiền premium. Tài liệu này liệt kê mọi **faucet** (nguồn tạo ra) và **sink** (nơi tiêu hủy/khóa) để tránh lạm phát và phát hiện vòng lặp lời vô hạn.

## Vàng (gold)

### Faucet (tạo vàng)
- Giết quái: `killMonster` → `goldForMonster` × (VIP 1.2 nếu VIP) × (1 + guild goldBonus theo cấp, tối đa +18%).
- Hoàn thành quest: `rewardGold` mỗi quest.
- Offline rewards (AFK zone) theo thời gian vắng (cap 8h).
- Rương kho báu / loot bán lại.
- Daily login streak (S61): ngày 1/2/4/6 = 200/400/600/1000 vàng.
- Thành tựu (S67): merchant +500, big-spender +300, titled +200, founder... (gem) — **một lần duy nhất** mỗi account.
- Guild Raid (S66): khi hạ boss, chia `maxHp × 0.15` vàng cho người đóng góp. **Faucet mới đáng theo dõi** — nhưng có chặn: tốn 2000 vàng quỹ để triệu hồi (S73) + cooldown 5 phút + giới hạn bởi sát thương người chơi.
- Mystery Box (S68): nhánh gold 1000–5000 (mua bằng 50💎 → đây là gold faucet đổi từ gem).

### Sink (hủy/khóa vàng)
- Mua đồ ở shop, bình máu.
- Crafting (gián tiếp qua nguyên liệu).
- Lập guild: −5000 (S56).
- Góp guild EXP (S57): vàng → EXP guild, **không lấy lại được** (sink thực).
- **Phí chợ 5%** (S58): mỗi giao dịch đốt 5% giá → sink chính của nền kinh tế người chơi.
- Nuôi pet (S65): −500 vàng/lần cho ăn.
- Quỹ guild (S72): gửi vào (khóa, chỉ leader rút) + triệu hồi raid đốt 2000 (S73).
- Respawn/chết (nếu có phí) — không.

**Đánh giá vàng:** có sink mạnh (phí chợ 5%, góp guild, lập guild, nuôi pet, raid summon). Faucet raid được kiểm soát bằng chi phí quỹ + cooldown. Không phát hiện vòng lặp lời vô hạn: marketplace là zero-sum giữa người chơi TRỪ ĐI 5% (giảm phát). Mystery box gold đến từ gem (chuyển dịch, không tạo gold tự do trừ khi gem là free).

## Gem (💎)

### Faucet (tạo gem)
- Daily gem 20h cooldown: +8 (free).
- VIP daily: +30/ngày (cần VIP — đã trả gem/tiền để có VIP).
- Daily login streak (S61): ngày 3/5/7 = 20/40/100 💎.
- Thành tựu (S67): guild-founder +20, beast-tamer +10, beast-master +30, raid-slayer +25, devout +15 — **một lần duy nhất**.
- Guild Raid top contributor (S66): +20 💎/lần hạ boss (giới hạn cooldown + chi phí quỹ).
- Mystery Box (S68): nhánh gems 20–60, hoặc trùng cosmetic/pet → +30 💎 đền.

### Sink (tiêu gem)
- Cosmetics (S45+, 12 món): 90–320.
- Battle Pass Premium: 500.
- VIP: 80/280/700.
- Guild Boost (S57): 200.
- Pet (gem): 150–300 (6 con gem).
- Pet treat (S65): 30/lần.
- Featured listing (S59): 30.
- Mystery Box (S68): 50/lần.

**Đánh giá gem:** sink phong phú (cosmetic, VIP, BP, pet, boost, gacha). Faucet free gem nhỏ giọt (8/ngày + streak + thành tựu một lần) → khuyến khích mua gem thật (đúng mục tiêu kiếm tiền). Gacha (50💎) có thể trả ra 20–60 gem hoặc đền 30 → **giá trị kỳ vọng < 50** (gold 40% + cosmetic/pet 35% + gems trung bình ~40×25% = 10) nên là sink ròng, không phải máy in gem. ✅

## Vòng lặp lời vô hạn — kiểm tra
- Marketplace: người mua mất X, người bán nhận 0.95X → hệ thống −0.05X. Không lời. ✅
- Mystery box: chi 50💎, EV < 50💎. ✅
- Guild raid: faucet vàng+gem nhưng tốn 2000 quỹ + cooldown 5' + giới hạn DPS; không thể spam. ✅ (theo dõi nếu guild đông + DPS cao có thể là faucet vàng đáng kể — cân nhắc tăng chi phí summon theo cấp guild ở sprint sau.)
- devGrant/devGrantItem: **chỉ bật khi `DEV_CHEATS=1`** (không có trong Docker/compose) → an toàn production. ✅

## Khuyến nghị tương lai
1. Raid: cân nhắc chi phí summon scale theo cấp guild (cao cấp → reward cao → cost cao) để khóa faucet.
2. Thêm gold sink cuối game (vd: nâng cấp trang bị tốn nhiều vàng) khi người chơi cấp cao dư vàng.
3. Theo dõi tổng gem free/ngày (8 + streak trung bình ~ +10 + thành tựu một lần) so với giá gói VIP để tinh chỉnh động lực mua.
