import { expToNextLevel } from "@mmorpg/shared";
import type { ChatMessage, EquipmentSlot, Item, MonsterState, PlayerState, ShopItem } from "@mmorpg/shared";
import { getLanguage, setLanguage, t, translateMonsterName, type Language } from "../i18n";

const rarityClass = {
  common: "rarity-common",
  rare: "rarity-rare",
  epic: "rarity-epic"
};

export class Hud {
  private player?: PlayerState;
  private selectedItemId?: string;
  private autoRetargetEnabled = false;

  constructor(
    private readonly onEquip: (itemId: string) => void,
    private readonly onUnequip: (slot: EquipmentSlot) => void,
    private readonly onChat: (message: string) => void,
    private readonly onBuy: (shopId: string) => void,
    private readonly onSell: (itemId: string) => void,
    private readonly onDrop: (itemId: string) => void,
    private readonly onUse: (itemId: string) => void,
    private readonly onAutoRetarget: (enabled: boolean) => void
  ) {
    this.applyLanguage();
    const form = document.querySelector("#chat-form") as HTMLFormElement;
    const input = document.querySelector("#chat-input") as HTMLInputElement;
    const languageSelect = document.querySelector("#language-select") as HTMLSelectElement;
    languageSelect.value = getLanguage();
    languageSelect.addEventListener("change", () => {
      setLanguage(languageSelect.value as Language);
      window.location.reload();
    });
    const autoRetargetToggle = document.querySelector("#auto-retarget-toggle") as HTMLInputElement;
    autoRetargetToggle.checked = this.autoRetargetEnabled;
    autoRetargetToggle.addEventListener("change", () => {
      this.autoRetargetEnabled = autoRetargetToggle.checked;
      this.onAutoRetarget(this.autoRetargetEnabled);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      this.onChat(message);
      input.value = "";
    });
  }

  setPlayer(player: PlayerState): void {
    this.player = player;
    document.querySelector("#player-name")!.textContent = `${player.accountName} - ${t("levelShort")} ${player.stats.level}`;
    setBar("#hp-fill", "#hp-label", player.stats.hp, player.stats.maxHp, t("hp"));
    setBar("#exp-fill", "#exp-label", player.stats.exp, expToNextLevel(player.stats.level), t("exp"));
    document.querySelector("#stats")!.innerHTML = `
      <div class="stat-card stat-atk"><i class="material-symbols-outlined">swords</i><span>${t("atk")}</span><strong>${player.stats.attack}</strong></div>
      <div class="stat-card stat-def"><i class="material-symbols-outlined">shield</i><span>${t("def")}</span><strong>${player.stats.defense}</strong></div>
      <div class="stat-card stat-gold"><i class="material-symbols-outlined">monetization_on</i><span>${t("gold")}</span><strong>${player.stats.gold}</strong></div>
    `;
    this.renderEquipment();
    this.renderInventory();
  }

  setTarget(monster?: MonsterState): void {
    const panel = document.querySelector("#selected-target") as HTMLElement;
    if (!monster || monster.respawnsAt || monster.hp <= 0) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    document.querySelector("#target-name")!.textContent = translateMonsterName(monster.name);
    document.querySelector("#target-level")!.textContent = `${t("levelShort")} ${monster.level}`;
    setBar("#target-hp-fill", "#target-hp-label", monster.hp, monster.maxHp, t("hp"));
  }

  log(message: string): void {
    const log = document.querySelector("#log")!;
    const line = document.createElement("div");
    line.textContent = message;
    log.prepend(line);
    while (log.childElementCount > 8) log.lastElementChild?.remove();
  }

  setChatHistory(messages: ChatMessage[]): void {
    const root = document.querySelector("#chat-messages")!;
    root.innerHTML = "";
    for (const message of messages) this.appendChat(message);
  }

