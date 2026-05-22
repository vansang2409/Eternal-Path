# Linh Vực / Eternal Path — Kế hoạch phát triển (Dev Plan)

> Vai trò: Claude = quản lý phát triển (lên ý tưởng, ưu tiên, viết brief). Codex = người implement.
> Tài liệu này là nguồn ưu tiên hiện hành. Đọc sau `docs/session-handoff.md`.
> Cập nhật lần cuối: 2026-05-22.

---

## 1. Mục tiêu sản phẩm

Thước đo dẫn đường (giữ nguyên tinh thần gốc):

> **"Làm prototype khiến chính mình muốn farm thêm 5 phút."**

Mọi quyết định ưu tiên đều quy về câu hỏi: *việc này có làm vòng farm → loot → lên cấp đã tay hơn không?* Nếu không, đẩy xuống backlog.

Nguyên tắc bất di bất dịch (kế thừa từ development-notes):

- Gameplay loop quan trọng hơn đồ họa. Asset placeholder là đủ.
- Làm từng lát mỏng chạy được (thin playable slice), không làm game hoàn chỉnh một lần.
- Không PvP phức tạp. Không blockchain/NFT. Map nhỏ tới khi loop đủ đã.
- Code modular, dễ refactor. Server vẫn là authoritative.

---

## 2. Quy trình quản lý ↔ Codex

Mỗi đầu việc Claude giao sẽ gồm 4 phần:

1. **Bối cảnh & lý do** — vì sao làm, đụng vào đâu trong code.
2. **Brief Codex** — khối ```text``` viết bằng tiếng Anh, paste thẳng cho Codex. Có `Requirements` và `DO NOT`.
3. **Acceptance criteria** — checklist nghiệm thu.
4. **Docs** — cập nhật `changelog.md` / `roadmap.md` sau khi xong.

**Definition of Done cho mọi task:**

- `npm run typecheck` và `npm run build` đều pass.
- Tính năng chạy được ở chế độ in-memory (không cần Postgres).
- Không thêm dependency nặng/CDN nếu không có lý do.
- Server vẫn authoritative (client không tự quyết damage/loot/vị trí cuối).
- Test tay theo acceptance criteria trước khi đánh dấu xong.

**Quy ước commit:** mỗi task một commit, message tiếng Anh, prefix theo loại: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`.

---

## 3. Roadmap đã sắp lại theo sprint

| Sprint | Chủ đề | Vì sao ở đây |
|--------|--------|--------------|
| **S1** | Game feel — vòng farm đã tay | Đang là điểm yếu lớn nhất; ảnh hưởng mọi giây chơi |
| **S2** | Sống sót & kinh tế | Cho phép farm sâu hơn, lâu hơn; tạo chỗ tiêu vàng |
| **S3** | Persistence & tài khoản | Giữ tiến trình thật, chuẩn bị cho người ngoài chơi |
| **S4** | Xã hội (guild/party) | Giữ chân người chơi, tạo lý do quay lại |
| **S5** | Idle/AFK layer | Đúng định vị "idle MMO nhẹ" |
| **S6** | Nội dung thế giới (zone/boss/market) | Mở rộng khi loop đã vững |

Tài liệu này đặc tả chi tiết **Sprint 1**. Các sprint sau sẽ được bóc tách thành brief khi S1 gần xong (tránh kế hoạch lỗi thời).

---

## 4. SPRINT 1 — "Vòng farm đã tay"

Mục tiêu sprint: sau sprint này, đứng farm 3–4 con quái liên tục phải thấy **mượt, rõ mục tiêu, và không phải click lại liên tục**.

3 task, làm tuần tự theo thứ tự ưu tiên dưới đây.

---

### Task 1.1 — Netcode mượt (interpolation + client prediction)

**Bối cảnh & lý do.** Server bắn `snapshot` ở `SNAPSHOT_RATE = 10` (`server/src/game/GameWorld.ts`). Client `GameScene.applySnapshot()` set thẳng vị trí sprite → ngay cả nhân vật của mình cũng nhảy theo bước ~100ms, dù input gửi ở 60fps. Đây là lỗi "feel" lớn nhất. Cần nội suy entity ở quá khứ gần và dự đoán nội bộ cho nhân vật mình.

```text
Improve client netcode in the Eternal Path MMORPG so movement looks smooth. Keep the server fully authoritative.

