# AGENTS.md — Eternal Path / Linh Vực

Hướng dẫn cho coding agent (Codex) khi làm việc trong repo này.

## Bối cảnh dự án

2D browser MMORPG prototype. Stack: Phaser 3 + Vite + TypeScript (client), Node + Express + Socket.IO + TypeScript (server), npm workspaces `client` / `server` / `shared`, PostgreSQL với in-memory fallback khi không có `DATABASE_URL`.

Thước đo dẫn đường: **"làm prototype khiến chính mình muốn farm thêm 5 phút."**

## Nguyên tắc bắt buộc

- Gameplay loop quan trọng hơn đồ họa. Chỉ dùng asset placeholder.
- Server luôn authoritative: client KHÔNG tự quyết damage, loot, kill, hay vị trí cuối cùng.
- Làm từng lát mỏng chạy được. Không viết lại toàn bộ hệ thống khi không được yêu cầu.
- KHÔNG PvP phức tạp. KHÔNG blockchain/NFT. Giữ map nhỏ.
- KHÔNG thêm dependency npm / CDN nếu không thực sự cần và chưa được duyệt.
- Code modular, dễ refactor. Logic dùng chung đặt ở `shared/`.

## Định nghĩa "xong" (Definition of Done)

- `npm run typecheck` và `npm run build` đều pass.
- Tính năng chạy được ở chế độ in-memory (không cần Postgres).
- Test tay theo acceptance criteria của task trước khi báo xong.
- Một task = một commit. Message tiếng Anh, prefix `feat:` / `fix:` / `perf:` / `refactor:` / `docs:`.
- KHÔNG commit `node_modules`, `dist`, log, hay `.env`.

## Nguồn task & ưu tiên

- Kế hoạch & ưu tiên hiện hành: `docs/dev-plan.md`.
- Task cụ thể để implement: `docs/codex-tasks/` (mỗi file một task, đã có Requirements + DO NOT + acceptance).
- Bối cảnh nền: `docs/session-handoff.md`, `docs/development-notes.md`, `docs/changelog.md`.

Khi được giao "implement docs/codex-tasks/<file>", đọc file đó + các file context nó liệt kê, rồi làm đúng phạm vi, không mở rộng ngoài DO NOT.

## File quan trọng

- `client/src/game/GameScene.ts` — Phaser scene, input, render, socket events.
- `client/src/ui/hud.ts` — HUD, inventory, equipment, shop, chat.
- `server/src/game/GameWorld.ts` — world loop authoritative, combat, monster, shop, chat.
- `server/src/db/PlayerRepository.ts` — persistence Postgres + memory fallback.
- `shared/src/types.ts` — socket contracts & state types.
- `shared/src/formulas.ts` — hằng số & công thức (movement, EXP, damage).
- `shared/src/loot.ts` — sinh item, value, shop stock.
- `shared/src/monsters.ts` — catalog quái.
