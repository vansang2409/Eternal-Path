# Task 1.3 — HP potions + town vendor (consumables)

> Sprint 1 · Priority 3. Read AGENTS.md first. Keep the server authoritative.

## Goal

The shop sells equipment only; there are no consumables and no way to heal outside town, which caps how deep the player can farm. Add HP potions sold by the town vendor, plus a "use potion" action, with persistence.

## Context files

- `shared/src/types.ts` — `Item`, `ItemStats`, `InventoryState`, socket contracts.
- `shared/src/loot.ts` — `createShopStock`.
- `server/src/game/GameWorld.ts` — `buyShopItem`, `isInTown`, `repository.save`, player stats.
- `server/src/db/PlayerRepository.ts` — inventory persistence.
- `client/src/ui/hud.ts` — inventory + shop UI.

## Requirements

- Introduce a consumable concept. Simplest: add a discriminator to the shared `Item` type (e.g. `kind: "equipment" | "consumable"`), with a consumable carrying a `heal` amount. Default existing items to `"equipment"` so nothing breaks.
- Add at least two HP potions to the town shop stock (e.g. Minor Potion / Major Potion) priced in gold.
- Buying a potion follows the same rules as equipment: must be in town (reuse `isInTown`), enough gold, item goes to inventory, save afterwards.
- Add a "use potion" action from the inventory UI (button + a hotkey, e.g. `Q` for the first potion). Use a new typed socket event (e.g. `useItem: (payload: { itemId: string }) => void`).
- Server handles `useItem`: validate the item is a consumable in the player's inventory, heal by the potion's `heal` amount capped at `maxHp`, remove one potion, emit updated player + a floating heal text, then save.
- Potions must persist across relog. Extend `PlayerRepository` so consumables save/load correctly (including the new fields).
- Show potions in the inventory grid distinctly from equipment, with a tooltip showing heal amount.

## DO NOT

- Do not let healing exceed `maxHp`.
- Do not allow buying potions outside town.
- Do not allow equipping a consumable into an equipment slot.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Can buy potions in town; blocked outside town.
- [ ] Using a potion mid-fight heals the correct amount, never exceeds `maxHp`, count drops by 1.
- [ ] Remaining potions persist after relogging in.
- [ ] Cannot equip a consumable into an equipment slot.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test buying, using, and persistence.