Context files:
- server/src/game/GameWorld.ts (SNAPSHOT_RATE constant, broadcastSnapshot, WorldSnapshot.serverTime)
- client/src/game/GameScene.ts (applySnapshot, renderPlayer, renderMonster, update loop)
- shared/src/formulas.ts (PLAYER_SPEED, clampToWorld, TILE_SIZE, world bounds)
- shared/src/types.ts (WorldSnapshot has serverTime)

Requirements:
- Raise SNAPSHOT_RATE from 10 to 15 in GameWorld.ts. Keep TICK_RATE at 20.
- On the client, keep a small buffer of the last few snapshots with their serverTime.
- Render REMOTE entities (other players and all monsters) using entity interpolation: draw them ~100 ms in the past, lerping position between the two surrounding buffered snapshots. No more instant teleport between snapshots.
- For the LOCAL player, add client-side prediction: each frame, move the local sprite immediately using the same input + PLAYER_SPEED + clampToWorld logic from @mmorpg/shared (mirror the server's updatePlayers math so prediction matches).
- Reconcile the local player against the server position from snapshot/`player` events: if the gap is small, smoothly lerp toward the server position; if the gap is large (e.g. > 64 px, after a death/teleport), snap to it.
- Make name labels, HP bars, equipment overlays, and monster labels follow the interpolated/predicted positions (not the raw snapshot positions).
- Keep the HUD updates (stats, EXP) driven by the authoritative `player` event as today.

DO NOT:
- Do not move combat, loot, damage, or final position authority to the client.
- Do not add new npm dependencies.
- Do not change the socket event contract in shared/src/types.ts (serverTime already exists).
- Do not introduce large maps or change gameplay constants other than SNAPSHOT_RATE.

After implementing, run `npm run typecheck` and `npm run build`, then explain how to test smoothness locally.
```

**Acceptance criteria.**

- [ ] Nhân vật của mình di chuyển mượt 60fps, không còn giật bước ~100ms.
- [ ] Người chơi khác và quái trôi mượt giữa các vị trí, không "nhảy cóc".
- [ ] Sau khi chết/bị đưa về town, vị trí vẫn nhảy đúng về town (snap), không rubber-band lê dài.
- [ ] Combat/loot không đổi hành vi; server vẫn quyết vị trí cuối.
- [ ] `typecheck` + `build` pass.

---

### Task 1.2 — Panel mục tiêu + auto-retarget

**Bối cảnh & lý do.** Hiện click quái set `player.targetId` (server, `GameWorld.targetMonster`), nhưng HUD (`client/src/ui/hud.ts`) không có panel hiển thị mục tiêu đang chọn. Khi quái chết phải click lại con khác → ngắt mạch farm. Thêm panel mục tiêu rõ ràng và tùy chọn tự động chọn quái gần nhất sau khi giết.

```text
Add a selected-target panel and an optional auto-retarget feature to the Eternal Path MMORPG. Keep the server authoritative for targeting.

Context files:
- client/src/ui/hud.ts (HUD panels; add a target panel here)
- client/src/game/GameScene.ts (knows selfPlayer, monster snapshot data, target highlight)
- server/src/game/GameWorld.ts (targetMonster handler, updateCombat, killMonster, selectedLivingMonster)
- shared/src/types.ts (socket event contracts)

Requirements:
- Add a "Selected Target" panel in the HUD that shows the current target's name, level, and HP as a bar plus numeric "hp / maxHp". Update it live from snapshots. Hide it when there is no living target.
- Add an "Auto-retarget" toggle (checkbox/button) in the HUD, default OFF. Persist the choice in memory for the session (a simple in-page variable is fine; do not require localStorage).
- Send the auto-retarget preference to the server via a new typed socket event (e.g. `setAutoRetarget: (payload: { enabled: boolean }) => void`) added to ClientToServerEvents in shared/src/types.ts. Store it per-player on the server.
- Server behavior when a player's auto-retarget is ON: when their current monster target dies or becomes invalid, automatically select the nearest living monster within 260 px of that player as the new target. If none in range, clear the target.
- Keep manual click-to-target working exactly as before; auto-retarget only kicks in when there is no valid target.

DO NOT:
- Do not auto-target other players (PvP stays fully manual).
- Do not auto-target across the whole map; respect the 260 px radius.
- Do not let the client decide damage or kills; server stays authoritative.
- Do not add new npm dependencies.

After implementing, run `npm run typecheck` and `npm run build`, then explain how to test it.
```

**Acceptance criteria.**

- [ ] Panel mục tiêu hiện tên/level/HP của quái đang chọn, cập nhật real-time, ẩn khi không có mục tiêu.
- [ ] Bật auto-retarget: giết xong tự nhảy sang quái gần nhất trong bán kính, farm không cần click lại.
- [ ] Hết quái trong bán kính thì bỏ chọn (không lỗi).
- [ ] PvP vẫn phải chọn người chơi thủ công.
- [ ] `typecheck` + `build` pass.

---

### Task 1.3 — Bình máu + vendor town (consumables)

**Bối cảnh & lý do.** Shop (`shared/src/loot.ts createShopStock`, `GameWorld.buyShopItem`) chỉ bán trang bị. Chưa có vật phẩm tiêu hao. Không có cách hồi máu ngoài đứng town → farm sâu bị giới hạn. Thêm bình máu tạo khả năng sống sót và một chỗ tiêu vàng.

```text
Add HP potions and a town vendor for consumables to the Eternal Path MMORPG. Keep the server authoritative.

Context files:
- shared/src/types.ts (Item, ItemStats, InventoryState, socket contracts)
- shared/src/loot.ts (createShopStock)
- server/src/game/GameWorld.ts (buyShopItem, isInTown, repository.save, player stats)
- server/src/db/PlayerRepository.ts (inventory persistence)
- client/src/ui/hud.ts (inventory + shop UI)

Requirements:
- Introduce a consumable item concept. Simplest approach: add an item kind discriminator (e.g. `kind: "equipment" | "consumable"`) to the shared Item type, with a consumable carrying a `heal` amount. Default existing items to "equipment" so nothing breaks.
- Add at least two HP potions to the town shop stock (e.g. Minor Potion / Major Potion) priced in gold.
- Buying a potion follows the same rules as equipment: must be in town (reuse isInTown), enough gold, item goes to inventory, save afterwards.
- Add a "use potion" action: from the inventory UI (button + a hotkey, e.g. Q for the first potion). Using a potion is a new typed socket event (e.g. `useItem: (payload: { itemId: string }) => void`).
- Server handles useItem: validate the item is a consumable in the player's inventory, heal the player by the potion's heal amount capped at maxHp, remove one potion from inventory, emit updated player + a floating heal text, then save.
- Potions must persist in inventory across relog (extend PlayerRepository so consumables save/load correctly, including the new fields).
- Show potions in the inventory grid distinctly from equipment, with a tooltip showing heal amount.

DO NOT:
- Do not let healing exceed maxHp.
- Do not allow buying potions outside town.
- Do not allow equipping a consumable into an equipment slot.
- Do not add new npm dependencies.

After implementing, run `npm run typecheck` and `npm run build`, then explain how to test buying, using, and persistence.
```

**Acceptance criteria.**

- [ ] Mua được bình máu trong town; ngoài town thì bị chặn.
- [ ] Dùng bình giữa trận hồi đúng lượng máu, không vượt maxHp, số lượng giảm 1.
- [ ] Bình máu còn lại sau khi đăng nhập lại (persistence).
- [ ] Không equip nhầm bình vào ô trang bị.
- [ ] `typecheck` + `build` pass.

---

## 4b. SPRINT 2 — "Giữ cho vòng farm bền và đã"

Trạng thái: **brief sẵn sàng** trong `docs/codex-tasks/`. Sprint 1 đã xong (mọi task review PASS).

Bối cảnh: sau Sprint 1, farm đã liền mạch (auto-retarget) nên loot đổ về nhanh → cần quản lý túi + tăng cảm giác thưởng, đồng thời vá nốt điểm an toàn town.

| Task | File brief | Tóm tắt |
|------|-----------|---------|
| 2.1 | `task-2.1-inventory-capacity-sell-junk.md` | Giới hạn 30 ô túi + nút "bán đồ rác" (chỉ bán đồ Common, giữ bình & Rare/Epic) trong town; hiện số ô đang dùng |
| 2.2 | `task-2.2-rare-drop-announcements.md` | Thông báo toàn server khi ai đó rớt đồ Rare/Epic; log loot tô màu theo độ hiếm |
| 2.3 | `task-2.3-town-safezone-guard.md` | Quái không target/đánh người trong town; bỏ aggro khi mục tiêu vào town (quick win, vá watchlist) |

Acceptance criteria chi tiết nằm trong từng file. Quy trình review giữ nguyên như Sprint 1: xem diff → đối chiếu acceptance → typecheck/build → ghi changelog → commit.

---

## 4c. SPRINT 3 — "Thế giới sâu hơn & phần thưởng lớn"

Trạng thái: **brief sẵn sàng** trong `docs/codex-tasks/`. Sprint 1 & 2 đã xong (mọi task review PASS).

Bối cảnh: vòng farm đã mượt và bền (Sprint 1+2) → giờ thêm chiều sâu nội dung và lý do cày tiếp, tận dụng hệ thống thông báo loot vừa làm.

| Task | File brief | Tóm tắt |
|------|-----------|---------|
| 3.1 | `task-3.1-elite-monsters.md` | Quái tinh anh (~15%): mạnh hơn, khác hình, EXP/vàng & droprate cao hơn, loot tối thiểu Rare |
| 3.2 | `task-3.2-world-boss.md` | World boss spawn theo timer, thông báo toàn server lúc xuất hiện & bị hạ, thưởng lớn + đồ hiếm |
| 3.3 | `task-3.3-deep-zone-labels.md` | Gom spawn theo độ khó + nhãn vùng trên bản đồ (Town / giữa / vùng sâu), tạo cảm giác tiến triển |

Acceptance criteria chi tiết trong từng file. Quy trình review giữ nguyên: xem diff → đối chiếu acceptance → typecheck/build → ghi changelog → commit.

Sau Sprint 3, **Sprint 4** dự kiến quay lại nền tảng: lưu vị trí nhân vật, session/mật khẩu thay email-only, và giảm churn ghi DB (các mục trong watchlist).

---

## 4d. SPRINT 4 — "Chiều sâu gameplay"

Trạng thái: **brief sẵn sàng** trong `docs/codex-tasks/`. Sprint 1–3 đã xong (mọi task review PASS).

Bối cảnh: theo lựa chọn của chủ dự án, ưu tiên thêm chiều sâu/nội dung thay vì nền tảng. Nền tảng (lưu vị trí, session/mật khẩu, giảm churn DB) dời sang sprint sau (vẫn trong watchlist).

| Task | File brief | Tóm tắt |
|------|-----------|---------|
| 4.1 | `task-4.1-active-skills.md` | 2 kỹ năng chủ động theo cooldown: Power Strike (E, đơn mục tiêu mạnh), Cleave (R, AoE quanh người); server-authoritative + UI cooldown |
| 4.2 | `task-4.2-quest-board.md` | Bảng nhiệm vụ trong town: kill quest / đạt cấp, theo dõi tiến độ, nhận thưởng vàng + EXP |
| 4.3 | `task-4.3-basic-party.md` | Party cơ bản (tối đa 4): mời/nhận, chia EXP khi ở gần lúc giết quái, panel thành viên; session-only |

Acceptance criteria chi tiết trong từng file. Quy trình review giữ nguyên: xem diff → đối chiếu acceptance → typecheck/build → ghi changelog → commit.

---

## 5. Watchlist nợ kỹ thuật (xử lý ở sprint sau, không quên)

Phát hiện khi review code, chưa cần làm ngay nhưng cần theo dõi:

- **Ghi DB churn:** `PlayerRepository.save` xoá toàn bộ `inventory_items` rồi INSERT lại mỗi lần hành động (kể cả mỗi lần giết quái). Cần chuyển sang ghi delta hoặc throttle save. → Đưa vào **S3**.
- **Town an toàn chưa nhất quán:** vòng quái đánh người không kiểm tra `isInTown` (hiện chỉ an toàn nhờ leash + vị trí spawn). → Thêm guard ở **S2**.
- **Code chết / stat baked-in:** `applyEquipmentStats` trong `shared/src/formulas.ts` không được server dùng; stat trang bị bị "nướng" vào stat đã lưu. Cân nhắc tách base vs bonus. → Cân nhắc ở **S3**.
- **Auth chỉ bằng email:** ai cũng giả mạo được. → **S3** (session/mật khẩu).
- **Lưu vị trí nhân vật:** hiện luôn respawn ở town khi login. → **S3**.

---

## 6. Phác thảo sprint sau (sẽ bóc brief khi tới)

- **S2 — Sống sót & kinh tế:** vendor NPC dạng thực thể trong map, nâng cấp loot notification (announce đồ Epic), guard town cho combat quái, đếm/giới hạn số ô túi.
- **S3 — Persistence & tài khoản:** lưu vị trí, session/mật khẩu thay email, ghi DB theo delta, character select cơ bản.
- **S4 — Xã hội:** guild create/join/leave, tên guild trên đầu nhân vật, party cơ bản.
- **S5 — Idle layer:** chọn vùng AFK, tính EXP/vàng offline, cap 8 giờ, summary khi đăng nhập.
- **S6 — Nội dung:** zone mới, drop table theo họ quái, boss spawn timer, market board, quest board.
