# Sprint 8 — World Map Generator

**Mục tiêu**: thay map hardcode 4 tile bằng hệ thống procedural sinh ra world 128×80 (hoặc lớn hơn) gồm nhiều biome khác nhau với collision đúng nghĩa MMO.

## Quyết định kiến trúc (đã chốt với chủ dự án)

- **Generator**: procedural (deterministic seed), code thuần — không cần editor ngoài.
- **Cấu trúc**: một world seamless duy nhất, không split scene.
- **Biome**: cỏ, đường, rừng, núi đá, **nước (sông/hồ)**, **cát**, **tuyết**, **đầm lầy**, **dungeon (floor/wall)**, town, deep.
- **Collision**: có — tile nước/núi/tường chặn nhân vật; server validate movement chống cheat.

## Phạm vi & deliverables

### Shared (`shared/src/`)
- `world/biomes.ts` mới: enum `BiomeId`, `TileId`, hằng số `WALKABLE_TILES`, `BIOME_INFO` (màu hiển thị HUD, level gợi ý).
- `world/mapGen.ts` mới: hàm `generateWorld(seed, width, height): WorldMap` trả về:
  - `tiles: TileId[][]` — biome cho từng ô.
  - `walkable: boolean[][]` — derived collision mask.
  - `landmarks: { town: Vec2; dungeons: Vec2[] }` — vị trí town/dungeon entrance.
  - `spawns: { zone: BiomeId; position: Vec2 }[]` — gợi ý nơi đặt quái cho server.
- Thuật toán đề xuất: 2 lớp noise (elevation + moisture) → tra bảng biome (Whittaker-style). Carve sông từ ô elevation cao xuống thấp. Đặt town ở góc top-left (giữ spawn 7,7). Đặt 2-3 dungeon cluster ở vùng deep.
- Hằng số `WORLD_SEED = 1337` (sửa được). Cùng seed → cùng map deterministic.

### Server (`server/src/game/`)
- Khi `GameWorld` khởi tạo: gọi `generateWorld(...)`, lưu `this.worldMap`.
- Phân phối lại 22 spawn quái hiện tại theo biome (giữ ID monster cũ, nhưng đặt `tx/ty` lấy từ `worldMap.spawns`). Quái cấp thấp ở grass/forest, cao ở mountain/deep/dungeon.
- Thêm `validateMovement(from, to)`: nếu `walkable[ty][tx]` = false → revert vị trí player.
- Emit `worldMap` (chỉ `tiles` + `walkable`) khi player login lần đầu (qua `init` snapshot). Đừng gửi mỗi tick.

### Client (`client/src/game/`)
- `assets.ts`: thêm pixel art cho mỗi tile mới (water, sand, snow, swamp, rock, dungeonFloor, dungeonWall) — 32×32, 4-8 màu mỗi tile, có pattern dither nhẹ cho khỏi đơn điệu.
- `GameScene.createMap()`: thay vòng for hardcode → đọc `worldMap.tiles` từ snapshot, render Phaser tilemap.
- Camera bounds vẫn `WORLD_WIDTH * TILE_SIZE`. Không thay player follow.
- Client-side collision prediction (optional cho mượt): khi player local kéo move target, nếu đường đi xuyên qua tile cản → tự dừng trước tile cản.
- Zone label auto-place: tìm cluster lớn nhất của mỗi biome (flood-fill) → đặt nhãn ở centroid.

## Chia task cho Codex

### Task 8.1 — Tile/biome + generator (shared)
Implement `world/biomes.ts` và `world/mapGen.ts`. Output deterministic, có unit test (vd cùng seed → cùng tiles[0][0]). Chưa đụng server/client.

**Acceptance**:
- `generateWorld(1337, 128, 80)` chạy <500ms, trả về 128×80 tiles.
- Town landmark ở (7,7) tile, walkable.
- Có ít nhất 4 biome khác cỏ xuất hiện ≥ 5% diện tích mỗi loại.
- Không có ô "đảo cô lập" walkable bị nhốt hoàn toàn bởi vật cản (flood-fill từ town phải reach ≥ 70% walkable tiles).

### Task 8.2 — Server tích hợp + collision validation
GameWorld dùng `generateWorld()`. Validate movement server-side. Phân phối lại 22 monster spawn theo biome. Snapshot `init` kèm `worldMap` (tiles + walkable).

**Acceptance**:
- Restart server: world giống hệt lần trước (deterministic).
- Player cố đi vào nước → server kéo lại vị trí cũ + emit system message "Không thể đi qua".
- Mỗi biome có ≥ 1 spawn quái phù hợp cấp.

### Task 8.3 — Client tilemap + pixel art + zone labels
Thêm pixel art mới. `createMap()` đọc từ snapshot. Tilemap render đầy đủ biome. Zone label auto-place. Client-side collision predict.

**Acceptance**:
- Render world 128×80 không drop FPS.
- Mỗi biome có sprite riêng dễ phân biệt.
- Đi vào nước/núi: player tự dừng trước tile cản (không lag-rubber-band).
- Có ≥ 5 nhãn vùng tự đặt (town + 4 biome lớn nhất).

## Rủi ro & note
- Network payload `init` sẽ tăng (~10KB cho 128×80 tiles). Có thể bitpack sau nếu cần.
- Pixel art mới: ưu tiên minimal/pastel để khỏi loè mắt; không cần sprite chi tiết.
- Monster respawn coord hiện tại trong server không thay đổi shape — chỉ cần thay (tx,ty) bằng coord mới từ `worldMap.spawns`.
- Town giữ ở góc trên-trái để không phá saved player position cũ.
