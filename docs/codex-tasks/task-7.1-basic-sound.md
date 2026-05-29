# Task 7.1 — Basic sound effects (Web Audio)

> Sprint 7 · Priority 1. Read AGENTS.md first.

## Goal

Add simple programmatic sound effects to make combat and rewards feel impactful. Use the browser-built-in Web Audio API only — no new dependencies and no audio asset files.

## Context files

- `client/src/main.ts` or a new `client/src/sound.ts` — small SoundManager module (AudioContext + helpers).
- `client/src/game/GameScene.ts` — trigger sounds on existing client events (`floatingText` damage, `loot`, level-up floating text, modal open, skill use).
- `client/src/ui/hud.ts`, `client/index.html`, `client/src/i18n.ts`, `client/src/styles.css` — mute toggle in the HUD.

## Requirements

- Create a `SoundManager` that lazily initializes an `AudioContext` (browsers require a user gesture; init on first login click or first interaction). Persist a `muted` preference in `localStorage`.
- Implement 4–5 short effects with `OscillatorNode` + `GainNode` envelopes — no asset files:
  - `hit` (short blip on player attack landing damage on a monster — listen on `floatingText` with kind `"damage"` where `entityId` matches a monster).
  - `levelUp` (rising chord on `kind === "level"`).
  - `loot` (chime on `loot` event with item present).
  - `skill` (distinct tone for `E`/`R` skill presses).
  - `modalOpen` (gentle ding when the AFK rewards modal appears).
- Keep effects short (< 250 ms) and at modest volume so they don't fatigue the player.
- Add a mute toggle button in the HUD (e.g. in the player panel header), localized VI/EN ("Tắt tiếng"/"Mute"); the icon/label reflects state.
- Suspend the AudioContext while muted to save CPU.

## DO NOT

- Do not add npm dependencies or external audio files.
- Do not play sounds before the first user gesture (browsers will block it).
- Do not change server behavior; sounds are pure client presentation.

## Acceptance criteria

- [ ] Attacking a monster, looting, leveling up, using a skill, and opening the AFK modal each play a distinct, short sound.
- [ ] A HUD button mutes/unmutes all sounds; the preference persists across reload.
- [ ] No new npm dependencies.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, briefly explain how to test.
