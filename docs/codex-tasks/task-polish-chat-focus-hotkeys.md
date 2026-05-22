# Polish — Suppress game hotkeys while the chat input is focused

> Quick polish (slot in anytime). Read AGENTS.md first. Keep the server authoritative.

## Goal

Game keys (WASD movement, Q potion, E/R skills) currently fire even while the player is typing in the chat box, so typing words like "reward" can trigger skills/potions and move the character. Suppress game input while a text field is focused.

## Context files

- `client/src/game/GameScene.ts` — `update()` reads `this.cursors` every frame and handles `JustDown` for Q/E/R; `enableGameKeyboard`/`disableGameKeyboard` already exist and are used for the login overlay.
- `client/index.html` — `#chat-input` text field.

## Requirements

- While a text input/textarea (in particular `#chat-input`) is focused, do not process game movement or the Q/E/R hotkeys. Resume normal input when it loses focus.
- Prefer a robust approach: either toggle Phaser keyboard handling on the chat input's `focus`/`blur` events, or in `update()` skip game input when `document.activeElement` is an editable field. Make sure movement fully stops while typing (no stuck keys).
- Do not break the existing login-overlay keyboard handling.

## DO NOT

- Do not change any gameplay constants or server logic.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Typing in the chat box never moves the character or triggers Q/E/R.
- [ ] After sending a chat message / clicking back into the game, WASD/Q/E/R work normally again.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test (type a message containing w/a/s/d/q/e/r and confirm nothing happens in-game).
