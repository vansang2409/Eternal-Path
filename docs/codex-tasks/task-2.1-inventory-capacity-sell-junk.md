# Task 2.1 — Inventory capacity + "sell all junk" in town

> Sprint 2 · Priority 1. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Now that auto-retarget makes farming continuous, loot piles up fast with no limit. Add a bag capacity and a one-click way to clear junk in town, so the player can keep farming without manually selling one item at a time.

## Context files

- `shared/src/formulas.ts` — good place for an `INVENTORY_CAPACITY` constant.
- `shared/src/types.ts` — `InventoryState`, `Item` (discriminated union: `EquipmentItem | ConsumableItem`), socket contracts.
- `server/src/game/GameWorld.ts` — `killMonster` (loot push), `buyShopItem`, `pickupGroundItem`, `sellItem`, `isInTown`, `sellValue`.
- `client/src/ui/hud.ts` — inventory rendering + action buttons.
- `client/index.html`, `client/src/i18n.ts`, `client/src/styles.css` — UI text/markup.

## Requirements

- Add a shared `INVENTORY_CAPACITY` constant (use 30). It applies to `inventory.items` only; equipped items do not count.
- Server: before adding an item to `inventory.items` (monster loot in `killMonster`, shop purchase in `buyShopItem`, ground pickup in `pickupGroundItem`), check capacity. If the bag is full:
  - Monster loot: skip adding the item and emit a `system` message that the bag is full (do not crash, do not drop EXP/gold — gold and EXP are always granted).
  - Shop purchase: block the purchase, refund nothing because nothing was charged yet (check capacity BEFORE deducting gold), and emit a "bag full" system message.
  - Ground pickup: block and emit a "bag full" message.
- Add a new typed socket event `sellJunk: () => void` (no payload) in `shared/src/types.ts` `ClientToServerEvents`.
- Server `sellJunk` handler: only works in town (reuse `isInTown`). Sell every item in `inventory.items` that is `kind === "equipment"` AND `rarity === "common"`. Sum the gold using the existing `sellValue`. Do NOT sell consumables, do NOT sell Rare/Epic, do NOT touch equipped gear. Emit updated player, a system message with total gold earned and count sold, a floating loot text, and save.
- Client: add a "Sell junk" button in the inventory panel (only meaningful in town; it can always be visible but the server enforces the town rule). Wire it to emit `sellJunk`.
- Client: show an inventory counter in the inventory panel header, e.g. `12 / 30`, updated whenever inventory changes.

## DO NOT

- Do not sell equipped items, consumables, or Rare/Epic items with the junk button.
- Do not allow selling or buying outside town.
- Do not deduct gold for a purchase that is blocked by a full bag.
- Do not add new npm dependencies.

## Acceptance criteria

- [ ] Inventory header shows current count and capacity (e.g. `12 / 30`), updates live.
- [ ] When the bag is full: monster loot is skipped with a clear "bag full" message (gold/EXP still granted), buying is blocked with no gold lost, pickup is blocked.
- [ ] "Sell junk" in town sells only Common equipment, keeps potions + Rare/Epic + equipped gear, and adds the correct gold total.
- [ ] "Sell junk" outside town is rejected with a message.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to test capacity limits and the sell-junk button.