  appendChat(message: ChatMessage): void {
    const root = document.querySelector("#chat-messages")!;
    const line = document.createElement("div");
    line.className = "chat-line";
    line.innerHTML = `<strong>${escapeHtml(message.accountName)}</strong><span>${escapeHtml(message.message)}</span>`;
    root.append(line);
    while (root.childElementCount > 50) root.firstElementChild?.remove();
    root.scrollTop = root.scrollHeight;
  }

  setShopStock(items: ShopItem[]): void {
    const root = document.querySelector("#shop")!;
    root.innerHTML = "";
    for (const item of items) {
      const row = document.createElement("button");
      row.className = `shop-item ${rarityClass[item.rarity]}${item.kind === "consumable" ? " consumable" : ""}`;
      row.title = describeItem(item);
      row.innerHTML = `<i class="material-symbols-outlined">${itemMaterialIcon(item)}</i><strong>${escapeHtml(item.name)}</strong><span>${t("price")}: ${item.value} ${t("gold")}</span><em>${shortStats(item)}</em>`;
      row.addEventListener("click", () => this.onBuy(item.shopId));
      root.append(row);
    }
  }

  private renderEquipment(): void {
    if (!this.player) return;
    const root = document.querySelector("#equipment")!;
    root.innerHTML = "";
    for (const slot of ["weapon", "helmet", "armor", "boots", "ring"] as const) {
      const item = this.player.inventory.equipped[slot];
      const row = document.createElement("div");
      row.className = "slot";
      row.dataset.slot = slot;
      row.innerHTML = `<span>${t(slot)}</span><strong><i class="material-symbols-outlined">${item ? materialIcon(item.slot) : materialIcon(slot)}</i></strong>`;
      row.title = item ? describeItem(item) : `${t("dropHere")}: ${t(slot)}`;
      if (item) row.classList.add(rarityClass[item.rarity]);
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const itemId = event.dataTransfer?.getData("text/item-id");
        if (itemId) this.onEquip(itemId);
      });
      if (item) {
        row.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.onUnequip(slot);
        });
      }
      root.append(row);
    }
  }

  private renderInventory(): void {
    if (!this.player) return;
    const root = document.querySelector("#inventory")!;
    root.innerHTML = "";
    if (this.player.inventory.items.length === 0) {
      root.innerHTML = `<div class="empty">${t("noDrops")}</div>`;
      this.selectedItemId = undefined;
      this.renderInventoryActions();
      return;
    }
    if (this.selectedItemId && !this.player.inventory.items.some((item) => item.id === this.selectedItemId)) {
      this.selectedItemId = undefined;
    }
    for (const item of this.player.inventory.items) {
      const button = document.createElement("button");
      button.className = `item ${rarityClass[item.rarity]}${item.kind === "consumable" ? " consumable" : ""}${item.id === this.selectedItemId ? " selected" : ""}`;
      button.draggable = true;
      button.innerHTML = `<i class="material-symbols-outlined">${itemMaterialIcon(item)}</i><small>${itemIcon(item)}</small>`;
      button.title = describeItem(item);
      button.dataset.tooltip = describeItem(item);
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/item-id", item.id);
      });
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) {
          this.onDrop(item.id);
          return;
        }
        if (event.shiftKey) {
          this.onSell(item.id);
          return;
        }
        this.selectedItemId = item.id;
        this.renderInventory();
      });
      button.addEventListener("dblclick", () => item.kind === "consumable" ? this.onUse(item.id) : this.onEquip(item.id));
      button.addEventListener("contextmenu", (event) => event.preventDefault());
      root.append(button);
    }
    this.renderInventoryActions();
  }

  private renderInventoryActions(): void {
    const inventory = document.querySelector("#inventory")!;
    const panel = document.querySelector(".inventory-panel")!;
    let actions = document.querySelector("#inventory-actions") as HTMLDivElement | null;
    if (!actions) {
      actions = document.createElement("div");
      actions.id = "inventory-actions";
      panel.insertBefore(actions, inventory.nextSibling);
    }
    const item = this.player?.inventory.items.find((candidate) => candidate.id === this.selectedItemId);
    if (!item) {
      actions.innerHTML = "";
      actions.classList.add("hidden");
      return;
    }
    actions.classList.remove("hidden");
    const primaryAction = item.kind === "consumable" ? "use" : "equip";
    const primaryLabel = item.kind === "consumable" ? t("use") : t("equipment");
    actions.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <button type="button" data-action="${primaryAction}">${primaryLabel}</button>
      <button type="button" data-action="sell">${t("sell")}</button>
      <button type="button" data-action="drop">${t("drop")}</button>
    `;
    actions.querySelector('[data-action="equip"]')?.addEventListener("click", () => this.onEquip(item.id));
    actions.querySelector('[data-action="use"]')?.addEventListener("click", () => this.onUse(item.id));
    actions.querySelector('[data-action="sell"]')?.addEventListener("click", () => this.onSell(item.id));
    actions.querySelector('[data-action="drop"]')?.addEventListener("click", () => this.onDrop(item.id));
  }

  private applyLanguage(): void {
    document.documentElement.lang = getLanguage();
    document.querySelector("#language-label")!.textContent = t("language");
    document.querySelector("#equipment-title")!.textContent = t("equipment");
    document.querySelector("#target-title")!.textContent = t("selectedTarget");
    document.querySelector("#auto-retarget-label")!.textContent = t("autoRetarget");
    document.querySelector("#inventory-title")!.textContent = t("inventory");
    document.querySelector("#shop-title")!.textContent = t("shop");
    document.querySelector("#world-title")!.textContent = t("world");
    document.querySelector("#chat-title")!.textContent = t("chat");
    document.querySelector("#chat-send")!.textContent = t("send");
    (document.querySelector("#chat-input") as HTMLInputElement).placeholder = t("chatPlaceholder");
    document.querySelector("#player-name")!.textContent = t("connecting");
  }
}

function setBar(fillSelector: string, labelSelector: string, value: number, max: number, label: string): void {
  const pct = Math.max(0, Math.min(1, value / max));
  (document.querySelector(fillSelector) as HTMLElement).style.width = `${pct * 100}%`;
  document.querySelector(labelSelector)!.textContent = `${label} ${Math.floor(value)} / ${max}`;
}

function describeItem(item: Item): string {
  if (item.kind === "consumable") {
    return `${item.name}\n${t(item.rarity)} ${t("consumable")}\n${t("heals")}: ${item.heal} ${t("hp")}\n${t("value")}: ${item.value} ${t("gold")}`;
  }
  const stats = Object.entries(item.stats).map(([key, value]) => `+${value} ${statLabel(key)}`).join(" ");
  return `${item.name}\n${t(item.rarity)} ${t(item.slot)}\n${stats}\n${t("value")}: ${item.value} ${t("gold")}`;
}

function shortStats(item: Item): string {
  if (item.kind === "consumable") return `${t("heals")} ${item.heal} ${t("hp")}`;
  return Object.entries(item.stats).map(([key, value]) => `+${value} ${statLabel(key)}`).join("  ");
}

function itemIcon(item: Item): string {
  if (item.kind === "consumable") return t("itemPotion");
  const icons: Record<EquipmentSlot, string> = {
    weapon: t("itemWeapon"),
    helmet: t("itemHelmet"),
    armor: t("itemArmor"),
    boots: t("itemBoots"),
    ring: t("itemRing")
  };
  return icons[item.slot];
}

function itemMaterialIcon(item: Item): string {
  return item.kind === "consumable" ? "local_drink" : materialIcon(item.slot);
}

function materialIcon(slot: EquipmentSlot): string {
  const icons: Record<EquipmentSlot, string> = {
    weapon: "colorize",
    helmet: "sports_martial_arts",
    armor: "accessibility_new",
    boots: "hiking",
    ring: "radio_button_unchecked"
  };
  return icons[slot];
}

function statLabel(stat: string): string {
  if (stat === "maxHp") return t("maxHp");
  if (stat === "attack") return t("attack");
  if (stat === "defense") return t("defense");
  return stat;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char] ?? char);
}
