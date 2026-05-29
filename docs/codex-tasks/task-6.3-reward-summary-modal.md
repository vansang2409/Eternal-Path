# Task 6.3 — Offline reward summary modal

> Sprint 6 · Priority 3. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

When the server emits `offlineRewards` on login (Task 6.2), show the player a clear summary modal: time elapsed, EXP gained, gold gained, with a "Close" button to start playing.

## Context files

- `client/src/game/GameScene.ts` — handler for the `offlineRewards` event.
- `client/src/ui/hud.ts` — add a method like `showOfflineRewards(payload)`.
- `client/index.html` — modal markup, hidden by default.
- `client/src/styles.css` — modal styles (dim backdrop, centered card).
- `client/src/i18n.ts` — strings for title, fields, close button, capped notice.

## Requirements

- Add a modal in the DOM (hidden by default) with: localized title "Phần thưởng AFK" / "AFK Rewards", a line showing elapsed time formatted as e.g. "2h 14m" / "2h 14m", a line for `+X EXP`, a line for `+Y gold`, a small subtle line shown only when `cappedAtMax` is true (e.g. "Đã đạt giới hạn 8 giờ"), and a "Đóng" / "Close" button.
- On `offlineRewards`: HUD reveals the modal and fills the values. The modal stays open until the close button is clicked.
- Do not show the modal if the server did not send the event (e.g. brand-new character or quick reconnect).
- Do not freeze input handling permanently; closing the modal returns to normal play. While the modal is open, ignoring game hotkeys is acceptable (you can leverage the existing `isEditableFocused`-style suppression or add an explicit guard).

## DO NOT

- Do not grant or compute rewards on the client; only render what the server sent.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] After receiving `offlineRewards`, the modal appears with correct elapsed time, EXP, and gold.
- [ ] The "cap" line appears only when `cappedAtMax` is true.
- [ ] Clicking close dismisses the modal and the player can play normally.
- [ ] No modal appears when there are no offline rewards.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, briefly explain how to test (relog after a simulated offline period).
