import { ACHIEVEMENTS, AFK_ZONE_DEFINITIONS, CLASS_CATALOG, INVENTORY_CAPACITY, MATERIAL_CATALOG, PLAYER_CLASSES, RECIPES, SKILL_CATALOG, SKILL_IDS, SKILL_LOADOUT_SIZE, SKILL_MAX_RANK, expToNextLevel } from "@mmorpg/shared";
import type { Achievement, AfkZone, AllocatableStat, ChatMessage, EquipmentSlot, Item, MaterialId, MaterialItem, MonsterState, OfflineRewardsEvent, PartyInvite, PartyView, PlayerClass, PlayerState, QuestCategory, QuestListPayload, QuestView, Rarity, ShopItem, SkillId } from "@mmorpg/shared";
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
  private skillCooldowns: Record<SkillId, number> = { powerStrike: 0, cleave: 0, swiftStrike: 0, heal: 0, piercingStrike: 0, whirlwind: 0, swiftBlade: 0, greaterHeal: 0, lifedrain: 0, flameBurst: 0, thunderStrike: 0, icicleStorm: 0, shadowAssault: 0, healingWave: 0, divineLight: 0, voidNova: 0 };
  private party: PartyView | null = null;
  private pendingInvitePartyId?: string;
  private offlineRewardsOpen = false;

  constructor(
    private readonly onEquip: (itemId: string) => void,
    private readonly onUnequip: (slot: EquipmentSlot) => void,
    private readonly onChat: (message: string) => void,
    private readonly onBuy: (shopId: string) => void,
    private readonly onSell: (itemId: string) => void,
    private readonly onDrop: (itemId: string) => void,
    private readonly onUse: (itemId: string) => void,
    private readonly onSellJunk: () => void,
    private readonly onSkill: (skillId: SkillId) => void,
    private readonly onEquipSkill: (slot: number, skillId: SkillId) => void,
    private readonly onLearnSkill: (skillId: SkillId) => void,
    private readonly onAcceptQuest: (questId: string) => void,
    private readonly onClaimQuest: (questId: string) => void,
    private readonly onAutoRetarget: (enabled: boolean) => void,
    private readonly onAfkZone: (zone: AfkZone) => void,
    private readonly onAllocateStat: (stat: AllocatableStat) => void,
    private readonly onInviteParty: () => void,
    private readonly onAcceptParty: (partyId: string) => void,
    private readonly onLeaveParty: () => void,
    private readonly onToggleMuted: () => boolean,
    private readonly isMuted: () => boolean,
    private readonly onCraft: (recipeId: string) => void = () => {},
    private readonly onSelectClass: (playerClass: PlayerClass) => void = () => {},
    private readonly onUpgradeSkill: (skillId: SkillId) => void = () => {},
    private readonly onEnchant: (itemId: string) => void = () => {}
  ) {
    this.applyLanguage();
    const form = document.querySelector("#chat-form") as HTMLFormElement;
    const input = document.querySelector("#chat-input") as HTMLInputElement;
    const languageSelect = document.querySelector("#language-select") as HTMLSelectElement;
    const muteButton = document.querySelector("#sound-toggle") as HTMLButtonElement;
    const sellJunkButton = document.querySelector("#sell-junk-button") as HTMLButtonElement;
    sellJunkButton.addEventListener("click", () => this.onSellJunk());
    muteButton.addEventListener("click", () => {
      this.onToggleMuted();
      this.renderSoundToggle();
    });
    document.querySelectorAll<HTMLButtonElement>(".afk-zone-button").forEach((button) => {
      const zone = button.dataset.afkZone;
      if (isAfkZone(zone)) button.addEventListener("click", () => this.onAfkZone(zone));
    });
    const offlineRewardsModal = document.querySelector("#offline-rewards-modal") as HTMLElement;
    const offlineRewardsClose = document.querySelector("#offline-rewards-close") as HTMLButtonElement;
    offlineRewardsClose.addEventListener("click", () => this.hideOfflineRewards());
    offlineRewardsModal.addEventListener("pointerdown", (event) => event.stopPropagation());
    offlineRewardsModal.addEventListener("keydown", (event) => event.stopPropagation());
    window.setInterval(() => this.renderSkillCooldowns(), 100);
    (document.querySelector("#party-invite-button") as HTMLButtonElement).addEventListener("click", () => this.onInviteParty());
    (document.querySelector("#party-leave-button") as HTMLButtonElement).addEventListener("click", () => this.onLeaveParty());
    // Potion slot button: use first consumable in inventory.
    const potionButton = document.querySelector("#potion-slot") as HTMLButtonElement | null;
    potionButton?.addEventListener("click", () => {
      const potion = this.player?.inventory.items.find((item) => item.kind === "consumable");
      if (potion) this.onUse(potion.id);
    });
    // Toolbar buttons toggle modals.
    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal]").forEach((btn) => {
      const modalId = btn.dataset.modal!;
      btn.addEventListener("click", () => {
        const modal = document.querySelector(`#${modalId}`) as HTMLElement | null;
        if (modal) modal.classList.toggle("hidden");
      });
    });
    document.querySelectorAll<HTMLButtonElement>(".game-modal .modal-close").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest(".game-modal")?.classList.add("hidden"));
    });
    document.querySelectorAll<HTMLElement>(".game-modal").forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.classList.add("hidden");
      });
    });
    // Hotkeys for opening modals. Only act when the user isn't typing in a
    // text field — otherwise typing 'i' in chat would open inventory.
    const modalHotkeys: Record<string, string> = {
      i: "inventory-modal",
      c: "equipment-modal",
      k: "skills-modal",
      n: "quests-modal",        // 'n' for nhiệm vụ — quests
      v: "achievements-modal",  // 'v' for vinh quang
      h: "shop-modal",
      g: "afk-modal",
      j: "forge-modal",         // 'j' for jewel/forge
      b: "leaderboard-modal",   // 'b' for bảng vinh danh
      "?": "help-modal"
    };
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.querySelectorAll<HTMLElement>(".game-modal:not(.hidden)").forEach((m) => m.classList.add("hidden"));
        return;
      }
      // Ignore hotkeys when user is typing.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      const modalId = modalHotkeys[key];
      if (!modalId) return;
      event.preventDefault();
      const allModals = document.querySelectorAll<HTMLElement>(".game-modal");
      const target_ = document.querySelector<HTMLElement>(`#${modalId}`);
      if (!target_) return;
      // If clicking same modal that's open, close it; otherwise close others first.
      const isOpen = !target_.classList.contains("hidden");
      allModals.forEach((m) => m.classList.add("hidden"));
      if (!isOpen) target_.classList.remove("hidden");
      // Some modals trigger socket requests on open (arena, leaderboard).
      if (!isOpen && modalId === "leaderboard-modal") window.dispatchEvent(new CustomEvent("hotkey-leaderboard"));
      if (!isOpen && modalId === "arena-modal") window.dispatchEvent(new CustomEvent("hotkey-arena"));
    });
    this.setParty(null);
    this.renderSoundToggle();
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
      // Slash commands handled client-side.
      if (message.startsWith("/")) {
        this.handleSlashCommand(message);
      } else {
        this.onChat(message);
      }
      input.value = "";
    });
  }

  setPlayer(player: PlayerState): void {
    this.player = player;
    this.updateClassModal(player);
    const classLabel = player.playerClass ? ` [${CLASS_CATALOG[player.playerClass].name}]` : "";
    document.querySelector("#player-name")!.textContent = `${player.accountName}${classLabel} - ${t("levelShort")} ${player.stats.level}`;
    setBar("#hp-fill", "#hp-label", player.stats.hp, player.stats.maxHp, t("hp"));
    setBar("#exp-fill", "#exp-label", player.stats.exp, expToNextLevel(player.stats.level), t("exp"));
    const maxStam = player.stats.maxStamina ?? 100;
    const curStam = player.stats.stamina ?? maxStam;
    setBar("#stamina-fill", "#stamina-label", Math.round(curStam), maxStam, "Thể lực");
    const canAllocate = player.unspentPoints > 0;
    document.querySelector("#stats")!.innerHTML = `
      ${canAllocate ? `<div class="stat-points-left">${t("statPointsLeft", { points: player.unspentPoints })}</div>` : ""}
      ${statCard("attack", "stat-atk", "swords", t("atk"), player.stats.attack, canAllocate)}
      ${statCard("defense", "stat-def", "shield", t("def"), player.stats.defense, canAllocate)}
      ${statCard("maxHp", "stat-hp", "favorite", t("hp"), player.stats.maxHp, canAllocate)}
      <div class="stat-card stat-gold"><i class="material-symbols-outlined">monetization_on</i><span>${t("gold")}</span><strong>${player.stats.gold}</strong></div>
    `;
    document.querySelectorAll<HTMLButtonElement>("#stats [data-stat]").forEach((button) => {
      const stat = button.dataset.stat;
      if (isAllocatableStat(stat)) button.addEventListener("click", () => this.onAllocateStat(stat));
    });
    this.renderEquipment();
    this.renderInventory();
    this.renderAfkZone();
    this.renderAchievements();
    this.renderForgeRecipes();
    this.renderForgeEnchant();
    this.wireForgeTabs();
    this.skillCooldowns = player.skillCooldowns ?? this.skillCooldowns;
    if (!Array.isArray(player.equippedSkills)) player.equippedSkills = [];
    if (!Array.isArray(player.learnedSkills)) player.learnedSkills = [];
    this.renderSkillBar();
    this.renderSkillPicker();
    this.renderSkillCooldowns();
  }

  // ----- Forge / crafting -----

  private renderForgeRecipes(): void {
    const root = document.querySelector<HTMLDivElement>("#forge-recipes");
    if (!root) return;
    root.innerHTML = "";
    const owned = this.materialCounts();
    for (const recipe of RECIPES) {
      const card = document.createElement("div");
      card.className = `forge-recipe rarity-${recipe.rarity}`;
      const header = document.createElement("div");
      header.className = "forge-name";
      header.textContent = `${recipe.name} (${t(recipe.rarity)} ${t(recipe.slot)})`;
      card.appendChild(header);
      const cost = document.createElement("div");
      cost.className = "forge-cost";
      let canCraft = true;
      for (const [mid, qty] of Object.entries(recipe.cost) as [MaterialId, number][]) {
        const have = owned.get(mid) ?? 0;
        const ok = have >= qty;
        if (!ok) canCraft = false;
        const span = document.createElement("span");
        span.className = ok ? "ok" : "missing";
        span.textContent = `${MATERIAL_CATALOG[mid].name}: ${have}/${qty}`;
        cost.appendChild(span);
      }
      card.appendChild(cost);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forge-craft";
      btn.disabled = !canCraft;
      btn.textContent = canCraft ? "Chế tạo" : "Thiếu nguyên liệu";
      btn.addEventListener("click", () => this.onCraft(recipe.id));
      card.appendChild(btn);
      root.appendChild(card);
    }
  }

  private wiredForgeTabs = false;
  private wireForgeTabs(): void {
    if (this.wiredForgeTabs) return;
    this.wiredForgeTabs = true;
    document.querySelectorAll<HTMLButtonElement>("#forge-tabs [data-forge-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.forgeTab!;
        document.querySelectorAll<HTMLButtonElement>("#forge-tabs [data-forge-tab]").forEach((b) => {
          b.classList.toggle("active", b.dataset.forgeTab === target);
        });
        const recipes = document.querySelector<HTMLDivElement>("#forge-recipes");
        const enchant = document.querySelector<HTMLDivElement>("#forge-enchant");
        if (target === "craft") {
          recipes?.classList.remove("hidden");
          enchant?.classList.add("hidden");
        } else {
          recipes?.classList.add("hidden");
          enchant?.classList.remove("hidden");
        }
      });
    });
  }

  private renderForgeEnchant(): void {
    const root = document.querySelector<HTMLDivElement>("#forge-enchant");
    if (!root || !this.player) return;
    root.innerHTML = "";
    const owned = this.materialCounts();
    const intro = document.createElement("p");
    intro.style.cssText = "margin:0 0 12px;color:#bdbdbd;font-size:12px";
    intro.textContent = "Tinh luyện trang bị Hiếm (3x Crystal Shard) hoặc Sử Thi (5x Void Ash). Stats sẽ re-roll trong khoảng ±30%.";
    root.appendChild(intro);
    const equippableItems = this.player.inventory.items.filter((it) => it.kind === "equipment" && (it.rarity === "rare" || it.rarity === "epic"));
    if (equippableItems.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:18px;text-align:center;color:#8e9192";
      empty.textContent = "Bạn không có trang bị Hiếm hoặc Sử Thi nào trong túi.";
      root.appendChild(empty);
      return;
    }
    for (const item of equippableItems) {
      if (item.kind !== "equipment") continue;
      const mat: MaterialId = item.rarity === "epic" ? "voidAsh" : "crystalShard";
      const need = item.rarity === "epic" ? 5 : 3;
      const have = owned.get(mat) ?? 0;
      const ok = have >= need;
      const card = document.createElement("div");
      card.className = `forge-recipe rarity-${item.rarity}`;
      const statText = Object.entries(item.stats).map(([k, v]) => `+${v} ${statLabel(k)}`).join(" · ");
      card.innerHTML = `
        <div class="forge-name">${escapeHtml(item.name)} <small style="color:#8e9192">(${item.rarity})</small> ${item.enchantCount ? `<small style='color:#ffd166'>· tinh luyện ${item.enchantCount} lần</small>` : ""}</div>
        <div style="font-size:12px;color:#cfcfcf;margin-bottom:6px">${statText}</div>
        <div class="forge-cost">
          <span class="${ok ? "ok" : "missing"}">${MATERIAL_CATALOG[mat].name}: ${have}/${need}</span>
        </div>
      `;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forge-craft";
      btn.disabled = !ok;
      btn.textContent = ok ? "Tinh luyện" : "Thiếu nguyên liệu";
      btn.addEventListener("click", () => this.onEnchant(item.id));
      card.appendChild(btn);
      root.appendChild(card);
    }
  }

  private materialCounts(): Map<MaterialId, number> {
    const counts = new Map<MaterialId, number>();
    if (!this.player) return counts;
    for (const item of this.player.inventory.items) {
      if (item.kind !== "material") continue;
      const m = item as MaterialItem;
      counts.set(m.materialId, (counts.get(m.materialId) ?? 0) + 1);
    }
    return counts;
  }

  private renderSkillBar(): void {
    if (!this.player) return;
    const root = document.querySelector("#skill-bar")!;
    root.innerHTML = "";
    const keys = ["Q", "W", "E", "R"];
    const equipped = this.player.equippedSkills ?? [];
    for (let slot = 0; slot < SKILL_LOADOUT_SIZE; slot++) {
      const skillId = equipped[slot];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "skill-button";
      if (skillId) {
        button.dataset.skill = skillId;
        const name = t(skillNameKey(skillId));
        const info = SKILL_CATALOG[skillId];
        const rank = this.player.skillRanks?.[skillId] ?? 0;
        const rankDots = rank > 0 ? `<span class="skill-rank-dots" title="Cấp ${rank}">${"★".repeat(rank)}</span>` : "";
        button.title = `${name} - CD ${(info.cooldownMs / 1000).toFixed(1)}s${rank > 0 ? ` · +${rank * 25}% sức mạnh` : ""}`;
        button.innerHTML = `<kbd>${keys[slot]}</kbd>${rankDots}<strong>${escapeHtml(name)}</strong><span data-cooldown="${skillId}"></span>`;
        button.addEventListener("click", () => this.onSkill(skillId));
      } else {
        button.classList.add("empty");
        button.disabled = true;
        button.innerHTML = `<kbd>${keys[slot]}</kbd><strong>—</strong>`;
      }
      root.append(button);
    }
  }

  // ---- class selection modal ----

  private updateClassModal(player: PlayerState): void {
    const modal = document.querySelector<HTMLElement>("#class-modal");
    if (!modal) return;
    if (player.playerClass) {
      modal.classList.add("hidden");
      return;
    }
    // Build cards if not already built.
    const cards = document.querySelector<HTMLDivElement>("#class-cards");
    if (cards && cards.children.length === 0) {
      for (const id of PLAYER_CLASSES) {
        const info = CLASS_CATALOG[id];
        const card = document.createElement("div");
        card.className = "class-card";
        const skillNames = info.skills.map((s) => t(skillNameKey(s))).join(", ");
        card.innerHTML = `
          <h3>${escapeHtml(info.name)}</h3>
          <p>${escapeHtml(info.description)}</p>
          <div class="class-stats">+${info.startBonusMaxHp} HP · +${info.startBonusAttack} ATK · +${info.startBonusDefense} DEF</div>
          <div class="class-skills">Kỹ năng: ${escapeHtml(skillNames)}</div>
          <button type="button" class="pick-btn" data-class="${id}">Chọn ${escapeHtml(info.name)}</button>
        `;
        card.querySelector<HTMLButtonElement>(".pick-btn")!.addEventListener("click", () => this.onSelectClass(id));
        cards.appendChild(card);
      }
    }
    modal.classList.remove("hidden");
  }

  private renderSkillPicker(): void {
    if (!this.player) return;
    const root = document.querySelector<HTMLDivElement>("#skill-picker");
    if (!root) {
      console.warn("[hud] #skill-picker root missing");
      return;
    }
    root.innerHTML = "";
    const keys = ["Q", "W", "E", "R"];
    const learnedSet = new Set(this.player.learnedSkills ?? []);
    const equippedSkills = this.player.equippedSkills ?? [];
    const playerLevel = this.player.stats.level;
    const playerClass = this.player.playerClass;
    // If no class picked yet, prompt user instead of dumping all 16 skills.
    if (!playerClass) {
      const msg = document.createElement("div");
      msg.style.cssText = "padding:18px;text-align:center;color:#bdbdbd;font-size:13px";
      msg.textContent = "Bạn cần chọn Lớp Nhân Vật trước khi học kỹ năng.";
      root.appendChild(msg);
      return;
    }
    // Defensive: CLASS_CATALOG lookup must succeed.
    const classInfo = CLASS_CATALOG[playerClass];
    if (!classInfo) {
      const msg = document.createElement("div");
      msg.style.cssText = "padding:18px;text-align:center;color:#ff8181;font-size:13px";
      msg.textContent = `Lớp "${playerClass}" không hợp lệ. Liên hệ admin.`;
      root.appendChild(msg);
      console.error("[hud] unknown playerClass:", playerClass);
      return;
    }
    // Talent points header.
    const talentPoints = this.player.talentPoints ?? 0;
    const header = document.createElement("div");
    header.className = "talent-header";
    header.innerHTML = `<strong>Điểm tài năng:</strong> <span class="talent-points">${talentPoints}</span> <span class="talent-hint">— Mỗi cấp được +1, dùng để tăng cấp skill (+25% sức mạnh mỗi cấp, tối đa ${SKILL_MAX_RANK} cấp)</span>`;
    root.appendChild(header);

    // Loadout preset bar — save / load current Q/W/E/R loadout to 3 slots.
    const loadouts = this.player.skillLoadouts ?? [[], [], []];
    const presetBar = document.createElement("div");
    presetBar.className = "loadout-bar";
    presetBar.innerHTML = "<strong>Loadout:</strong>";
    for (let s = 0; s < 3; s += 1) {
      const slot = s;
      const saved = loadouts[slot] ?? [];
      const preview = saved.length ? saved.map((id) => (t(skillNameKey(id)) || id).slice(0, 4)).join(" / ") : "trống";
      const wrap = document.createElement("div");
      wrap.className = "loadout-slot";
      wrap.innerHTML = `<div class="loadout-slot-head">${slot + 1}. ${preview}</div>`;
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.textContent = "Dùng";
      loadBtn.disabled = saved.length === 0;
      loadBtn.addEventListener("click", () => window.dispatchEvent(new CustomEvent("loadout-load", { detail: slot })));
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "Lưu";
      saveBtn.addEventListener("click", () => window.dispatchEvent(new CustomEvent("loadout-save", { detail: slot })));
      wrap.appendChild(loadBtn);
      wrap.appendChild(saveBtn);
      presetBar.appendChild(wrap);
    }
    root.appendChild(presetBar);

    let appended = 0;
    for (const id of SKILL_IDS) {
      const classOk = classInfo.skills.includes(id);
      if (!classOk) continue; // Hide other classes' skills entirely.
      const info = SKILL_CATALOG[id];
      const learned = learnedSet.has(id);
      const meetsLevel = playerLevel >= info.requiredLevel;
      const equippedSlot = equippedSkills.indexOf(id);
      const status = learned ? "learned" : meetsLevel ? "learnable" : "locked";
      const card = document.createElement("div");
      card.className = `skill-card ${status}${equippedSlot >= 0 ? " equipped" : ""}`;
      let actionHtml = "";
      if (!learned && !meetsLevel) {
        actionHtml = `<div class="skill-locked">${t("requireLevel", { level: info.requiredLevel })}</div>`;
      } else if (!learned && meetsLevel) {
        actionHtml = `<button type="button" class="learn-button" data-action="learn">${t("learn")}</button>`;
      } else {
        actionHtml = `<div class="slot-buttons">${keys.map((key, slot) => {
          const cls = this.player!.equippedSkills[slot] === id ? "active" : "";
          return `<button type="button" data-slot="${slot}" class="${cls}">${key}</button>`;
        }).join("")}</div>`;
      }
      // Skill rank upgrade row (only when learned).
      const rank = this.player.skillRanks?.[id] ?? 0;
      const talentPoints = this.player.talentPoints ?? 0;
      const upgradeHtml = learned
        ? `<div class="skill-rank-row">
            <span class="skill-rank">Cấp: ${rank}/${SKILL_MAX_RANK}</span>
            ${rank < SKILL_MAX_RANK ? `<button type="button" class="skill-upgrade" data-action="upgrade" ${talentPoints < 1 ? "disabled" : ""}>Tăng cấp (1 điểm)</button>` : `<span class="skill-rank-max">Tối đa</span>`}
          </div>`
        : "";
      card.innerHTML = `
        <div class="skill-card-head">
          <strong>${escapeHtml(t(skillNameKey(id)))}</strong>
          ${equippedSlot >= 0 ? `<span class="slot-tag">${keys[equippedSlot]}</span>` : ""}
        </div>
        <p>${escapeHtml(t(skillDescKey(id)))}</p>
        <em>${t("levelShort")} ${info.requiredLevel} · CD ${(info.cooldownMs / 1000).toFixed(1)}s${rank > 0 ? ` · +${rank * 25}% sức mạnh` : ""}</em>
        ${actionHtml}
        ${upgradeHtml}
      `;
      const upgradeBtn = card.querySelector<HTMLButtonElement>('[data-action="upgrade"]');
      if (upgradeBtn) upgradeBtn.addEventListener("click", () => this.onUpgradeSkill(id));
      if (!learned && meetsLevel) {
        card.querySelector('[data-action="learn"]')!.addEventListener("click", () => this.onLearnSkill(id));
      } else if (learned) {
        card.querySelectorAll<HTMLButtonElement>(".slot-buttons button").forEach((btn) => {
          const slot = Number(btn.dataset.slot);
          btn.addEventListener("click", () => this.onEquipSkill(slot, id));
        });
      }
      root.append(card);
      appended += 1;
    }
    if (appended === 0) {
      const msg = document.createElement("div");
      msg.style.cssText = "padding:18px;text-align:center;color:#ff8181;font-size:13px";
      msg.textContent = `Lớp ${classInfo.name} không có kỹ năng nào được cấu hình.`;
      root.appendChild(msg);
      console.error("[hud] no skills appended for class", playerClass, "skills list:", classInfo.skills);
    }
  }

  setTarget(monster?: MonsterState): void {
    const panel = document.querySelector("#selected-target") as HTMLElement;
    if (!monster || monster.respawnsAt || monster.hp <= 0) {
      panel.classList.add("hidden");
      return;
    }
    panel.classList.remove("hidden");
    document.querySelector("#target-name")!.textContent = `${monster.boss ? `${t("bossPrefix")} ` : monster.elite ? `${t("elitePrefix")} ` : ""}${translateMonsterName(monster.name)}`;
    document.querySelector("#target-level")!.textContent = `${t("levelShort")} ${monster.level}`;
    setBar("#target-hp-fill", "#target-hp-label", monster.hp, monster.maxHp, t("hp"));
  }

  log(message: string, className = ""): void {
    const log = document.querySelector("#log")!;
    const line = document.createElement("div");
    if (className) line.className = className;
    line.textContent = message;
    log.prepend(line);
    while (log.childElementCount > 8) log.lastElementChild?.remove();
  }

  announceDrop(accountName: string, itemName: string, rarity: Rarity): void {
    this.log(t("rareDropAnnouncement", { name: accountName, item: itemName }), `announcement announcement-${rarity} ${rarityClass[rarity]}`);
  }

  // Handle locally-interpreted slash commands. Currently:
  //  /help        — list commands in the log
  //  /me <text>   — emote (broadcast as a chat message prefixed with *)
  //  /clear       — clear chat history
  private handleSlashCommand(raw: string): void {
    const [cmd, ...rest] = raw.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();
    if (cmd === "help") {
      const lines = [
        "/help — danh sách lệnh",
        "/me <text> — phát emote (vd: /me chào mọi người)",
        "/clear — xoá nội dung chat"
      ];
      for (const l of lines) this.log(l, "log-line");
      return;
    }
    if (cmd === "me" && arg) {
      this.onChat(`* ${arg}`);
      return;
    }
    if (cmd === "clear") {
      const root = document.querySelector("#chat-messages");
      if (root) root.innerHTML = "";
      return;
    }
    this.log(`Lệnh không hợp lệ: ${cmd}. Gõ /help để xem danh sách.`, "log-line");
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
    const time = new Date(message.sentAt);
    const hh = time.getHours().toString().padStart(2, "0");
    const mm = time.getMinutes().toString().padStart(2, "0");
    line.innerHTML = `<time class="chat-time">${hh}:${mm}</time><strong>${escapeHtml(message.accountName)}</strong><span>${escapeHtml(message.message)}</span>`;
    root.append(line);
    while (root.childElementCount > 50) root.firstElementChild?.remove();
    root.scrollTop = root.scrollHeight;
  }

  showOfflineRewards(payload: OfflineRewardsEvent): void {
    const modal = document.querySelector("#offline-rewards-modal") as HTMLElement;
    const cap = document.querySelector("#offline-rewards-cap") as HTMLElement;
    document.querySelector("#offline-rewards-title")!.textContent = t("offlineRewardsTitle");
    document.querySelector("#offline-rewards-time-label")!.textContent = t("offlineRewardsElapsed");
    document.querySelector("#offline-rewards-time")!.textContent = formatElapsed(payload.elapsedMs);
    document.querySelector("#offline-rewards-exp")!.textContent = t("offlineRewardsExp", { exp: payload.exp });
    document.querySelector("#offline-rewards-gold-label")!.textContent = t("gold");
    document.querySelector("#offline-rewards-gold")!.textContent = t("offlineRewardsGold", { gold: payload.gold });
    document.querySelector("#offline-rewards-close")!.textContent = t("close");
    cap.textContent = payload.cappedAtMax ? t("offlineRewardsCapNotice") : "";
    cap.classList.toggle("hidden", !payload.cappedAtMax);
    this.offlineRewardsOpen = true;
    modal.classList.remove("hidden");
    (document.querySelector("#offline-rewards-close") as HTMLButtonElement).focus();
  }

  showAchievementToast(achievement: Achievement): void {
    const root = document.querySelector("#achievement-toasts") as HTMLElement;
    const toast = document.createElement("div");
    const text = localizedAchievement(achievement);
    toast.className = "achievement-toast";
    toast.innerHTML = `
      <span>${escapeHtml(t("achievementUnlocked"))}</span>
      <strong>${escapeHtml(text.title)}</strong>
      <p>${escapeHtml(text.description)}</p>
    `;
    root.append(toast);
    window.setTimeout(() => toast.classList.add("closing"), 3200);
    window.setTimeout(() => toast.remove(), 3900);
  }

  isOfflineRewardsOpen(): boolean {
    return this.offlineRewardsOpen;
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

  // Cache the latest quest payload so tab switches can re-render without
  // waiting for another server emission.
  private lastQuestPayload?: QuestListPayload;
  private questTab: "all" | "tutorial" | "story" | "daily" = "all";

  setQuests(payload: QuestListPayload): void {
    this.lastQuestPayload = payload;
    this.renderQuestList();
  }

  private renderQuestList(): void {
    const payload = this.lastQuestPayload;
    const root = document.querySelector<HTMLDivElement>("#quests");
    if (!root) return;
    root.innerHTML = "";

    // ---- tab bar ----
    const tabs = [
      { id: "all" as const, label: "Tất cả" },
      { id: "tutorial" as const, label: "Tập sự" },
      { id: "story" as const, label: "Cốt truyện" },
      { id: "daily" as const, label: "Hằng ngày" }
    ];
    const bar = document.createElement("div");
    bar.className = "quest-tabs";
    for (const t of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `quest-tab${this.questTab === t.id ? " active" : ""}`;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        this.questTab = t.id;
        this.renderQuestList();
      });
      bar.appendChild(btn);
    }
    root.appendChild(bar);

    if (!payload) {
      root.insertAdjacentHTML("beforeend", `<div class="empty">${t("noQuests")}</div>`);
      return;
    }
    const filter = (q: QuestView) => this.questTab === "all" || q.category === this.questTab;
    const active = payload.active.filter(filter);
    const available = payload.available.filter(filter);

    if (active.length > 0) {
      root.append(sectionTitle(t("activeQuests")));
      for (const quest of active) root.append(this.renderQuest(quest, "active"));
    }
    if (available.length > 0) {
      root.append(sectionTitle(t("availableQuests")));
      for (const quest of available) root.append(this.renderQuest(quest, "available"));
    }
    if (active.length === 0 && available.length === 0) {
      root.insertAdjacentHTML("beforeend", `<div class="empty">${t("noQuests")}</div>`);
    }
  }

  setParty(view: PartyView | null): void {
    this.party = view;
    const root = document.querySelector("#party-members")!;
    const leaveButton = document.querySelector("#party-leave-button") as HTMLButtonElement;
    root.innerHTML = "";
    if (!view || view.members.length === 0) {
      root.innerHTML = `<div class="empty">${t("noParty")}</div>`;
      leaveButton.classList.add("hidden");
      return;
    }
    leaveButton.classList.remove("hidden");
    for (const member of view.members) {
      const row = document.createElement("div");
      row.className = "party-member";
      row.dataset.memberId = member.id;
      const pct = Math.max(0, Math.min(1, member.hp / member.maxHp));
      row.innerHTML = `
        <div class="party-member-head">
          <strong>${escapeHtml(member.accountName)}${member.isLeader ? ` <span class="party-leader" title="${t("partyLeader")}">★</span>` : ""}</strong>
          <span data-party-level="${member.id}">${t("levelShort")} ${member.level}</span>
        </div>
        <div class="bar hp party-hp"><span data-party-hp="${member.id}" style="width: ${pct * 100}%"></span></div>
      `;
      root.append(row);
    }
  }

  showPartyInvite(invite: PartyInvite): void {
    this.pendingInvitePartyId = invite.partyId;
    const banner = document.querySelector("#party-invite") as HTMLElement;
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <span>${escapeHtml(t("partyInvitePrompt", { name: invite.fromName }))}</span>
      <div class="party-invite-actions">
        <button type="button" data-invite="accept">${t("partyAccept")}</button>
        <button type="button" data-invite="decline">${t("partyDecline")}</button>
      </div>
    `;
    banner.querySelector('[data-invite="accept"]')?.addEventListener("click", () => {
      const partyId = this.pendingInvitePartyId;
      this.clearPartyInvite();
      if (partyId) this.onAcceptParty(partyId);
    });
    banner.querySelector('[data-invite="decline"]')?.addEventListener("click", () => this.clearPartyInvite());
  }

  updatePartyVitals(players: PlayerState[]): void {
    if (!this.party) return;
    const byId = new Map(players.map((candidate) => [candidate.id, candidate]));
    for (const member of this.party.members) {
      const live = byId.get(member.id);
      if (!live) continue;
      const fill = document.querySelector(`[data-party-hp="${member.id}"]`) as HTMLElement | null;
      const level = document.querySelector(`[data-party-level="${member.id}"]`) as HTMLElement | null;
      if (fill) fill.style.width = `${Math.max(0, Math.min(1, live.stats.hp / live.stats.maxHp)) * 100}%`;
      if (level) level.textContent = `${t("levelShort")} ${live.stats.level}`;
    }
  }

  private clearPartyInvite(): void {
    this.pendingInvitePartyId = undefined;
    const banner = document.querySelector("#party-invite") as HTMLElement;
    banner.classList.add("hidden");
    banner.innerHTML = "";
  }

  private hideOfflineRewards(): void {
    this.offlineRewardsOpen = false;
    document.querySelector("#offline-rewards-modal")?.classList.add("hidden");
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
    document.querySelector("#inventory-count")!.textContent = `${this.player.inventory.items.length} / ${INVENTORY_CAPACITY}`;
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
    const panel = inventory.parentElement;
    if (!panel) return;
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
    document.querySelector("#afk-title")!.textContent = t("afkZone");
    const settingsTitle = document.querySelector("#settings-title");
    if (settingsTitle) settingsTitle.textContent = t("settings");
    const potionLabel = document.querySelector("#potion-label");
    if (potionLabel) potionLabel.textContent = t("potion");
    document.querySelector("#quests-title")!.textContent = t("quests");
    document.querySelector("#achievements-title")!.textContent = t("achievements");
    document.querySelector("#party-title")!.textContent = t("party");
    document.querySelector("#party-invite-button")!.textContent = t("partyInviteTarget");
    document.querySelector("#party-leave-button")!.textContent = t("partyLeave");
    document.querySelector("#skill-picker-title")!.textContent = t("learnSkills");
    for (const zone of AFK_ZONE_DEFINITIONS) {
      document.querySelector(`[data-afk-zone="${zone.id}"]`)!.textContent = t(afkZoneLabelKey(zone.id));
    }
    document.querySelector("#target-title")!.textContent = t("selectedTarget");
    document.querySelector("#auto-retarget-label")!.textContent = t("autoRetarget");
    document.querySelector("#inventory-title")!.textContent = t("inventory");
    document.querySelector("#sell-junk-button")!.textContent = t("sellJunk");
    document.querySelector("#shop-title")!.textContent = t("shop");
    document.querySelector("#world-title")!.textContent = t("world");
    document.querySelector("#chat-title")!.textContent = t("chat");
    document.querySelector("#chat-send")!.textContent = t("send");
    (document.querySelector("#chat-input") as HTMLInputElement).placeholder = t("chatPlaceholder");
    document.querySelector("#player-name")!.textContent = t("connecting");
    this.renderSoundToggle();
  }

  private renderSoundToggle(): void {
    const button = document.querySelector("#sound-toggle") as HTMLButtonElement | null;
    if (!button) return;
    const muted = this.isMuted();
    const label = muted ? t("unmute") : t("mute");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(muted));
    button.innerHTML = `<i class="material-symbols-outlined">${muted ? "volume_off" : "volume_up"}</i><span>${label}</span>`;
  }

  private renderSkillCooldowns(): void {
    if (!this.player) return;
    const now = Date.now();
    for (const skillId of this.player.equippedSkills ?? []) {
      if (!skillId) continue;
      const cdMs = SKILL_CATALOG[skillId]?.cooldownMs ?? 0;
      const remaining = Math.max(0, this.skillCooldowns[skillId] - now);
      const button = document.querySelector(`[data-skill="${skillId}"]`) as HTMLButtonElement | null;
      const label = document.querySelector(`[data-cooldown="${skillId}"]`) as HTMLElement | null;
      if (!button || !label) continue;
      const cooling = remaining > 0;
      button.classList.toggle("cooling", cooling);
      // Radial sweep via CSS conic-gradient on a custom property.
      if (cooling && cdMs > 0) {
        const pct = Math.max(0, Math.min(100, (remaining / cdMs) * 100));
        button.style.setProperty("--cd-sweep", `${pct}%`);
      } else {
        button.style.setProperty("--cd-sweep", "0%");
      }
      label.textContent = cooling ? `${(remaining / 1000).toFixed(1)}s` : "";
    }
  }

  private renderAfkZone(): void {
    if (!this.player) return;
    for (const zone of AFK_ZONE_DEFINITIONS) {
      const button = document.querySelector(`[data-afk-zone="${zone.id}"]`) as HTMLButtonElement | null;
      if (!button) continue;
      const selected = this.player.afkZone === zone.id;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.title = `${t(afkZoneLabelKey(zone.id))} - ${t("levelShort")} ${zone.effectiveLevel}`;
    }
  }

  private renderAchievements(): void {
    if (!this.player) return;
    const earned = new Set(this.player.achievements);
    const root = document.querySelector("#achievements")!;
    root.innerHTML = "";

    // Counter header.
    const total = ACHIEVEMENTS.length;
    const got = earned.size;
    const header = document.createElement("div");
    header.style.cssText = "padding:10px 12px;margin-bottom:12px;background:rgba(28,28,28,0.55);border:1px solid rgba(200,169,72,0.4);border-radius:4px;font-size:13px;color:#f3e7bf";
    header.innerHTML = `<strong>Tiến trình:</strong> ${got} / ${total} thành tựu mở khóa.`;
    root.appendChild(header);

    // Build per-achievement progress data using player counters.
    const player = this.player;
    const progress = (id: string): { cur: number; max: number } | undefined => {
      switch (id) {
        case "kill-100":       return { cur: Math.min(100, player.totalKills ?? 0), max: 100 };
        case "kill-500":       return { cur: Math.min(500, player.totalKills ?? 0), max: 500 };
        case "treasure-hoard": return { cur: Math.min(10, player.chestsOpened ?? 0), max: 10 };
        case "craft-master":   return { cur: Math.min(5, player.itemsCrafted ?? 0), max: 5 };
        case "pvp-champion":   return { cur: Math.min(10, player.pvpKills ?? 0), max: 10 };
        case "reach-level-5":  return { cur: Math.min(5, player.stats.level), max: 5 };
        case "reach-level-10": return { cur: Math.min(10, player.stats.level), max: 10 };
        case "reach-level-20": return { cur: Math.min(20, player.stats.level), max: 20 };
      }
      return undefined;
    };

    for (const achievement of ACHIEVEMENTS) {
      const unlocked = earned.has(achievement.id);
      const text = localizedAchievement(achievement);
      const p = progress(achievement.id);
      const pct = p ? (p.cur / p.max) * 100 : 0;
      const row = document.createElement("div");
      row.className = `achievement-card${unlocked ? " earned" : " locked"}`;
      const progressHtml = p && !unlocked
        ? `<div style="margin-top:4px;height:6px;background:#1a1a1a;border-radius:999px;overflow:hidden"><span style="display:block;height:100%;width:${pct}%;background:linear-gradient(to right,#c8a948,#ffd166);transition:width 200ms linear"></span></div><small style="color:#8e9192">${p.cur} / ${p.max}</small>`
        : "";
      row.innerHTML = `
        <i class="material-symbols-outlined" style="${unlocked ? "color:#ffd166" : ""}">${unlocked ? "workspace_premium" : "lock"}</i>
        <div>
          <strong>${escapeHtml(text.title)}</strong>
          <p>${escapeHtml(text.description)}</p>
          ${progressHtml}
        </div>
        <span>${unlocked ? t("earned") : t("locked")}</span>
      `;
      root.append(row);
    }
  }

  private renderQuest(quest: QuestView, mode: "available" | "active"): HTMLElement {
    const row = document.createElement("div");
    row.className = `quest-card category-${quest.category ?? "story"}${quest.completed ? " complete" : ""}`;
    const pct = Math.max(0, Math.min(1, quest.progress / quest.required));
    const catLabel = quest.category === "tutorial" ? "Tập sự" : quest.category === "daily" ? "Hằng ngày" : quest.category === "story" ? "Cốt truyện" : "";
    row.innerHTML = `
      <strong>${escapeHtml(quest.title)} ${catLabel ? `<span class="quest-cat-tag">${catLabel}</span>` : ""}</strong>
      <p>${escapeHtml(quest.description)}</p>
      <div class="quest-progress"><span style="width: ${pct * 100}%"></span><label>${quest.progress} / ${quest.required}</label></div>
      <em>${t("reward")}: ${quest.rewardGold} ${t("gold")} + ${quest.rewardExp} ${t("exp")}</em>
      <button type="button">${mode === "available" ? t("accept") : quest.completed ? t("claim") : t("inProgress")}</button>
    `;
    const button = row.querySelector("button")!;
    if (mode === "available") {
      button.addEventListener("click", () => this.onAcceptQuest(quest.id));
    } else if (quest.completed) {
      button.addEventListener("click", () => this.onClaimQuest(quest.id));
    } else {
      button.setAttribute("disabled", "true");
    }
    return row;
  }
}

function isAfkZone(value: unknown): value is AfkZone {
  return AFK_ZONE_DEFINITIONS.some((zone) => zone.id === value);
}

function afkZoneLabelKey(zone: AfkZone): "zoneGreenwood" | "zoneMidlands" | "zoneDeeplands" {
  if (zone === "midlands") return "zoneMidlands";
  if (zone === "deeplands") return "zoneDeeplands";
  return "zoneGreenwood";
}

function sectionTitle(label: string): HTMLElement {
  const title = document.createElement("div");
  title.className = "quest-section-title";
  title.textContent = label;
  return title;
}

function setBar(fillSelector: string, labelSelector: string, value: number, max: number, label: string): void {
  const pct = Math.max(0, Math.min(1, value / max));
  (document.querySelector(fillSelector) as HTMLElement).style.width = `${pct * 100}%`;
  document.querySelector(labelSelector)!.textContent = `${label} ${Math.floor(value)} / ${max}`;
}

function statCard(stat: AllocatableStat, className: string, icon: string, label: string, value: number, canAllocate: boolean): string {
  return `
    <div class="stat-card ${className}">
      <i class="material-symbols-outlined">${icon}</i>
      <span>${label}</span>
      <div class="stat-value-row">
        <strong>${value}</strong>
        ${canAllocate ? `<button type="button" class="stat-allocate-button" data-stat="${stat}" title="${t("allocateStat")}">+</button>` : ""}
      </div>
    </div>
  `;
}

function isAllocatableStat(value: unknown): value is AllocatableStat {
  return value === "attack" || value === "defense" || value === "maxHp";
}

type SkillNameKey = "skillPowerStrike" | "skillCleave" | "skillSwiftStrike" | "skillHeal" | "skillPiercingStrike" | "skillWhirlwind" | "skillSwiftBlade" | "skillGreaterHeal" | "skillLifedrain" | "skillFlameBurst" | "skillThunderStrike" | "skillIcicleStorm" | "skillShadowAssault" | "skillHealingWave" | "skillDivineLight" | "skillVoidNova";
type SkillDescKey = "skillPowerStrikeDesc" | "skillCleaveDesc" | "skillSwiftStrikeDesc" | "skillHealDesc" | "skillPiercingStrikeDesc" | "skillWhirlwindDesc" | "skillSwiftBladeDesc" | "skillGreaterHealDesc" | "skillLifedrainDesc" | "skillFlameBurstDesc" | "skillThunderStrikeDesc" | "skillIcicleStormDesc" | "skillShadowAssaultDesc" | "skillHealingWaveDesc" | "skillDivineLightDesc" | "skillVoidNovaDesc";

const SKILL_NAME_KEYS: Record<SkillId, SkillNameKey> = {
  powerStrike: "skillPowerStrike",
  cleave: "skillCleave",
  swiftStrike: "skillSwiftStrike",
  heal: "skillHeal",
  piercingStrike: "skillPiercingStrike",
  whirlwind: "skillWhirlwind",
  swiftBlade: "skillSwiftBlade",
  greaterHeal: "skillGreaterHeal",
  lifedrain: "skillLifedrain",
  flameBurst: "skillFlameBurst",
  thunderStrike: "skillThunderStrike",
  icicleStorm: "skillIcicleStorm",
  shadowAssault: "skillShadowAssault",
  healingWave: "skillHealingWave",
  divineLight: "skillDivineLight",
  voidNova: "skillVoidNova"
};

const SKILL_DESC_KEYS: Record<SkillId, SkillDescKey> = {
  powerStrike: "skillPowerStrikeDesc",
  cleave: "skillCleaveDesc",
  swiftStrike: "skillSwiftStrikeDesc",
  heal: "skillHealDesc",
  piercingStrike: "skillPiercingStrikeDesc",
  whirlwind: "skillWhirlwindDesc",
  swiftBlade: "skillSwiftBladeDesc",
  greaterHeal: "skillGreaterHealDesc",
  lifedrain: "skillLifedrainDesc",
  flameBurst: "skillFlameBurstDesc",
  thunderStrike: "skillThunderStrikeDesc",
  icicleStorm: "skillIcicleStormDesc",
  shadowAssault: "skillShadowAssaultDesc",
  healingWave: "skillHealingWaveDesc",
  divineLight: "skillDivineLightDesc",
  voidNova: "skillVoidNovaDesc"
};

function skillNameKey(id: SkillId): SkillNameKey {
  return SKILL_NAME_KEYS[id];
}

function skillDescKey(id: SkillId): SkillDescKey {
  return SKILL_DESC_KEYS[id];
}

function formatElapsed(elapsedMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function describeItem(item: Item): string {
  if (item.kind === "consumable") {
    return `${item.name}\n${t(item.rarity)} ${t("consumable")}\n${t("heals")}: ${item.heal} ${t("hp")}\n${t("value")}: ${item.value} ${t("gold")}`;
  }
  if (item.kind === "material") {
    return `${item.name}\nNguyên liệu chế tạo\n${t("value")}: ${item.value} ${t("gold")}`;
  }
  const stats = Object.entries(item.stats).map(([key, value]) => `+${value} ${statLabel(key)}`).join(" ");
  return `${item.name}\n${t(item.rarity)} ${t(item.slot)}\n${stats}\n${t("value")}: ${item.value} ${t("gold")}`;
}

function shortStats(item: Item): string {
  if (item.kind === "consumable") return `${t("heals")} ${item.heal} ${t("hp")}`;
  if (item.kind === "material") return "Nguyên liệu";
  return Object.entries(item.stats).map(([key, value]) => `+${value} ${statLabel(key)}`).join("  ");
}

function itemIcon(item: Item): string {
  if (item.kind === "consumable") return t("itemPotion");
  if (item.kind === "material") return "Mảnh";
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
  if (item.kind === "consumable") return "local_drink";
  if (item.kind === "material") return "diamond";
  return materialIcon(item.slot);
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
  if (stat === "speed") return "% tốc độ";
  if (stat === "maxHp") return t("maxHp");
  if (stat === "attack") return t("attack");
  if (stat === "defense") return t("defense");
  return stat;
}

function localizedAchievement(achievement: Achievement): Achievement {
  switch (achievement.id) {
    case "first-blood":
      return { ...achievement, title: t("achievementFirstBloodTitle"), description: t("achievementFirstBloodDescription") };
    case "reach-level-5":
      return { ...achievement, title: t("achievementReachLevel5Title"), description: t("achievementReachLevel5Description") };
    case "reach-level-10":
      return { ...achievement, title: t("achievementReachLevel10Title"), description: t("achievementReachLevel10Description") };
    case "slay-elite":
      return { ...achievement, title: t("achievementSlayEliteTitle"), description: t("achievementSlayEliteDescription") };
    case "slay-boss":
      return { ...achievement, title: t("achievementSlayBossTitle"), description: t("achievementSlayBossDescription") };
    case "epic-find":
      return { ...achievement, title: t("achievementEpicFindTitle"), description: t("achievementEpicFindDescription") };
    case "idler":
      return { ...achievement, title: t("achievementIdlerTitle"), description: t("achievementIdlerDescription") };
    case "socialite":
      return { ...achievement, title: t("achievementSocialiteTitle"), description: t("achievementSocialiteDescription") };
    default:
      return achievement;
  }
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
