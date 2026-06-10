import { ACHIEVEMENTS, mountLabel, GEM_CATALOG, getStatGem, dailyDealCosmetic, dailyDealPrice, AFK_ZONE_DEFINITIONS, BAG_MAX_BONUS, GEM_TO_GOLD_RATE, GOLD_BOOST_GEM_COST, isGoldBoostActive, XP_BOOST_GEM_COST, isXpBoostActive, RAGE_GEM_COST, isRageActive, RESPEC_COST_PER_POINT, LEVEL_MILESTONES, ACHIEVEMENT_MILESTONES, WEEKLY_CLAIM_INTERVAL_MS, BATTLE_PASS_EXP_PER_TIER, BATTLE_PASS_TIERS, CLASS_CATALOG, COSMETICS, GUILD_BOOST_GEM_COST, GUILD_CREATE_COST_GOLD, GUILD_DONATE_MIN, GUILD_MOTD_MAX, MATERIAL_CATALOG, PLAYER_CLASSES, RECIPES, BREW_RECIPES, SKILL_CATALOG, SKILL_IDS, SKILL_LOADOUT_SIZE, SKILL_MAX_RANK, VIP_PACKAGES, bagCapacity, bagUpgradeCost, canManageGuild, describeBattlePassReward, expToNextLevel, guildRankLabel, isVipActive, vipRemainingDays } from "@mmorpg/shared";
import { MARKET_FEATURE_GEM_COST, MARKET_MAX_LISTINGS_PER_SELLER, MARKET_TAX_RATE, PET_CATALOG, PET_FEED_GOLD_COST, PET_TREAT_GEM_COST, MOUNT_CATALOG, STREAK_REWARDS, TITLES, canClaimStreakToday, filterListings, petBuffAtLevel, petLevelForXp, petXpProgress, sortListings, titleLabel, MONSTER_DEFINITIONS, BESTIARY_TIERS, bestiaryTierForKills, nextBestiaryTier, type MarketKindFilter, type MarketSortKey } from "@mmorpg/shared";
import type { Achievement, AfkZone, AllocatableStat, ChatMessage, EquipmentSlot, GuildChatPayload, GuildInvitePayload, GuildLeaderboardRow, GuildRaidView, GuildView, Item, MailMessage, MarketListingView, MaterialId, MaterialItem, MonsterState, OfflineRewardsEvent, PartyInvite, PartyView, PlayerClass, PlayerState, QuestCategory, QuestListPayload, QuestView, Rarity, ShopItem, SkillId } from "@mmorpg/shared";
import { getLanguage, setLanguage, t, translateMonsterName, type Language } from "../i18n";

const rarityClass = {
  common: "rarity-common",
  rare: "rarity-rare",
  epic: "rarity-epic"
};

export class Hud {
  private player?: PlayerState;
  private selectedItemId?: string;
  private buffTimer?: ReturnType<typeof setInterval>;
  private mail: MailMessage[] = [];
  private prevMailCount = 0;
  private autoRetargetEnabled = false;
  private skillCooldowns: Record<SkillId, number> = { powerStrike: 0, cleave: 0, swiftStrike: 0, heal: 0, piercingStrike: 0, whirlwind: 0, swiftBlade: 0, greaterHeal: 0, lifedrain: 0, flameBurst: 0, thunderStrike: 0, icicleStorm: 0, shadowAssault: 0, healingWave: 0, divineLight: 0, voidNova: 0 };
  private party: PartyView | null = null;
  private pendingInvitePartyId?: string;
  private offlineRewardsOpen = false;
  private guild: GuildView | null = null;
  private pendingGuildInvite?: GuildInvitePayload;
  private guildRanking: GuildLeaderboardRow[] = [];
  private guildRaid: GuildRaidView | null = null;
  private onRaidHandlers?: { summon: () => void; attack: () => void };
  private earnedTitleIds: string[] = [];
  private onSetTitle?: (titleId: string | null) => void;
  private market: MarketListingView[] = [];
  private marketTab: "browse" | "sell" | "mine" = "browse";
  private marketQuery = "";
  private marketKind: MarketKindFilter = "all";
  private marketSort: MarketSortKey = "featured";

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
    private readonly onEnchant: (itemId: string) => void = () => {},
    private readonly onBuyCosmetic: (cosmeticId: string) => void = () => {},
    private readonly onEquipCosmetic: (cosmeticId: string | null) => void = () => {},
    private readonly onClaimDaily: () => void = () => {},
    private readonly onBuyBattlePass: () => void = () => {},
    private readonly onClaimBattlePass: (tier: number, track: "free" | "premium") => void = () => {},
    private readonly onBuyVip: (days: number) => void = () => {},
    private readonly onClaimVipDaily: () => void = () => {},
    private readonly onClaimStreak: () => void = () => {},
    private readonly onBuyPet: (petId: string) => void = () => {},
    private readonly onEquipPet: (petId: string | null) => void = () => {},
    private readonly onFeedPet: () => void = () => {},
    private readonly onPetTreat: () => void = () => {},
    private readonly onBuyMysteryBox: () => void = () => {},
    private readonly onBuyBagSlots: () => void = () => {},
    private readonly onExchangeGems: (gems: number) => void = () => {},
    private readonly onBuyGoldBoost: () => void = () => {},
    private readonly onSellAllMaterials: () => void = () => {},
    private readonly onSalvage: (itemId: string) => void = () => {},
    private readonly onToggleLock: (itemId: string) => void = () => {},
    private readonly onSalvageJunk: () => void = () => {},
    private readonly onBuyXpBoost: () => void = () => {},
    private readonly onBuyRagePotion: () => void = () => {},
    private readonly onUpgradeItem: (itemId: string) => void = () => {},
    private readonly onRespecTalents: () => void = () => {},
    private readonly onClaimMilestone: (level: number) => void = () => {},
    private readonly onBrew: (recipeId: string) => void = () => {},
    private readonly onBuyMount: (mountId: string) => void = () => {},
    private readonly onEquipMount: (mountId: string | null) => void = () => {},
    private readonly onClaimAchMilestone: (count: number) => void = () => {},
    private readonly onSetAutoSalvage: (rarity: "off" | "common" | "rare") => void = () => {},
    private readonly onClaimStarterPack: () => void = () => {},
    private readonly onFuseGear: () => void = () => {},
    private readonly onSacrificePet: (petId: string) => void = () => {},
    private readonly onSocketGem: (itemId: string, gemId: string) => void = () => {},
    private readonly onUnsocketGem: (itemId: string) => void = () => {},
    private readonly onClaimWeekly: () => void = () => {},
    private readonly onSendMail: (to: string, gold: number, message: string, itemId?: string) => void = () => {},
    private readonly onRequestMail: () => void = () => {},
    private readonly onClaimMail: (mailId: string) => void = () => {},
    private readonly onBuyDailyDeal: () => void = () => {},
    private readonly onClaimAllMail: () => void = () => {},
    private readonly onGiftFriends: (goldEach: number) => void = () => {}
  ) {
    this.applyLanguage();
    const form = document.querySelector("#chat-form") as HTMLFormElement;
    const input = document.querySelector("#chat-input") as HTMLInputElement;
    const languageSelect = document.querySelector("#language-select") as HTMLSelectElement;
    const muteButton = document.querySelector("#sound-toggle") as HTMLButtonElement;
    const sellJunkButton = document.querySelector("#sell-junk-button") as HTMLButtonElement;
    sellJunkButton.addEventListener("click", () => this.onSellJunk());
    // Sprint 152: one-click mass-salvage of common "junk" gear into materials.
    if (sellJunkButton && !document.querySelector("#salvage-junk-button")) {
      const salvageJunkButton = document.createElement("button");
      salvageJunkButton.id = "salvage-junk-button";
      salvageJunkButton.type = "button";
      salvageJunkButton.textContent = "🔨 Phân giải rác";
      salvageJunkButton.addEventListener("click", () => this.onSalvageJunk());
      sellJunkButton.insertAdjacentElement("afterend", salvageJunkButton);
    }
    // Sprint 176: auto-salvage loot-filter selector.
    if (sellJunkButton && !document.querySelector("#auto-salvage-select")) {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#9aa0a6;margin-left:6px";
      wrap.innerHTML = `🔧 Tự phân giải: <select id="auto-salvage-select" style="background:#15171d;color:#e8ecf5;border:1px solid #2a2f3a;border-radius:4px;font-size:11px;padding:2px"><option value="off">Tắt</option><option value="common">Đồ Thường</option><option value="rare">Thường+Hiếm</option></select>`;
      (document.querySelector("#salvage-junk-button") ?? sellJunkButton).insertAdjacentElement("afterend", wrap);
      wrap.querySelector<HTMLSelectElement>("#auto-salvage-select")?.addEventListener("change", (e) => {
        const v = (e.target as HTMLSelectElement).value as "off" | "common" | "rare";
        this.onSetAutoSalvage(v);
      });
    }
    // Sprint 181: fuse 3 commons → 1 rare button.
    if (sellJunkButton && !document.querySelector("#fuse-gear-button")) {
      const fuseBtn = document.createElement("button");
      fuseBtn.id = "fuse-gear-button";
      fuseBtn.type = "button";
      fuseBtn.textContent = "🔮 Hợp nhất (3 Thường→1 Hiếm)";
      fuseBtn.addEventListener("click", () => this.onFuseGear());
      (document.querySelector("#salvage-junk-button") ?? sellJunkButton).insertAdjacentElement("afterend", fuseBtn);
    }
    document.querySelector("#bag-expand-button")?.addEventListener("click", () => this.onBuyBagSlots());
    document.querySelector("#sell-materials-button")?.addEventListener("click", () => this.onSellAllMaterials());
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
      u: "guild-modal",         // 'u' for guild/union
      m: "market-modal",        // 'm' for market/chợ
      l: "streak-modal",        // 'l' for login/điểm danh
      t: "titles-modal",        // 't' for titles/danh hiệu
      p: "pets-modal",          // 'p' for pets/linh thú
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
      if (!isOpen && modalId === "market-modal") window.dispatchEvent(new CustomEvent("hotkey-market"));
      if (!isOpen && modalId === "guild-modal") window.dispatchEvent(new CustomEvent("hotkey-guild"));
      if (!isOpen && modalId === "titles-modal") window.dispatchEvent(new CustomEvent("hotkey-titles"));
    });
    this.setParty(null);
    this.renderSoundToggle();
    this.installPanelCollapseButtons();
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
      // Drop focus so the checkbox doesn't keep keyboard focus and freeze movement.
      autoRetargetToggle.blur();
    });
    // Sprint 223: fishing button — fires the cast and sweeps a 5s cooldown.
    const fishBtn = document.querySelector<HTMLButtonElement>("#fish-btn");
    fishBtn?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("do-fish"));
      fishBtn.disabled = true;
      fishBtn.style.opacity = "0.35";
      setTimeout(() => { fishBtn.disabled = false; fishBtn.style.opacity = ""; }, 5000);
      fishBtn.blur();
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

  // Sprint 163: render the timed-buff strip with live mm:ss countdowns.
  private renderBuffStrip(): void {
    const player = this.player;
    if (!player) return;
    let buffRow = document.querySelector<HTMLDivElement>("#buff-row");
    if (!buffRow) {
      const playerPanel = document.querySelector(".player-panel");
      if (!playerPanel) return;
      buffRow = document.createElement("div");
      buffRow.id = "buff-row";
      buffRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px;font-size:11px";
      playerPanel.appendChild(buffRow);
    }
    const fmt = (until?: number) => {
      const sec = Math.max(0, Math.round(((until ?? 0) - Date.now()) / 1000));
      const m = Math.floor(sec / 60), s = sec % 60;
      return `${m}'${s.toString().padStart(2, "0")}"`;
    };
    const chips: string[] = [];
    if (isVipActive(player.vipUntil)) chips.push(`<span style="background:#3a2f00;color:#ffd166;padding:2px 7px;border-radius:9px">🌟 VIP · ${vipRemainingDays(player.vipUntil)} ngày</span>`);
    if (isGoldBoostActive(player.goldBoostUntil)) chips.push(`<span style="background:#3a3000;color:#ffd166;padding:2px 7px;border-radius:9px">🪙 +50% vàng · ${fmt(player.goldBoostUntil)}</span>`);
    if (isXpBoostActive(player.xpBoostUntil)) chips.push(`<span style="background:#0d2440;color:#7db8ff;padding:2px 7px;border-radius:9px">📘 +50% XP · ${fmt(player.xpBoostUntil)}</span>`);
    if (isRageActive(player.rageUntil)) chips.push(`<span style="background:#3a1414;color:#ff8a6a;padding:2px 7px;border-radius:9px">⚔️ +25% ST · ${fmt(player.rageUntil)}</span>`);
    if (player.activeMount) chips.push(`<span style="background:#1c2a14;color:#9be88b;padding:2px 7px;border-radius:9px">🐎 ${mountLabel(player.activeMount) ?? "Thú cưỡi"}</span>`);
    buffRow.innerHTML = chips.join("");
    buffRow.style.display = chips.length ? "flex" : "none";
  }

  setPlayer(player: PlayerState): void {
    this.player = player;
    this.updateClassModal(player);
    const classLabel = player.playerClass ? ` [${CLASS_CATALOG[player.playerClass].name}]` : "";
    const vipBadge = isVipActive(player.vipUntil) ? " 🌟" : "";
    const titleText = titleLabel(player.activeTitle);
    const titlePrefix = titleText ? `«${titleText}» ` : "";
    document.querySelector("#player-name")!.textContent = `${titlePrefix}${player.accountName}${vipBadge}${classLabel} - ${t("levelShort")} ${player.stats.level}`;
    setBar("#hp-fill", "#hp-label", player.stats.hp, player.stats.maxHp, t("hp"));
    setBar("#exp-fill", "#exp-label", player.stats.exp, expToNextLevel(player.stats.level), t("exp"));
    const maxStam = player.stats.maxStamina ?? 100;
    const curStam = player.stats.stamina ?? maxStam;
    setBar("#stamina-fill", "#stamina-label", Math.round(curStam), maxStam, "Thể lực");
    // Currency badge row.
    let badgeRow = document.querySelector<HTMLDivElement>("#currency-row");
    if (!badgeRow) {
      const playerPanel = document.querySelector(".player-panel");
      if (playerPanel) {
        badgeRow = document.createElement("div");
        badgeRow.id = "currency-row";
        badgeRow.style.cssText = "display:flex;gap:10px;align-items:center;margin-top:6px;font-size:12px";
        playerPanel.appendChild(badgeRow);
      }
    }
    if (badgeRow) {
      badgeRow.innerHTML = `<span style="color:#ffd166">${player.stats.gold} 🪙</span><span style="color:#cdb6ff">${player.gems ?? 0} 💎</span>`;
    }
    // Sprint 157/163: active-buff strip — surface timed boosts with live
    // countdowns (re-rendered every second by an interval).
    this.renderBuffStrip();
    if (!this.buffTimer) this.buffTimer = setInterval(() => this.renderBuffStrip(), 1000);
    // Sprint 165: claimable level-milestone reward chests.
    let msRow = document.querySelector<HTMLDivElement>("#milestone-row");
    if (!msRow) {
      const playerPanel = document.querySelector(".player-panel");
      if (playerPanel) {
        msRow = document.createElement("div");
        msRow.id = "milestone-row";
        msRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px";
        playerPanel.appendChild(msRow);
      }
    }
    if (msRow) {
      const claimed = new Set(player.claimedMilestones ?? []);
      const ready = LEVEL_MILESTONES.filter((m) => player.stats.level >= m.level && !claimed.has(m.level));
      const claimedAch = new Set(player.claimedAchTiers ?? []);
      const achCount = player.achievements?.length ?? 0;
      const achReady = ACHIEVEMENT_MILESTONES.filter((m) => achCount >= m.count && !claimedAch.has(m.count));
      msRow.innerHTML = ready.map((m) =>
        `<button type="button" data-ms="${m.level}" style="background:linear-gradient(to bottom,#7bd88f,#3fa85f);color:#08240f;font-weight:700;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">🎁 Nhận mốc cấp ${m.level}</button>`
      ).join("") + achReady.map((m) =>
        `<button type="button" data-ach="${m.count}" style="background:linear-gradient(to bottom,#ffd166,#c8a948);color:#1d1500;font-weight:700;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">🏅 Mốc ${m.count} thành tựu (+${m.gems}💎)</button>`
      ).join("");
      const starterBtn = !player.starterPackClaimed
        ? `<button type="button" data-starter="1" style="background:linear-gradient(to bottom,#7db8ff,#3f6fd6);color:#06122a;font-weight:700;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">🎁 Nhận Gói Tân Thủ</button>`
        : "";
      const weeklyReady = Date.now() - (player.lastWeeklyClaimAt ?? 0) >= WEEKLY_CLAIM_INTERVAL_MS;
      const weeklyBtn = weeklyReady
        ? `<button type="button" data-weekly="1" style="background:linear-gradient(to bottom,#c79bff,#7b5fb0);color:#1a0c2e;font-weight:700;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">📦 Thưởng tuần</button>`
        : "";
      msRow.innerHTML += starterBtn + weeklyBtn;
      msRow.querySelector<HTMLButtonElement>("[data-starter]")?.addEventListener("click", () => this.onClaimStarterPack());
      msRow.querySelector<HTMLButtonElement>("[data-weekly]")?.addEventListener("click", () => this.onClaimWeekly());
      msRow.style.display = (ready.length || achReady.length || !player.starterPackClaimed || weeklyReady) ? "flex" : "none";
      msRow.querySelectorAll<HTMLButtonElement>("[data-ms]").forEach((btn) =>
        btn.addEventListener("click", () => this.onClaimMilestone(Number(btn.dataset.ms)))
      );
      msRow.querySelectorAll<HTMLButtonElement>("[data-ach]").forEach((btn) =>
        btn.addEventListener("click", () => this.onClaimAchMilestone(Number(btn.dataset.ach)))
      );
    }
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
    this.renderGemShop();
    this.renderBattlePass();
    this.renderVipModal();
    this.renderGuildModal();
    this.renderMarketModal();
    this.renderStreakModal();
    this.renderTitlesModal();
    this.renderBestiaryModal();
    this.renderPetsModal();
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
    // Sprint 171: alchemy brewing — HP potions from materials.
    for (const brew of BREW_RECIPES) {
      const card = document.createElement("div");
      card.className = "forge-recipe rarity-common";
      const header = document.createElement("div");
      header.className = "forge-name";
      header.textContent = `⚗️ ${brew.name} (+${brew.heal} HP)`;
      card.appendChild(header);
      const cost = document.createElement("div");
      cost.className = "forge-cost";
      let canBrew = true;
      for (const [mid, qty] of Object.entries(brew.cost) as [MaterialId, number][]) {
        const have = owned.get(mid) ?? 0;
        if (have < qty) canBrew = false;
        const span = document.createElement("span");
        span.className = have >= qty ? "ok" : "missing";
        span.textContent = `${MATERIAL_CATALOG[mid].name}: ${have}/${qty}`;
        cost.appendChild(span);
      }
      card.appendChild(cost);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "forge-craft";
      btn.disabled = !canBrew;
      btn.textContent = canBrew ? "Luyện đan" : "Thiếu nguyên liệu";
      btn.addEventListener("click", () => this.onBrew(brew.id));
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
    const spentRanks = Object.values(this.player.skillRanks ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    header.innerHTML = `<strong>Điểm tài năng:</strong> <span class="talent-points">${talentPoints}</span> <span class="talent-hint">— Mỗi cấp được +1, dùng để tăng cấp skill (+25% sức mạnh mỗi cấp, tối đa ${SKILL_MAX_RANK} cấp)</span> ${spentRanks > 0 ? `<button type="button" class="talent-respec" data-action="respec">↺ Tẩy điểm (${RESPEC_COST_PER_POINT * spentRanks} 🪙)</button>` : ""}`;
    header.querySelector('[data-action="respec"]')?.addEventListener("click", () => this.onRespecTalents());
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

  private vipWired = false;
  private renderVipModal(): void {
    if (!this.player) return;
    const balance = document.querySelector<HTMLSpanElement>("#vip-balance");
    if (balance) balance.textContent = `💎 ${this.player.gems ?? 0}`;
    const status = document.querySelector<HTMLDivElement>("#vip-status");
    if (status) {
      const active = isVipActive(this.player.vipUntil);
      const days = vipRemainingDays(this.player.vipUntil);
      if (active) {
        status.innerHTML = `<strong style="color:#ffd166">🌟 VIP đang hoạt động</strong> — còn ${days} ngày <button id="vip-claim-daily" type="button" style="margin-left:auto;padding:6px 14px;color:#1d1500;font-weight:700;background:linear-gradient(to bottom,#ffd166,#c8a948);border:none;border-radius:4px;cursor:pointer">Nhận 30 💎 hôm nay</button>`;
        status.style.display = "flex";
        status.style.alignItems = "center";
        status.style.gap = "10px";
      } else {
        status.innerHTML = `<strong style="color:#8e9192">Hiện không phải VIP</strong> — chọn gói bên dưới để kích hoạt buff.`;
      }
    }
    const root = document.querySelector<HTMLDivElement>("#vip-packages");
    if (!root) return;
    root.innerHTML = "";
    for (const pkg of VIP_PACKAGES) {
      const card = document.createElement("div");
      card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:10px;background:rgba(28,28,28,0.6);border:1px solid rgba(255,209,102,0.3);border-radius:6px";
      const canAfford = (this.player.gems ?? 0) >= pkg.gemPrice;
      card.innerHTML = `
        <div style="flex:1">
          <strong style="color:#ffd166">${pkg.label}</strong>
          <p style="margin:4px 0 0;color:#bdbdbd;font-size:12px">${pkg.description}</p>
        </div>
        <button type="button" data-vip-days="${pkg.days}" ${canAfford ? "" : "disabled"} style="padding:10px 16px;color:#1d1500;font-weight:700;background:${canAfford ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#444"};border:none;border-radius:4px;cursor:${canAfford ? "pointer" : "not-allowed"}">💎 ${pkg.gemPrice}</button>
      `;
      card.querySelector<HTMLButtonElement>("[data-vip-days]")?.addEventListener("click", () => this.onBuyVip(pkg.days));
      root.appendChild(card);
    }
    if (!this.vipWired) {
      this.vipWired = true;
      document.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).id === "vip-claim-daily") this.onClaimVipDaily();
      });
    }
  }

  private streakWired = false;
  private renderStreakModal(): void {
    if (!this.player) return;
    const body = document.querySelector<HTMLDivElement>("#streak-body");
    if (!body) return;
    const streak = this.player.loginStreak ?? 0;
    const claimable = canClaimStreakToday(this.player.streakLastClaimDate);
    // The position highlighted is the day the NEXT claim will land on.
    const nextDay = claimable ? (((Math.max(0, streak)) % 7) + 1) : (((Math.max(1, streak) - 1) % 7) + 1);
    const cells = STREAK_REWARDS.map((r) => {
      const isNext = claimable && r.day === nextDay;
      const claimed = !claimable && r.day === nextDay;
      const bg = isNext ? "linear-gradient(to bottom,#ffd166,#c8a948)" : claimed ? "rgba(110,76,155,0.35)" : "rgba(28,28,28,0.6)";
      const color = isNext ? "#1d1500" : "#e8dcff";
      return `<div style="flex:1;min-width:64px;text-align:center;padding:10px 6px;border-radius:6px;background:${bg};border:1px solid ${isNext ? "#ffd166" : "#39424b"}">
        <div style="font-size:11px;color:${isNext ? "#5a4500" : "#8e9192"}">Ngày ${r.day}</div>
        <div style="font-size:18px;margin:2px 0">${r.gems > 0 ? "💎" : "🪙"}</div>
        <div style="font-size:11px;font-weight:700;color:${color}">${escapeHtml(r.label)}</div>
      </div>`;
    }).join("");
    body.innerHTML = `
      <p style="color:#d6dddf;font-size:13px;margin:0 0 12px">Điểm danh mỗi ngày để nhận thưởng tăng dần. Chuỗi hiện tại: <strong style="color:#ffd166">${streak} ngày</strong>. Lỡ một ngày sẽ về lại ngày 1.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${cells}</div>
      <button id="streak-claim-btn" type="button" ${claimable ? "" : "disabled"} style="width:100%;padding:12px;border:none;border-radius:6px;font-weight:700;font-size:15px;color:${claimable ? "#1d1500" : "#888"};background:${claimable ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#333"};cursor:${claimable ? "pointer" : "not-allowed"}">${claimable ? "📅 Điểm danh hôm nay" : "✓ Hôm nay đã điểm danh"}</button>`;
    if (!this.streakWired) {
      this.streakWired = true;
      document.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).id === "streak-claim-btn") this.onClaimStreak();
      });
    }
  }

  private bpWired = false;
  private renderBattlePass(): void {
    if (!this.player) return;
    const level = this.player.battlePassLevel ?? 0;
    const exp = this.player.battlePassExp ?? 0;
    const premium = this.player.battlePassPremium === true;
    const claimedFree = new Set(this.player.battlePassClaimedFree ?? []);
    const claimedPremium = new Set(this.player.battlePassClaimedPremium ?? []);
    const levelEl = document.querySelector<HTMLSpanElement>("#bp-level");
    if (levelEl) levelEl.textContent = `Cấp ${level}${premium ? " — PREMIUM ★" : ""}`;
    const fill = document.querySelector<HTMLSpanElement>("#bp-progress-fill");
    if (fill) fill.style.width = `${Math.min(100, (exp / BATTLE_PASS_EXP_PER_TIER) * 100)}%`;
    const label = document.querySelector<HTMLLabelElement>("#bp-progress-label");
    if (label) label.textContent = `${exp} / ${BATTLE_PASS_EXP_PER_TIER}`;
    const banner = document.querySelector<HTMLDivElement>("#bp-premium-banner");
    if (banner) banner.style.display = premium ? "none" : "flex";
    const root = document.querySelector<HTMLDivElement>("#bp-tiers");
    if (!root) return;
    root.innerHTML = "";
    for (const tier of BATTLE_PASS_TIERS) {
      const unlocked = tier.level <= level;
      const row = document.createElement("div");
      row.style.cssText = `display:grid;grid-template-columns:60px 1fr 1fr;gap:10px;padding:10px;margin-bottom:8px;background:rgba(28,28,28,0.55);border:1px solid ${unlocked ? "rgba(255,209,102,0.5)" : "rgba(142,145,146,0.25)"};border-radius:4px`;
      const tierBadge = document.createElement("div");
      tierBadge.style.cssText = `display:grid;place-items:center;font-size:18px;font-weight:900;color:${unlocked ? "#ffd166" : "#777"};border:2px solid ${unlocked ? "#ffd166" : "#444"};border-radius:50%`;
      tierBadge.textContent = `${tier.level}`;
      row.appendChild(tierBadge);
      // Free
      const freeCol = document.createElement("div");
      freeCol.innerHTML = `<small style="color:#8e9192">FREE</small><div style="margin-top:4px;color:#d6dddf">${describeBattlePassReward(tier.freeReward)}</div>`;
      const fBtn = document.createElement("button");
      fBtn.type = "button";
      fBtn.textContent = claimedFree.has(tier.level) ? "Đã nhận" : "Nhận";
      fBtn.disabled = !unlocked || claimedFree.has(tier.level);
      fBtn.style.cssText = `margin-top:4px;padding:4px 10px;color:#1d1500;font-size:11px;font-weight:700;background:${claimedFree.has(tier.level) ? "#444" : "#ffd166"};border:none;border-radius:3px;cursor:${claimedFree.has(tier.level) ? "default" : "pointer"}`;
      fBtn.addEventListener("click", () => this.onClaimBattlePass(tier.level, "free"));
      freeCol.appendChild(fBtn);
      row.appendChild(freeCol);
      // Premium
      const premCol = document.createElement("div");
      const lockIcon = premium ? "" : ` 🔒`;
      premCol.innerHTML = `<small style="color:#c79bff">PREMIUM${lockIcon}</small><div style="margin-top:4px;color:#d6dddf">${describeBattlePassReward(tier.premiumReward)}</div>`;
      const pBtn = document.createElement("button");
      pBtn.type = "button";
      pBtn.textContent = claimedPremium.has(tier.level) ? "Đã nhận" : "Nhận";
      pBtn.disabled = !unlocked || !premium || claimedPremium.has(tier.level);
      pBtn.style.cssText = `margin-top:4px;padding:4px 10px;color:#fff;font-size:11px;font-weight:700;background:${claimedPremium.has(tier.level) ? "#444" : premium ? "#6e4c9b" : "#3a3a3a"};border:none;border-radius:3px;cursor:${premium && !claimedPremium.has(tier.level) ? "pointer" : "default"}`;
      pBtn.addEventListener("click", () => this.onClaimBattlePass(tier.level, "premium"));
      premCol.appendChild(pBtn);
      row.appendChild(premCol);
      root.appendChild(row);
    }
    if (!this.bpWired) {
      this.bpWired = true;
      document.querySelector<HTMLButtonElement>("#bp-buy-premium")?.addEventListener("click", () => this.onBuyBattlePass());
    }
  }

  private gemShopWired = false;
  showMysteryBoxResult(label: string): void {
    const el = document.querySelector<HTMLElement>("#mystery-result");
    if (el) el.textContent = `🎉 ${label}`;
    this.showTopBannerProxy?.(`🎁 Rương Bí Ẩn: ${label}`);
  }

  private showTopBannerProxy?: (text: string) => void;
  setMysteryBannerProxy(fn: (text: string) => void): void {
    this.showTopBannerProxy = fn;
  }

  private renderGemShop(): void {
    if (!this.player) return;
    const gemBalance = document.querySelector<HTMLSpanElement>("#gem-balance");
    if (gemBalance) gemBalance.textContent = `💎 ${this.player.gems ?? 0}`;
    const root = document.querySelector<HTMLDivElement>("#gem-shop-items");
    if (!root) return;
    root.innerHTML = "";
    // Mystery box banner (Sprint 68) at the top of the gem shop.
    const box = document.createElement("div");
    box.className = "gem-shop-card";
    box.style.cssText = "background:linear-gradient(to right,rgba(199,155,255,0.18),rgba(255,209,102,0.12));border:1px solid rgba(199,155,255,0.5)";
    box.innerHTML = `
      <div class="gem-shop-swatch" style="background:radial-gradient(circle,#ffd166,#6e4c9b);display:flex;align-items:center;justify-content:center;font-size:20px">🎁</div>
      <div class="gem-shop-info">
        <strong>Rương Bí Ẩn</strong>
        <p>Mở ra vàng, Gem, cosmetic hoặc linh thú ngẫu nhiên (trùng → đền Gem).</p>
        <small id="mystery-result" style="color:#ffd166"></small>
      </div>
      <div class="gem-shop-action"><button id="mystery-buy-btn" class="gem-shop-buy-btn" type="button">💎 50 — Mở</button></div>`;
    root.appendChild(box);
    box.querySelector<HTMLButtonElement>("#mystery-buy-btn")?.addEventListener("click", () => this.onBuyMysteryBox());
    // Gem → Gold exchange row (Sprint 78).
    const ex = document.createElement("div");
    ex.className = "gem-shop-card";
    ex.style.cssText = "align-items:center";
    ex.innerHTML = `
      <div class="gem-shop-swatch" style="background:linear-gradient(135deg,#cdb6ff,#ffd166);display:flex;align-items:center;justify-content:center;font-size:18px">💱</div>
      <div class="gem-shop-info"><strong>Đổi Gem → Vàng</strong><p>1 💎 = ${GEM_TO_GOLD_RATE} vàng.</p></div>
      <div class="gem-shop-action" style="display:flex;gap:6px;align-items:center">
        <input id="gem-exchange-amount" type="number" min="1" placeholder="Gem" style="width:70px;padding:6px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
        <button id="gem-exchange-btn" class="gem-shop-buy-btn" type="button">Đổi</button>
      </div>`;
    root.appendChild(ex);
    ex.querySelector<HTMLButtonElement>("#gem-exchange-btn")?.addEventListener("click", () => {
      const v = Math.floor(Number(ex.querySelector<HTMLInputElement>("#gem-exchange-amount")?.value) || 0);
      if (v >= 1) this.onExchangeGems(v); else this.log("Nhập số Gem hợp lệ.", "log-line");
    });
    // Gold boost potion (Sprint 79).
    const boostActive = isGoldBoostActive(this.player.goldBoostUntil);
    const gb = document.createElement("div");
    gb.className = "gem-shop-card";
    gb.style.cssText = "align-items:center";
    gb.innerHTML = `
      <div class="gem-shop-swatch" style="background:radial-gradient(circle,#ffd166,#c8a948);display:flex;align-items:center;justify-content:center;font-size:18px">🪙</div>
      <div class="gem-shop-info"><strong>Bình Tăng Vàng</strong><p>+50% vàng khi giết quái trong 30 phút.</p></div>
      <div class="gem-shop-action"><button id="goldboost-btn" class="gem-shop-buy-btn" type="button" ${boostActive ? "disabled" : ""}>${boostActive ? "Đang hiệu lực" : `💎 ${GOLD_BOOST_GEM_COST}`}</button></div>`;
    root.appendChild(gb);
    gb.querySelector<HTMLButtonElement>("#goldboost-btn")?.addEventListener("click", () => this.onBuyGoldBoost());
    // XP boost potion (Sprint 153).
    const xpActive = isXpBoostActive(this.player.xpBoostUntil);
    const xb = document.createElement("div");
    xb.className = "gem-shop-card";
    xb.style.cssText = "align-items:center";
    xb.innerHTML = `
      <div class="gem-shop-swatch" style="background:radial-gradient(circle,#7db8ff,#3f6fd6);display:flex;align-items:center;justify-content:center;font-size:18px">📘</div>
      <div class="gem-shop-info"><strong>Bình Tăng XP</strong><p>+50% XP khi giết quái trong 30 phút.</p></div>
      <div class="gem-shop-action"><button id="xpboost-btn" class="gem-shop-buy-btn" type="button" ${xpActive ? "disabled" : ""}>${xpActive ? "Đang hiệu lực" : `💎 ${XP_BOOST_GEM_COST}`}</button></div>`;
    root.appendChild(xb);
    xb.querySelector<HTMLButtonElement>("#xpboost-btn")?.addEventListener("click", () => this.onBuyXpBoost());
    // Rage potion (Sprint 162).
    const rageActive = isRageActive(this.player.rageUntil);
    const rb = document.createElement("div");
    rb.className = "gem-shop-card";
    rb.style.cssText = "align-items:center";
    rb.innerHTML = `
      <div class="gem-shop-swatch" style="background:radial-gradient(circle,#ff8a6a,#d63f3f);display:flex;align-items:center;justify-content:center;font-size:18px">⚔️</div>
      <div class="gem-shop-info"><strong>Bình Cuồng Nộ</strong><p>+25% sát thương trong 10 phút.</p></div>
      <div class="gem-shop-action"><button id="rage-btn" class="gem-shop-buy-btn" type="button" ${rageActive ? "disabled" : ""}>${rageActive ? "Đang hiệu lực" : `💎 ${RAGE_GEM_COST}`}</button></div>`;
    root.appendChild(rb);
    rb.querySelector<HTMLButtonElement>("#rage-btn")?.addEventListener("click", () => this.onBuyRagePotion());
    // Sprint 206: daily featured deal card.
    const deal = dailyDealCosmetic();
    const dealPrice = dailyDealPrice();
    const dealOwned = (this.player.cosmetics ?? []).includes(deal.id);
    const swatch = "#" + deal.color.toString(16).padStart(6, "0");
    const db = document.createElement("div");
    db.className = "gem-shop-card";
    db.style.cssText = "align-items:center;border:1px solid #c8a948";
    db.innerHTML = `
      <div class="gem-shop-swatch" style="background:${swatch};display:flex;align-items:center;justify-content:center;font-size:16px">🏷️</div>
      <div class="gem-shop-info"><strong>KM hôm nay: ${escapeHtml(deal.name)}</strong><p>Giảm 35% — <s style="color:#8e9192">${deal.gemPrice}</s> còn <strong style="color:#ffd166">${dealPrice} 💎</strong>.</p></div>
      <div class="gem-shop-action"><button id="deal-btn" class="gem-shop-buy-btn" type="button" ${dealOwned ? "disabled" : ""}>${dealOwned ? "Đã có" : `💎 ${dealPrice}`}</button></div>`;
    root.appendChild(db);
    db.querySelector<HTMLButtonElement>("#deal-btn")?.addEventListener("click", () => this.onBuyDailyDeal());
    const owned = new Set(this.player.cosmetics ?? []);
    const active = this.player.activeCosmeticSkin;
    // Sprint 197: cosmetics collection progress header.
    const cosHeader = document.createElement("div");
    cosHeader.style.cssText = "font-size:12px;color:#9be7a8;margin:8px 0 4px;font-weight:700";
    cosHeader.textContent = `👗 Trang phục — Sưu tập: ${owned.size}/${COSMETICS.length}`;
    root.appendChild(cosHeader);
    for (const cosmetic of COSMETICS) {
      const card = document.createElement("div");
      card.className = "gem-shop-card";
      const isOwned = owned.has(cosmetic.id);
      const isActive = active === cosmetic.id;
      const colorHex = `#${cosmetic.color.toString(16).padStart(6, "0")}`;
      const isAchUnlock = cosmetic.gemPrice === 0;
      card.innerHTML = `
        <div class="gem-shop-swatch" style="background:${colorHex}"></div>
        <div class="gem-shop-info">
          <strong>${escapeHtml(cosmetic.name)} ${cosmetic.featured ? "<span style='color:#ffd166;font-size:10px'>★ NỔI BẬT</span>" : ""}</strong>
          <p>${escapeHtml(cosmetic.description)}</p>
          <small style="color:#8e9192">${cosmetic.type === "skinTint" ? "Tô màu nhân vật" : "Đổi màu hiệu ứng kỹ năng"}</small>
        </div>
        <div class="gem-shop-action"></div>
      `;
      const actionEl = card.querySelector<HTMLDivElement>(".gem-shop-action")!;
      if (isActive) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Đang dùng — Tắt";
        removeBtn.className = "gem-shop-equip-btn active";
        removeBtn.addEventListener("click", () => this.onEquipCosmetic(null));
        actionEl.appendChild(removeBtn);
      } else if (isOwned) {
        const equipBtn = document.createElement("button");
        equipBtn.textContent = "Dùng";
        equipBtn.className = "gem-shop-equip-btn";
        equipBtn.addEventListener("click", () => this.onEquipCosmetic(cosmetic.id));
        actionEl.appendChild(equipBtn);
      } else if (isAchUnlock) {
        const lock = document.createElement("span");
        lock.textContent = "Mở qua thành tựu";
        lock.style.cssText = "color:#9b9b9b;font-size:11px";
        actionEl.appendChild(lock);
      } else {
        const buyBtn = document.createElement("button");
        buyBtn.textContent = `💎 ${cosmetic.gemPrice}`;
        buyBtn.className = "gem-shop-buy-btn";
        buyBtn.disabled = (this.player.gems ?? 0) < cosmetic.gemPrice;
        buyBtn.addEventListener("click", () => this.onBuyCosmetic(cosmetic.id));
        actionEl.appendChild(buyBtn);
      }
      root.appendChild(card);
    }

    // Wire daily reward once.
    if (!this.gemShopWired) {
      this.gemShopWired = true;
      const dailyBtn = document.querySelector<HTMLButtonElement>("#claim-daily-btn");
      dailyBtn?.addEventListener("click", () => this.onClaimDaily());
    }
  }

  // Add a small collapse / expand button to each bottom-HUD panel so the
  // player can hide the content of any panel they don't want on screen.
  // State is persisted to localStorage.
  private installPanelCollapseButtons(): void {
    const panels: Array<{ selector: string; key: string }> = [
      { selector: ".log-panel", key: "log" },
      { selector: ".chat-panel", key: "chat" },
      { selector: ".player-panel", key: "player" },
      { selector: ".target-panel", key: "target" },
      { selector: ".party-panel", key: "party" }
    ];
    for (const { selector, key } of panels) {
      const panel = document.querySelector<HTMLElement>(selector);
      if (!panel) continue;
      const btn = document.createElement("button");
      btn.className = "panel-collapse-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Thu gọn");
      panel.appendChild(btn);
      const apply = (collapsed: boolean) => {
        panel.classList.toggle("collapsed", collapsed);
        btn.textContent = collapsed ? "▸" : "▾";
        btn.title = collapsed ? "Mở rộng" : "Thu gọn";
      };
      apply(localStorage.getItem(`panel-collapsed-${key}`) === "1");
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const next = !panel.classList.contains("collapsed");
        apply(next);
        localStorage.setItem(`panel-collapsed-${key}`, next ? "1" : "0");
      });
    }
  }

  // Handle locally-interpreted slash commands. Currently:
  //  /help        — list commands in the log
  //  /me <text>   — emote (broadcast as a chat message prefixed with *)
  //  /clear       — clear chat history
  private privateMessageHandler?: (to: string, message: string) => void;
  private friendAddHandler?: (name: string) => void;
  private friendRemoveHandler?: (name: string) => void;

  setPrivateMessageHandler(handler: (to: string, message: string) => void): void {
    this.privateMessageHandler = handler;
  }
  setFriendHandlers(add: (name: string) => void, remove: (name: string) => void): void {
    this.friendAddHandler = add;
    this.friendRemoveHandler = remove;
  }

  private inspectHandler?: (name: string) => void;
  setInspectHandler(handler: (name: string) => void): void {
    this.inspectHandler = handler;
  }
  private payHandler?: (to: string, amount: number) => void;
  setPayHandler(handler: (to: string, amount: number) => void): void {
    this.payHandler = handler;
  }
  private whoHandler?: () => void;
  setWhoHandler(handler: () => void): void {
    this.whoHandler = handler;
  }
  showOnlineList(payload: { count: number; players: Array<{ accountName: string; level: number; guildTag?: string }> }): void {
    const names = payload.players.map((p) => `${p.guildTag ? `[${p.guildTag}] ` : ""}${p.accountName} (Lv${p.level})`).join(", ");
    this.log(`🌐 Đang online (${payload.count}): ${names || "(chỉ mình bạn)"}`, "log-line");
  }

  showPlayerProfile(p: { accountName: string; level: number; playerClass?: string; title?: string; guildTag?: string; guildName?: string; petName?: string; petLevel?: number; pvpKills: number; totalKills: number; vip: boolean }): void {
    const cls = p.playerClass ? CLASS_CATALOG[p.playerClass as PlayerClass]?.name : undefined;
    const bits = [
      `Lv ${p.level}`,
      cls,
      p.vip ? "🌟VIP" : undefined,
      p.title ? `«${p.title}»` : undefined,
      p.guildTag ? `[${p.guildTag}] ${p.guildName ?? ""}`.trim() : undefined,
      p.petName ? `🐾 ${p.petName} Lv${p.petLevel ?? 1}` : undefined,
      `⚔️ PvP ${p.pvpKills}`,
      `Hạ ${p.totalKills} quái`
    ].filter(Boolean).join(" · ");
    this.log(`👤 ${p.accountName} — ${bits}`, "log-line");
  }

  // ----- Guild (Sprint 56) -----

  private guildHandlers?: {
    create: (name: string, tag: string) => void;
    invite: (name: string) => void;
    accept: (guildId: string) => void;
    leave: () => void;
    kick: (accountName: string) => void;
    promote: (accountName: string) => void;
    motd: (motd: string) => void;
    chat: (message: string) => void;
    donate: (amount: number) => void;
    boost: () => void;
    deposit: (amount: number) => void;
    withdraw: (amount: number) => void;
    disband: () => void;
    setDesc: (desc: string) => void;
  };

  setGuildHandlers(handlers: NonNullable<Hud["guildHandlers"]>): void {
    this.guildHandlers = handlers;
  }

  setGuild(view: GuildView | null): void {
    this.guild = view;
    this.renderGuildModal();
  }

  setGuildRanking(rows: GuildLeaderboardRow[]): void {
    this.guildRanking = rows;
    this.renderGuildModal();
  }

  setRaidHandlers(handlers: NonNullable<Hud["onRaidHandlers"]>): void {
    this.onRaidHandlers = handlers;
  }

  setGuildRaid(view: GuildRaidView | null): void {
    this.guildRaid = view;
    this.renderGuildModal();
  }

  /** Raid boss block in the guild modal (summon / live HP bar + attack). */
  private renderGuildRaid(canManage: boolean): string {
    const r = this.guildRaid;
    if (!r) {
      return `<div style="margin-top:14px;padding:10px;background:rgba(60,20,20,0.3);border:1px solid #5a3939;border-radius:6px">
        <strong style="color:#ff8181">⚔️ Boss Guild</strong>
        <p style="font-size:11px;color:#9aa;margin:4px 0 8px">Triệu hồi Boss để cả guild cùng đánh — chia thưởng vàng theo sát thương, người gây nhiều nhất nhận thêm Gem.</p>
        ${canManage ? `<button id="raid-summon-btn" type="button" style="padding:7px 14px;border:none;border-radius:4px;font-weight:700;color:#fff;background:linear-gradient(to bottom,#b03a3a,#7a2727);cursor:pointer">⚔️ Triệu hồi Boss</button>` : `<span style="font-size:11px;color:#8e9192">Chờ Hội Trưởng/Sĩ Quan triệu hồi.</span>`}
      </div>`;
    }
    const pct = Math.round((r.hp / Math.max(1, r.maxHp)) * 100);
    const secsLeft = Math.max(0, Math.ceil((r.expiresAt - Date.now()) / 1000));
    const top = r.contributors.slice(0, 5).map((c, i) =>
      `<div style="display:flex;justify-content:space-between;font-size:11px;color:${c.accountName === this.player?.accountName ? "#ffd166" : "#cdd"}"><span>${i + 1}. ${escapeHtml(c.accountName)}</span><span>${c.damage.toLocaleString("vi-VN")} dmg</span></div>`
    ).join("");
    return `<div style="margin-top:14px;padding:10px;background:rgba(60,20,20,0.35);border:1px solid #b03a3a;border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="color:#ff8181">⚔️ ${escapeHtml(r.bossName)}</strong>
        <span style="font-size:11px;color:#8e9192">⏱ ${secsLeft}s</span>
      </div>
      <div style="margin-top:6px;height:16px;background:#101820;border-radius:8px;overflow:hidden;border:1px solid #2a2a2a">
        <div style="height:100%;width:${pct}%;background:linear-gradient(to right,#b03a3a,#ff8181);transition:width .2s"></div>
      </div>
      <div style="font-size:11px;color:#d6dddf;margin-top:3px">${r.hp.toLocaleString("vi-VN")} / ${r.maxHp.toLocaleString("vi-VN")} HP</div>
      <button id="raid-attack-btn" type="button" style="width:100%;margin-top:8px;padding:10px;border:none;border-radius:5px;font-weight:700;font-size:15px;color:#fff;background:linear-gradient(to bottom,#b03a3a,#7a2727);cursor:pointer">🗡️ Tấn công Boss</button>
      <div style="margin-top:8px">${top || `<span style="font-size:11px;color:#8e9192">Chưa ai ra đòn.</span>`}</div>
    </div>`;
  }

  // ----- Titles (Sprint 62) -----
  setTitleHandler(handler: (titleId: string | null) => void): void {
    this.onSetTitle = handler;
  }

  setTitles(earned: string[], active: string | undefined): void {
    this.earnedTitleIds = earned;
    if (this.player) this.player.activeTitle = active;
    this.renderTitlesModal();
  }

  private renderTitlesModal(): void {
    const body = document.querySelector<HTMLDivElement>("#titles-body");
    if (!body) return;
    const active = this.player?.activeTitle;
    const earned = new Set(this.earnedTitleIds);
    const cards = TITLES.map((t) => {
      const got = earned.has(t.id);
      const isActive = active === t.id;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;border-radius:6px;background:${isActive ? "rgba(255,209,102,0.14)" : "rgba(28,28,28,0.5)"};border:1px solid ${isActive ? "#ffd166" : got ? "#39424b" : "#2a2a2a"};opacity:${got ? "1" : "0.5"}">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:${got ? "#ffd166" : "#8e9192"}">«${escapeHtml(t.label)}»${isActive ? " ✓" : ""}</div>
          <div style="font-size:11px;color:#9aa">${escapeHtml(t.desc)}</div>
        </div>
        ${got
          ? (isActive
              ? `<button type="button" data-title-set="" style="padding:5px 12px;border:1px solid #5a3939;border-radius:4px;color:#ff8181;background:#402c2c;cursor:pointer">Bỏ gắn</button>`
              : `<button type="button" data-title-set="${t.id}" style="padding:5px 12px;border:none;border-radius:4px;font-weight:700;color:#1d1500;background:linear-gradient(to bottom,#ffd166,#c8a948);cursor:pointer">Gắn</button>`)
          : `<span style="font-size:11px;color:#8e9192">🔒 Chưa đạt</span>`}
      </div>`;
    }).join("");
    body.innerHTML = `<p style="color:#d6dddf;font-size:12px;margin:0 0 12px">Danh hiệu mở khoá theo thành tích và hiển thị cạnh tên bạn. Mở khoá: ${earned.size}/${TITLES.length}.</p>${cards}`;
    body.querySelectorAll<HTMLButtonElement>("[data-title-set]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.titleSet;
        this.onSetTitle?.(id ? id : null);
      });
    });
  }

  // Sprint 218: bestiary modal — per-monster kill progress with tier badges.
  private renderBestiaryModal(): void {
    const body = document.querySelector<HTMLDivElement>("#bestiary-body");
    if (!body) return;
    const bestiary = this.player?.bestiary ?? {};
    const tierColor = (t: number) => (t === 3 ? "#ffd166" : t === 2 ? "#cfd8dc" : t === 1 ? "#d09a5e" : "#555");
    const tierName = (t: number) => BESTIARY_TIERS.find((b) => b.tier === t)?.name ?? "";
    const entries = Object.entries(MONSTER_DEFINITIONS)
      .map(([type, def]) => ({ type, def, kills: bestiary[type] ?? 0 }))
      .filter((e) => e.kills > 0)
      .sort((a, b) => b.kills - a.kills);
    const undiscovered = Object.keys(MONSTER_DEFINITIONS).length - entries.length;
    const goldTiers = entries.filter((e) => bestiaryTierForKills(e.kills) === 3).length;
    const rows = entries.map((e) => {
      const tier = bestiaryTierForKills(e.kills);
      const next = nextBestiaryTier(e.kills);
      const pct = next ? Math.min(100, Math.round((e.kills / next.kills) * 100)) : 100;
      const reward = next ? (next.reward.gold ? `${next.reward.gold} vàng` : `${next.reward.gems} 💎`) : "";
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:5px;border-radius:6px;background:rgba(28,28,28,0.5);border:1px solid ${tier > 0 ? tierColor(tier) : "#2a2a2a"}">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:#f1f1f1">${escapeHtml(translateMonsterName(e.def.name))}
            ${tier > 0 ? `<span style="font-size:10px;font-weight:700;color:#1d1500;background:${tierColor(tier)};border-radius:3px;padding:1px 6px;margin-left:6px">${tierName(tier)}</span>` : ""}
          </div>
          <div style="height:5px;border-radius:3px;background:#222;margin-top:5px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${tierColor(Math.min(3, tier + 1))}"></div></div>
          <div style="font-size:10px;color:#9aa;margin-top:3px">${e.kills} đã hạ${next ? ` — còn ${next.kills - e.kills} tới hạng ${next.name} (${reward})` : " — MAX"}</div>
        </div>
      </div>`;
    }).join("");
    body.innerHTML = `<p style="color:#d6dddf;font-size:12px;margin:0 0 12px">Hạ quái để nâng hạng Sổ Tay: ${BESTIARY_TIERS.map((b) => `${b.name} (${b.kills})`).join(" → ")}. Mỗi hạng thưởng vàng/💎. Đạt Vàng: ${goldTiers} loại.</p>
      ${rows || `<p style="color:#8e9192;font-size:12px">Chưa ghi nhận quái nào — ra ngoài săn thôi!</p>`}
      ${undiscovered > 0 ? `<p style="color:#8e9192;font-size:11px;margin-top:8px">🔍 Chưa khám phá: ${undiscovered} loại quái.</p>` : ""}`;
  }

  /** Top-guild ranking block, shown in both guild states. */
  private renderGuildRanking(): string {
    if (this.guildRanking.length === 0) return "";
    const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `${r}.`);
    const rows = this.guildRanking
      .slice(0, 10)
      .map((g) => `<tr style="${g.mine ? "background:rgba(255,209,102,0.12)" : ""}">
        <td style="padding:5px 4px;border-bottom:1px solid #2a2a2a;width:34px">${medal(g.rank)}</td>
        <td style="padding:5px 4px;border-bottom:1px solid #2a2a2a"><strong style="color:${g.mine ? "#ffd166" : "#f1f1f1"}">[${escapeHtml(g.tag)}]</strong> ${escapeHtml(g.name)}${g.boostActive ? " ⚡" : ""}</td>
        <td style="padding:5px 4px;border-bottom:1px solid #2a2a2a;text-align:center;color:#cdb6ff">Lv ${g.level}</td>
        <td style="padding:5px 4px;border-bottom:1px solid #2a2a2a;text-align:right;color:#8e9192">${g.memberCount}👤</td>
        <td style="padding:5px 4px;border-bottom:1px solid #2a2a2a;text-align:right;color:#ffd166">${g.exp.toLocaleString("vi-VN")}</td>
      </tr>${g.desc ? `<tr><td></td><td colspan="4" style="padding:0 4px 5px;border-bottom:1px solid #2a2a2a;font-size:10px;color:#9aa;font-style:italic">📣 ${escapeHtml(g.desc)}</td></tr>` : ""}`)
      .join("");
    return `
      <div style="margin-top:16px">
        <strong style="color:#ffd166;font-size:13px">🏆 Bảng Xếp Hạng Guild</strong>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">
          <thead><tr style="color:#8e9192;font-size:11px"><th></th><th style="text-align:left;padding:0 4px">Guild</th><th>Cấp</th><th style="text-align:right">TV</th><th style="text-align:right">EXP</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  showGuildInvite(payload: GuildInvitePayload): void {
    this.pendingGuildInvite = payload;
    this.log(`🏰 ${payload.from} mời bạn vào guild [${payload.tag}] ${payload.guildName} — gõ /gaccept để tham gia (hết hạn sau 60s).`, "log-line");
  }

  consumePendingGuildInvite(): GuildInvitePayload | undefined {
    const invite = this.pendingGuildInvite;
    this.pendingGuildInvite = undefined;
    return invite;
  }

  appendGuildChat(payload: GuildChatPayload): void {
    const root = document.querySelector("#chat-messages");
    if (!root) return;
    const line = document.createElement("div");
    line.className = "chat-line";
    line.style.color = "#9be7a8";
    const time = new Date(payload.sentAt);
    const hh = time.getHours().toString().padStart(2, "0");
    const mm = time.getMinutes().toString().padStart(2, "0");
    line.innerHTML = `<time class="chat-time">${hh}:${mm}</time><strong>[${escapeHtml(payload.tag)}] ${escapeHtml(payload.from)}</strong><span>${escapeHtml(payload.message)}</span>`;
    root.append(line);
    while (root.childElementCount > 50) root.firstElementChild?.remove();
    root.scrollTop = root.scrollHeight;
  }

  private renderGuildModal(): void {
    const body = document.querySelector<HTMLDivElement>("#guild-body");
    if (!body) return;
    const g = this.guild;
    if (!g) {
      const gold = this.player?.stats.gold ?? 0;
      const canAfford = gold >= GUILD_CREATE_COST_GOLD;
      body.innerHTML = `
        <p style="color:#d6dddf;font-size:13px;line-height:1.6">Bạn chưa ở trong guild nào. Lập guild riêng với <strong style="color:#ffd166">${GUILD_CREATE_COST_GOLD} 🪙</strong> (đang có ${gold}), hoặc chờ lời mời từ guild khác.</p>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <input id="guild-create-name" type="text" maxlength="20" placeholder="Tên guild (3-20 ký tự)" style="flex:2;min-width:160px;padding:8px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
          <input id="guild-create-tag" type="text" maxlength="4" placeholder="TAG (2-4)" style="flex:1;min-width:80px;padding:8px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1;text-transform:uppercase" />
          <button id="guild-create-btn" type="button" ${canAfford ? "" : "disabled"} style="padding:8px 18px;color:#1d1500;font-weight:700;background:${canAfford ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#444"};border:none;border-radius:4px;cursor:${canAfford ? "pointer" : "not-allowed"}">🏰 Lập Guild</button>
        </div>
        <p style="color:#8e9192;font-size:11px;margin-top:10px">Tag hiển thị cạnh tên mọi thành viên, vd: <strong>[DN] ${escapeHtml(this.player?.accountName ?? "Hero")}</strong>. Chat guild bằng <strong>/g &lt;tin nhắn&gt;</strong>.</p>
        ${this.renderGuildRanking()}`;
      body.querySelector<HTMLButtonElement>("#guild-create-btn")?.addEventListener("click", () => {
        const name = body.querySelector<HTMLInputElement>("#guild-create-name")?.value ?? "";
        const tag = body.querySelector<HTMLInputElement>("#guild-create-tag")?.value ?? "";
        this.guildHandlers?.create(name, tag);
      });
      return;
    }

    const me = g.members.find((m) => m.accountName === this.player?.accountName);
    const canManage = canManageGuild(me?.rank);
    const isLeader = me?.rank === "leader";
    const onlineCount = g.members.filter((m) => m.online).length;
    // Contribution leaderboard ordering is by rank already; show donated gold.
    const rows = g.members
      .map((m) => {
        const cls = m.playerClass ? ` · ${CLASS_CATALOG[m.playerClass].name}` : "";
        const level = m.online ? `Lv ${m.level}${cls}` : "offline";
        const kickable =
          me && m.accountName !== me.accountName &&
          (isLeader || (me.rank === "officer" && m.rank === "member"));
        const promotable = isLeader && m.rank !== "leader";
        return `<tr>
          <td style="padding:6px 4px;border-bottom:1px solid #2a2a2a">${m.online ? "🟢" : "⚪"} ${escapeHtml(m.accountName)}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #2a2a2a;color:#cdb6ff">${guildRankLabel(m.rank)}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #2a2a2a;color:#8e9192">${level}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #2a2a2a;text-align:right;color:#ffd166;white-space:nowrap" title="Tổng vàng đã góp">${m.contribution.toLocaleString("vi-VN")} 🪙</td>
          <td style="padding:6px 4px;border-bottom:1px solid #2a2a2a;text-align:right;white-space:nowrap">
            ${promotable ? `<button type="button" data-guild-promote="${escapeHtml(m.accountName)}" title="Thăng/giáng chức" style="padding:3px 8px;margin-right:4px;background:#2c3540;border:1px solid #39424b;border-radius:4px;color:#ffd166;cursor:pointer">⭐</button>` : ""}
            ${kickable ? `<button type="button" data-guild-kick="${escapeHtml(m.accountName)}" title="Trục xuất" style="padding:3px 8px;background:#402c2c;border:1px solid #5a3939;border-radius:4px;color:#ff8181;cursor:pointer">✕</button>` : ""}
          </td>
        </tr>`;
      })
      .join("");

    // Progression block: level, EXP progress bar, active perks, donate + boost.
    const pct = g.atMaxLevel ? 100 : Math.min(100, Math.round((g.expInto / Math.max(1, g.expSpan)) * 100));
    const boostMs = g.boostActive && g.boostUntil ? g.boostUntil - Date.now() : 0;
    const boostHrs = Math.max(0, Math.ceil(boostMs / (60 * 60 * 1000)));
    const progressBlock = `
      <div style="margin:4px 0 12px;padding:12px;background:rgba(28,28,28,0.5);border:1px solid #39424b;border-radius:6px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <strong style="color:#ffd166;font-size:15px">⚜️ Guild Lv ${g.level}${g.atMaxLevel ? " (MAX)" : ""}</strong>
          <span style="color:#9be7a8;font-size:12px">+${Math.round(g.expBonus * 100)}% EXP · +${Math.round(g.goldBonus * 100)}% vàng cho cả guild</span>
          ${g.boostActive ? `<span style="margin-left:auto;color:#7fd4ff;font-size:12px;font-weight:700">⚡ Boost +${10}% EXP · còn ${boostHrs}h</span>` : ""}
        </div>
        <div style="margin-top:8px;height:14px;background:#101820;border-radius:7px;overflow:hidden;border:1px solid #2a2a2a">
          <div style="height:100%;width:${pct}%;background:linear-gradient(to right,#6e4c9b,#c79bff);transition:width .3s"></div>
        </div>
        <div style="margin-top:4px;font-size:11px;color:#8e9192">${g.atMaxLevel ? "Đã đạt cấp tối đa." : `${g.expInto.toLocaleString("vi-VN")} / ${g.expSpan.toLocaleString("vi-VN")} EXP đến Lv ${g.level + 1}`} · Tổng góp guild: ${g.exp.toLocaleString("vi-VN")}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
          ${g.atMaxLevel ? "" : `<input id="guild-donate-amount" type="number" min="${GUILD_DONATE_MIN}" step="100" placeholder="Góp vàng (≥${GUILD_DONATE_MIN})" style="flex:1;min-width:140px;padding:7px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
          <button id="guild-donate-btn" type="button" style="padding:7px 14px;background:linear-gradient(to bottom,#ffd166,#c8a948);border:none;border-radius:4px;color:#1d1500;font-weight:700;cursor:pointer">🪙 Góp</button>`}
          ${canManage && !g.boostActive ? `<button id="guild-boost-btn" type="button" title="Mua boost EXP 48h cho cả guild" style="padding:7px 14px;background:linear-gradient(to bottom,#4aa3df,#2d6fa3);border:none;border-radius:4px;color:#fff;font-weight:700;cursor:pointer">⚡ Guild Boost · 💎 ${GUILD_BOOST_GEM_COST}</button>` : ""}
        </div>
      </div>`;
    body.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
        <h3 style="margin:0;color:#ffd166">[${escapeHtml(g.tag)}] ${escapeHtml(g.name)}</h3>
        <span style="color:#8e9192;font-size:12px">${g.members.length}/${g.maxMembers} thành viên · ${onlineCount} online</span>
      </div>
      <div id="guild-motd-row" style="display:flex;gap:8px;align-items:center;margin:10px 0;padding:10px;background:rgba(110,76,155,0.15);border:1px solid rgba(199,155,255,0.35);border-radius:6px">
        <span style="font-size:13px;color:#e8dcff;flex:1">📜 ${escapeHtml(g.motd || "(chưa có thông báo)")}</span>
        ${canManage ? `<button id="guild-motd-edit" type="button" style="padding:4px 10px;background:#2c3540;border:1px solid #39424b;border-radius:4px;color:#cdb6ff;cursor:pointer">Sửa</button>` : ""}
        ${canManage ? `<button id="guild-desc-edit" type="button" title="Mô tả tuyển quân (hiện ở BXH)" style="padding:4px 10px;background:#2c3540;border:1px solid #39424b;border-radius:4px;color:#9be7a8;cursor:pointer">📣 Tuyển quân</button>` : ""}
      </div>
      ${progressBlock}
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;padding:9px;background:rgba(28,28,28,0.5);border:1px solid #39424b;border-radius:6px;flex-wrap:wrap">
        <span style="font-size:12px;color:#ffd166;flex:1;min-width:120px">🏦 Quỹ Guild: <strong>${(g.bank ?? 0).toLocaleString("vi-VN")} 🪙</strong></span>
        <input id="guild-bank-amount" type="number" min="100" step="100" placeholder="Số vàng" style="width:110px;padding:6px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
        <button id="guild-bank-deposit" type="button" style="padding:6px 12px;background:linear-gradient(to bottom,#ffd166,#c8a948);border:none;border-radius:4px;color:#1d1500;font-weight:700;cursor:pointer">Gửi</button>
        ${isLeader ? `<button id="guild-bank-withdraw" type="button" style="padding:6px 12px;background:#2c3540;border:1px solid #39424b;border-radius:4px;color:#cdd;cursor:pointer">Rút</button>` : ""}
      </div>
      ${canManage ? `<div style="display:flex;gap:8px;margin-bottom:10px">
        <input id="guild-invite-name" type="text" maxlength="20" placeholder="Tên người chơi đang online" style="flex:1;padding:7px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
        <button id="guild-invite-btn" type="button" style="padding:7px 14px;background:linear-gradient(to bottom,#6e4c9b,#523a73);border:none;border-radius:4px;color:#fff;font-weight:700;cursor:pointer">➕ Mời</button>
      </div>` : ""}
      <div style="max-height:260px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
        <span style="color:#8e9192;font-size:11px">Chat guild: <strong>/g &lt;tin nhắn&gt;</strong></span>
        <button id="guild-leave-btn" type="button" style="padding:6px 14px;background:#402c2c;border:1px solid #5a3939;border-radius:4px;color:#ff8181;cursor:pointer">${isLeader && g.members.length > 1 ? "Rời guild (truyền chức)" : "Rời guild"}</button>
        ${isLeader ? `<button id="guild-disband-btn" type="button" style="padding:6px 14px;margin-left:6px;background:#5a1f1f;border:1px solid #7a2727;border-radius:4px;color:#ff8181;cursor:pointer">Giải tán</button>` : ""}
      </div>
      ${this.renderGuildRaid(canManage)}
      ${this.renderGuildRanking()}`;
    body.querySelector<HTMLButtonElement>("#guild-invite-btn")?.addEventListener("click", () => {
      const name = body.querySelector<HTMLInputElement>("#guild-invite-name")?.value.trim();
      if (name) this.guildHandlers?.invite(name);
    });
    body.querySelector<HTMLButtonElement>("#guild-donate-btn")?.addEventListener("click", () => {
      const raw = body.querySelector<HTMLInputElement>("#guild-donate-amount")?.value ?? "";
      const amount = Math.floor(Number(raw) || 0);
      if (amount >= GUILD_DONATE_MIN) this.guildHandlers?.donate(amount);
      else this.log(`Góp tối thiểu ${GUILD_DONATE_MIN} vàng.`, "log-line");
    });
    body.querySelector<HTMLButtonElement>("#guild-boost-btn")?.addEventListener("click", () => {
      if (window.confirm(`Mua Guild Boost (+10% EXP cho cả guild trong 48h) với ${GUILD_BOOST_GEM_COST} 💎?`)) this.guildHandlers?.boost();
    });
    const bankAmount = () => Math.floor(Number(body.querySelector<HTMLInputElement>("#guild-bank-amount")?.value) || 0);
    body.querySelector<HTMLButtonElement>("#guild-bank-deposit")?.addEventListener("click", () => {
      const a = bankAmount();
      if (a >= 100) this.guildHandlers?.deposit(a); else this.log("Gửi tối thiểu 100 vàng.", "log-line");
    });
    body.querySelector<HTMLButtonElement>("#guild-bank-withdraw")?.addEventListener("click", () => {
      const a = bankAmount();
      if (a >= 100) this.guildHandlers?.withdraw(a); else this.log("Rút tối thiểu 100 vàng.", "log-line");
    });
    body.querySelector<HTMLButtonElement>("#guild-motd-edit")?.addEventListener("click", () => {
      const next = window.prompt("Thông báo guild mới:", g.motd)?.slice(0, GUILD_MOTD_MAX);
      if (next !== undefined && next !== null) this.guildHandlers?.motd(next);
    });
    body.querySelector<HTMLButtonElement>("#guild-desc-edit")?.addEventListener("click", () => {
      const next = window.prompt("Mô tả tuyển quân (hiện ở Bảng Xếp Hạng):", "")?.slice(0, 80);
      if (next !== undefined && next !== null) this.guildHandlers?.setDesc(next);
    });
    body.querySelector<HTMLButtonElement>("#guild-leave-btn")?.addEventListener("click", () => {
      if (window.confirm("Bạn chắc chắn muốn rời guild?")) this.guildHandlers?.leave();
    });
    body.querySelector<HTMLButtonElement>("#guild-disband-btn")?.addEventListener("click", () => {
      if (window.confirm("GIẢI TÁN guild? Toàn bộ thành viên sẽ bị xoá khỏi guild và quỹ sẽ mất. Không thể hoàn tác!")) this.guildHandlers?.disband();
    });
    body.querySelectorAll<HTMLButtonElement>("[data-guild-kick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.guildKick!;
        if (window.confirm(`Trục xuất ${name} khỏi guild?`)) this.guildHandlers?.kick(name);
      });
    });
    body.querySelectorAll<HTMLButtonElement>("[data-guild-promote]").forEach((btn) => {
      btn.addEventListener("click", () => this.guildHandlers?.promote(btn.dataset.guildPromote!));
    });
    body.querySelector<HTMLButtonElement>("#raid-summon-btn")?.addEventListener("click", () => this.onRaidHandlers?.summon());
    body.querySelector<HTMLButtonElement>("#raid-attack-btn")?.addEventListener("click", () => this.onRaidHandlers?.attack());
  }

  // ----- Marketplace (Sprint 58) -----

  private marketHandlers?: {
    list: (itemId: string, price: number) => void;
    buy: (listingId: string) => void;
    cancel: (listingId: string) => void;
    feature: (listingId: string) => void;
    refresh: () => void;
  };

  setMarketHandlers(handlers: NonNullable<Hud["marketHandlers"]>): void {
    this.marketHandlers = handlers;
  }

  setMarket(listings: MarketListingView[]): void {
    this.market = listings;
    this.renderMarketModal();
  }

  private renderMarketModal(): void {
    const body = document.querySelector<HTMLDivElement>("#market-body");
    if (!body) return;
    const tab = this.marketTab;
    const mine = this.market.filter((l) => l.mine);
    const others = this.market.filter((l) => !l.mine);
    const tabBtn = (id: typeof this.marketTab, label: string) =>
      `<button type="button" data-market-tab="${id}" style="flex:1;padding:8px;border:none;border-bottom:2px solid ${tab === id ? "#ffd166" : "transparent"};background:${tab === id ? "rgba(255,209,102,0.12)" : "transparent"};color:${tab === id ? "#ffd166" : "#bdbdbd"};cursor:pointer;font-weight:700">${label}</button>`;
    let inner = "";
    if (tab === "browse") inner = this.renderMarketBrowse(others);
    else if (tab === "sell") inner = this.renderMarketSell();
    else inner = this.renderMarketMine(mine);
    body.innerHTML = `
      <div style="display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid #2a2a2a">
        ${tabBtn("browse", `🛒 Chợ (${others.length})`)}
        ${tabBtn("sell", "🏷️ Bán")}
        ${tabBtn("mine", `📦 Của tôi (${mine.length}/${MARKET_MAX_LISTINGS_PER_SELLER})`)}
      </div>
      <div id="market-tab-body">${inner}</div>`;
    body.querySelectorAll<HTMLButtonElement>("[data-market-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.marketTab = btn.dataset.marketTab as typeof this.marketTab;
        this.renderMarketModal();
      });
    });
    this.wireMarketTabActions();
  }

  private itemSummary(item: Item): string {
    if (item.kind === "equipment") {
      const parts: string[] = [];
      if (item.stats.attack) parts.push(`+${item.stats.attack} công`);
      if (item.stats.defense) parts.push(`+${item.stats.defense} thủ`);
      if (item.stats.maxHp) parts.push(`+${item.stats.maxHp} HP`);
      if (item.stats.speed) parts.push(`+${item.stats.speed}% tốc`);
      const ench = item.enchantCount ? ` · tinh luyện ${item.enchantCount}` : "";
      return `${parts.join(", ") || "không chỉ số"}${ench}`;
    }
    if (item.kind === "consumable") return item.recall ? "Hồi thành" : `Hồi ${item.heal} HP`;
    return "Nguyên liệu chế tạo";
  }

  private renderMarketBrowse(listings: MarketListingView[]): string {
    const gold = this.player?.stats.gold ?? 0;
    const kindOpt = (v: MarketKindFilter, label: string) => `<option value="${v}" ${this.marketKind === v ? "selected" : ""}>${label}</option>`;
    const sortOpt = (v: MarketSortKey, label: string) => `<option value="${v}" ${this.marketSort === v ? "selected" : ""}>${label}</option>`;
    const controls = `
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <input id="market-search" type="text" placeholder="🔎 Tìm theo tên..." value="${escapeHtml(this.marketQuery)}" style="flex:2;min-width:120px;padding:6px 8px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
        <select id="market-kind" style="flex:1;min-width:96px;padding:6px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1">
          ${kindOpt("all", "Tất cả loại")}${kindOpt("equipment", "Trang bị")}${kindOpt("consumable", "Tiêu hao")}${kindOpt("material", "Nguyên liệu")}
        </select>
        <select id="market-sort" style="flex:1;min-width:96px;padding:6px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1">
          ${sortOpt("featured", "Nổi bật")}${sortOpt("newest", "Mới nhất")}${sortOpt("priceAsc", "Giá ↑")}${sortOpt("priceDesc", "Giá ↓")}${sortOpt("rarity", "Độ hiếm")}
        </select>
      </div>`;
    const shown = sortListings(filterListings(listings, this.marketQuery, this.marketKind), this.marketSort);
    if (listings.length === 0) return `${controls}<p style="color:#8e9192;text-align:center;padding:24px">Chợ đang trống. Hãy là người đầu tiên rao bán!</p>`;
    if (shown.length === 0) return `${controls}<p style="color:#8e9192;text-align:center;padding:24px">Không có tin nào khớp bộ lọc.</p>`;
    const rows = shown
      .map((l) => {
        const afford = gold >= l.price;
        const featBadge = l.featured ? `<span title="Tin nổi bật" style="color:#ffd166">✨ </span>` : "";
        const featBorder = l.featured ? "border:1px solid rgba(255,209,102,0.55);box-shadow:0 0 6px rgba(255,209,102,0.2)" : "border:1px solid #2a2a2a";
        return `<div class="${rarityClass[l.item.rarity]}" style="display:flex;align-items:center;gap:10px;padding:9px;margin-bottom:6px;background:rgba(28,28,28,0.5);${featBorder};border-left:3px solid currentColor;border-radius:5px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:#f1f1f1">${featBadge}${escapeHtml(l.item.name)} <small style="color:#8e9192;font-weight:400">(${l.item.rarity})</small></div>
            <div style="font-size:11px;color:#9aa">${escapeHtml(this.itemSummary(l.item))}</div>
            <div style="font-size:11px;color:#8e9192">Người bán: ${escapeHtml(l.sellerName)}</div>
          </div>
          <div style="text-align:right;white-space:nowrap">
            <div style="color:#ffd166;font-weight:700;margin-bottom:4px">${l.price.toLocaleString("vi-VN")} 🪙</div>
            <button type="button" data-market-buy="${l.id}" ${afford ? "" : "disabled"} style="padding:5px 14px;border:none;border-radius:4px;font-weight:700;color:${afford ? "#1d1500" : "#888"};background:${afford ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#333"};cursor:${afford ? "pointer" : "not-allowed"}">Mua</button>
          </div>
        </div>`;
      })
      .join("");
    return `${controls}<div style="max-height:320px;overflow-y:auto">${rows}</div>`;
  }

  private renderMarketSell(): string {
    const items = this.player?.inventory.items ?? [];
    if (items.length === 0) return `<p style="color:#8e9192;text-align:center;padding:24px">Túi đồ trống — không có gì để bán.</p>`;
    const rows = items
      .map((it) => {
        return `<div class="${rarityClass[it.rarity]}" style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:6px;background:rgba(28,28,28,0.5);border:1px solid #2a2a2a;border-left:3px solid currentColor;border-radius:5px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:#f1f1f1">${escapeHtml(it.name)} <small style="color:#8e9192;font-weight:400">(${it.rarity})</small></div>
            <div style="font-size:11px;color:#9aa">${escapeHtml(this.itemSummary(it))} · giá tham khảo ${it.value} 🪙</div>
          </div>
          <input type="number" min="1" placeholder="Giá" data-sell-price="${it.id}" style="width:96px;padding:6px;background:#101820;border:1px solid #39424b;border-radius:4px;color:#f1f1f1" />
          <button type="button" data-market-list="${it.id}" style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:#fff;background:linear-gradient(to bottom,#6e4c9b,#523a73);cursor:pointer">Rao</button>
        </div>`;
      })
      .join("");
    return `<p style="font-size:11px;color:#8e9192;margin:0 0 10px">Phí giao dịch ${Math.round(MARKET_TAX_RATE * 100)}% trừ vào tiền bán khi có người mua. Vật phẩm được giữ trên sạp tới khi bán hoặc gỡ.</p><div style="max-height:340px;overflow-y:auto">${rows}</div>`;
  }

  private renderMarketMine(mine: MarketListingView[]): string {
    if (mine.length === 0) return `<p style="color:#8e9192;text-align:center;padding:24px">Bạn chưa rao bán món nào.</p>`;
    const rows = mine
      .map((l) => `<div class="${rarityClass[l.item.rarity]}" style="display:flex;align-items:center;gap:10px;padding:9px;margin-bottom:6px;background:rgba(28,28,28,0.5);border:1px solid ${l.featured ? "rgba(255,209,102,0.55)" : "#2a2a2a"};border-left:3px solid currentColor;border-radius:5px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:#f1f1f1">${l.featured ? "✨ " : ""}${escapeHtml(l.item.name)} <small style="color:#8e9192;font-weight:400">(${l.item.rarity})</small></div>
            <div style="font-size:11px;color:#9aa">Bán được nhận: ${l.net.toLocaleString("vi-VN")} 🪙 (sau phí ${l.tax.toLocaleString("vi-VN")})</div>
          </div>
          <div style="text-align:right;white-space:nowrap">
            <div style="color:#ffd166;font-weight:700;margin-bottom:4px">${l.price.toLocaleString("vi-VN")} 🪙</div>
            ${l.featured ? `<span style="display:inline-block;padding:5px 10px;margin-right:4px;color:#ffd166;font-size:11px">✨ Đang nổi bật</span>` : `<button type="button" data-market-feature="${l.id}" title="Ghim lên đầu chợ 48h" style="padding:5px 10px;margin-right:4px;border:1px solid #c8a948;border-radius:4px;color:#ffd166;background:rgba(255,209,102,0.1);cursor:pointer">✨ ${MARKET_FEATURE_GEM_COST}💎</button>`}
            <button type="button" data-market-cancel="${l.id}" style="padding:5px 12px;border:1px solid #5a3939;border-radius:4px;color:#ff8181;background:#402c2c;cursor:pointer">Gỡ</button>
          </div>
        </div>`)
      .join("");
    return `<div style="max-height:360px;overflow-y:auto">${rows}</div>`;
  }

  private wireMarketTabActions(): void {
    const body = document.querySelector<HTMLDivElement>("#market-body");
    if (!body) return;
    body.querySelectorAll<HTMLButtonElement>("[data-market-buy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const l = this.market.find((x) => x.id === btn.dataset.marketBuy);
        if (l && window.confirm(`Mua ${l.item.name} với giá ${l.price.toLocaleString("vi-VN")} vàng?`)) this.marketHandlers?.buy(l.id);
      });
    });
    body.querySelectorAll<HTMLButtonElement>("[data-market-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => this.marketHandlers?.cancel(btn.dataset.marketCancel!));
    });
    body.querySelectorAll<HTMLButtonElement>("[data-market-list]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.marketList!;
        const input = body.querySelector<HTMLInputElement>(`[data-sell-price="${id}"]`);
        const price = Math.floor(Number(input?.value) || 0);
        if (price < 1) { this.log("Nhập giá hợp lệ để rao bán.", "log-line"); return; }
        this.marketHandlers?.list(id, price);
      });
    });
    body.querySelectorAll<HTMLButtonElement>("[data-market-feature]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const l = this.market.find((x) => x.id === btn.dataset.marketFeature);
        if (l && window.confirm(`Ghim "${l.item.name}" lên đầu chợ trong 48h với ${MARKET_FEATURE_GEM_COST} 💎?`)) this.marketHandlers?.feature(l.id);
      });
    });
    // Browse filters: update state then re-render. The search box keeps focus
    // across the re-render so typing isn't interrupted.
    const search = body.querySelector<HTMLInputElement>("#market-search");
    search?.addEventListener("input", () => {
      this.marketQuery = search.value;
      this.renderMarketModal();
      const next = document.querySelector<HTMLInputElement>("#market-search");
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });
    body.querySelector<HTMLSelectElement>("#market-kind")?.addEventListener("change", (e) => {
      this.marketKind = (e.target as HTMLSelectElement).value as MarketKindFilter;
      this.renderMarketModal();
    });
    body.querySelector<HTMLSelectElement>("#market-sort")?.addEventListener("change", (e) => {
      this.marketSort = (e.target as HTMLSelectElement).value as MarketSortKey;
      this.renderMarketModal();
    });
  }

  // ----- Pets (Sprint 63) -----
  private renderPetsModal(): void {
    const body = document.querySelector<HTMLDivElement>("#pets-body");
    if (!body || !this.player) return;
    const owned = new Set(this.player.ownedPets ?? []);
    const active = this.player.activePet;
    const gold = this.player.stats.gold;
    const gems = this.player.gems ?? 0;
    const xpMap = this.player.petXp ?? {};
    const cards = PET_CATALOG.map((p) => {
      const has = owned.has(p.id);
      const isActive = active === p.id;
      const gemBuy = p.gemPrice > 0;
      const price = gemBuy ? `💎 ${p.gemPrice}` : `🪙 ${p.goldPrice.toLocaleString("vi-VN")}`;
      const afford = gemBuy ? gems >= p.gemPrice : gold >= p.goldPrice;
      const swatch = "#" + p.color.toString(16).padStart(6, "0");
      const xp = xpMap[p.id] ?? 0;
      const lvl = petLevelForXp(xp);
      const buff = petBuffAtLevel(p.buff, lvl);
      const buffText = [buff.attack ? `+${buff.attack} công` : "", buff.defense ? `+${buff.defense} thủ` : "", buff.maxHp ? `+${buff.maxHp} HP` : ""].filter(Boolean).join(", ");
      let action: string;
      if (!has) {
        action = `<button type="button" data-pet-buy="${p.id}" ${afford ? "" : "disabled"} style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:${afford ? "#1d1500" : "#888"};background:${afford ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#333"};cursor:${afford ? "pointer" : "not-allowed"}">${price}</button>`;
      } else if (isActive) {
        action = `<button type="button" data-pet-equip="" style="padding:6px 12px;border:1px solid #5a3939;border-radius:4px;color:#ff8181;background:#402c2c;cursor:pointer">Thu hồi</button>`;
      } else {
        action = `<button type="button" data-pet-equip="${p.id}" style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:#fff;background:linear-gradient(to bottom,#6e4c9b,#523a73);cursor:pointer">Trang bị</button><button type="button" data-pet-sac="${p.id}" title="Hiến tế lấy XP cho linh thú đang dùng" style="padding:6px 9px;margin-left:4px;border:1px solid #5a3939;border-radius:4px;color:#ff8181;background:#2c1c1c;cursor:pointer">🔥</button>`;
      }
      // XP bar (owned pets only).
      const prog = petXpProgress(xp);
      const pct = prog.atMax ? 100 : Math.round((prog.into / Math.max(1, prog.span)) * 100);
      const levelBar = has
        ? `<div style="margin-top:4px"><div style="display:flex;justify-content:space-between;font-size:10px;color:#8e9192"><span>Cấp ${lvl}${prog.atMax ? " (MAX)" : ""}</span><span>${prog.atMax ? "" : `${prog.into}/${prog.span} XP`}</span></div><div style="height:6px;background:#101820;border-radius:3px;overflow:hidden;margin-top:2px"><div style="height:100%;width:${pct}%;background:linear-gradient(to right,#6e4c9b,#c79bff)"></div></div></div>`
        : "";
      return `<div class="rarity-${p.rarity}" style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;border-radius:6px;background:${isActive ? "rgba(255,209,102,0.12)" : "rgba(28,28,28,0.5)"};border:1px solid ${isActive ? "#ffd166" : "#2a2a2a"};border-left:3px solid currentColor">
        <div style="width:22px;height:22px;border-radius:50%;background:${swatch};border:2px solid #0008;flex:none"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:#f1f1f1">${escapeHtml(p.name)} <small style="color:#8e9192;font-weight:400">(${p.rarity})</small>${isActive ? " ✓" : ""}</div>
          <div style="font-size:11px;color:#9be7a8">${has ? escapeHtml(buffText || p.desc) : escapeHtml(p.desc)}</div>
          ${levelBar}
        </div>
        ${action}
      </div>`;
    }).join("");
    // Feed/treat panel for the active pet.
    const activePet = PET_CATALOG.find((p) => p.id === active);
    const feedPanel = activePet
      ? `<div style="display:flex;gap:8px;margin:12px 0;padding:10px;background:rgba(110,76,155,0.12);border:1px solid #39424b;border-radius:6px;align-items:center;flex-wrap:wrap">
          <span style="flex:1;min-width:120px;font-size:12px;color:#e8dcff">Nuôi <strong>${escapeHtml(activePet.name)}</strong> lên cấp để buff mạnh hơn (tối đa cấp 5):</span>
          <button id="pet-feed-btn" type="button" ${gold >= PET_FEED_GOLD_COST ? "" : "disabled"} style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:${gold >= PET_FEED_GOLD_COST ? "#1d1500" : "#888"};background:${gold >= PET_FEED_GOLD_COST ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#333"};cursor:${gold >= PET_FEED_GOLD_COST ? "pointer" : "not-allowed"}">🍖 Cho ăn 🪙${PET_FEED_GOLD_COST}</button>
          <button id="pet-treat-btn" type="button" ${gems >= PET_TREAT_GEM_COST ? "" : "disabled"} style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:#fff;background:${gems >= PET_TREAT_GEM_COST ? "linear-gradient(to bottom,#4aa3df,#2d6fa3)" : "#333"};cursor:${gems >= PET_TREAT_GEM_COST ? "pointer" : "not-allowed"}">🍬 Bánh thưởng 💎${PET_TREAT_GEM_COST}</button>
        </div>`
      : "";
    // Sprint 172: mounts shop — gold-bought rides for a move-speed buff.
    const ownedMounts = new Set(this.player.ownedMounts ?? []);
    const activeMount = this.player.activeMount;
    const mountCards = MOUNT_CATALOG.map((m) => {
      const has = ownedMounts.has(m.id);
      const isActive = activeMount === m.id;
      const afford = gold >= m.goldPrice;
      const swatch = "#" + m.color.toString(16).padStart(6, "0");
      let action: string;
      if (!has) action = `<button type="button" data-mount-buy="${m.id}" ${afford ? "" : "disabled"} style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:${afford ? "#1d1500" : "#888"};background:${afford ? "linear-gradient(to bottom,#ffd166,#c8a948)" : "#333"};cursor:${afford ? "pointer" : "not-allowed"}">🪙 ${m.goldPrice.toLocaleString("vi-VN")}</button>`;
      else if (isActive) action = `<button type="button" data-mount-equip="" style="padding:6px 12px;border:1px solid #5a3939;border-radius:4px;color:#ff8181;background:#402c2c;cursor:pointer">Xuống ngựa</button>`;
      else action = `<button type="button" data-mount-equip="${m.id}" style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:#fff;background:linear-gradient(to bottom,#6e4c9b,#523a73);cursor:pointer">Cưỡi</button>`;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;border-radius:6px;background:${isActive ? "rgba(255,209,102,0.12)" : "rgba(28,28,28,0.5)"};border:1px solid ${isActive ? "#ffd166" : "#2a2a2a"}">
        <div style="width:22px;height:22px;border-radius:50%;background:${swatch};border:2px solid #0008;flex:none"></div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;color:#f1f1f1">🐎 ${escapeHtml(m.name)}${isActive ? " ✓" : ""}</div><div style="font-size:11px;color:#9be7a8">${escapeHtml(m.desc)}</div></div>
        ${action}
      </div>`;
    }).join("");
    const mountSection = `<div style="margin-top:14px;border-top:1px solid #2a2a2a;padding-top:10px"><p style="color:#d6dddf;font-size:12px;margin:0 0 8px"><strong>🐎 Thú cưỡi</strong> — tăng tốc chạy (mua bằng vàng).</p>${mountCards}</div>`;
    // Sprint 197: collection progress.
    const petTotal = PET_CATALOG.length;
    const petOwned = (this.player.ownedPets ?? []).length;
    body.innerHTML = `<p style="color:#d6dddf;font-size:12px;margin:0 0 12px">Linh thú đi theo bạn và cộng chỉ số. Mỗi lúc chỉ trang bị 1 con; nuôi để lên cấp tăng buff. <strong style="color:#9be7a8">Sưu tập: ${petOwned}/${petTotal}</strong></p>${feedPanel}${cards}${mountSection}`;
    body.querySelectorAll<HTMLButtonElement>("[data-mount-buy]").forEach((btn) => btn.addEventListener("click", () => this.onBuyMount(btn.dataset.mountBuy!)));
    body.querySelectorAll<HTMLButtonElement>("[data-mount-equip]").forEach((btn) => btn.addEventListener("click", () => { const id = btn.dataset.mountEquip; this.onEquipMount(id ? id : null); }));
    body.querySelector<HTMLButtonElement>("#pet-feed-btn")?.addEventListener("click", () => this.onFeedPet());
    body.querySelector<HTMLButtonElement>("#pet-treat-btn")?.addEventListener("click", () => this.onPetTreat());
    body.querySelectorAll<HTMLButtonElement>("[data-pet-buy]").forEach((btn) => {
      btn.addEventListener("click", () => this.onBuyPet(btn.dataset.petBuy!));
    });
    body.querySelectorAll<HTMLButtonElement>("[data-pet-equip]").forEach((btn) => {
      btn.addEventListener("click", () => { const id = btn.dataset.petEquip; this.onEquipPet(id ? id : null); });
    });
    body.querySelectorAll<HTMLButtonElement>("[data-pet-sac]").forEach((btn) => {
      btn.addEventListener("click", () => { if (confirm("Hiến tế linh thú này để lấy XP? Không hoàn lại.")) this.onSacrificePet(btn.dataset.petSac!); });
    });
  }

  // Sprint 201: mailbox state + modal (send gold + claim received mail).
  setMail(mail: MailMessage[]): void {
    this.mail = mail ?? [];
    this.renderMailButton();
    if (document.getElementById("mailbox-modal")) this.renderMailbox();
  }
  // Sprint 203: floating mailbox button with an unread-count badge.
  private renderMailButton(): void {
    let btn = document.getElementById("mailbox-fab") as HTMLButtonElement | null;
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "mailbox-fab";
      btn.type = "button";
      btn.title = "Hòm Thư (/mail)";
      btn.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9000;width:44px;height:44px;border-radius:50%;border:1px solid #3a4256;background:rgba(20,23,30,0.92);color:#e8ecf5;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.5)";
      btn.innerHTML = `📬<span id="mailbox-badge" style="position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;line-height:16px;border-radius:8px;background:#e0463a;color:#fff;font-size:10px;font-weight:700;padding:0 4px;display:none"></span>`;
      btn.addEventListener("click", () => { this.onRequestMail(); this.openMailbox(); });
      document.body.appendChild(btn);
    }
    const badge = document.getElementById("mailbox-badge");
    if (badge) {
      if (this.mail.length > 0) { badge.textContent = String(this.mail.length); badge.style.display = "block"; }
      else badge.style.display = "none";
    }
    // Sprint 209: glow while unread; bounce once when new mail arrives.
    btn.style.boxShadow = this.mail.length > 0 ? "0 0 14px 3px rgba(224,70,58,0.6)" : "0 4px 14px rgba(0,0,0,0.5)";
    btn.style.animation = this.mail.length > 0 ? "mailGlow 1.8s ease-in-out infinite" : "none";
    if (this.mail.length > this.prevMailCount && this.prevMailCount >= 0) {
      btn.classList.remove("mail-bounce");
      void btn.offsetWidth; // reflow to restart the animation
      btn.classList.add("mail-bounce");
    }
    this.prevMailCount = this.mail.length;
  }
  private openMailbox(): void {
    if (document.getElementById("mailbox-modal")) { document.getElementById("mailbox-modal")?.remove(); return; }
    const modal = document.createElement("div");
    modal.id = "mailbox-modal";
    modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100000;background:rgba(12,14,20,0.97);border:1px solid #3a4256;border-radius:12px;padding:18px 20px;width:360px;max-height:80vh;overflow:auto;color:#e8ecf5;box-shadow:0 12px 40px rgba(0,0,0,0.6)";
    modal.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><strong style="font-size:15px">📬 Hòm Thư</strong><button id="mailbox-close" type="button" style="background:none;border:none;color:#9aa0a6;font-size:18px;cursor:pointer">✕</button></div>
      <div style="background:#15171d;border:1px solid #2a2f3a;border-radius:8px;padding:10px;margin-bottom:12px">
        <div style="font-size:12px;color:#9be7a8;margin-bottom:6px">Gửi vàng cho người chơi</div>
        <input id="mail-to" placeholder="Tên người nhận" style="width:100%;box-sizing:border-box;margin-bottom:5px;background:#0d0f14;border:1px solid #2a2f3a;border-radius:4px;color:#e8ecf5;padding:6px;font-size:12px">
        <input id="mail-gold" type="number" placeholder="Số vàng" style="width:100%;box-sizing:border-box;margin-bottom:5px;background:#0d0f14;border:1px solid #2a2f3a;border-radius:4px;color:#e8ecf5;padding:6px;font-size:12px">
        <input id="mail-msg" placeholder="Lời nhắn (tuỳ chọn)" maxlength="120" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#0d0f14;border:1px solid #2a2f3a;border-radius:4px;color:#e8ecf5;padding:6px;font-size:12px">
        <label id="mail-attach-row" style="display:flex;align-items:center;gap:6px;font-size:11px;color:#cdd3da;margin-bottom:6px"><input type="checkbox" id="mail-attach"> Đính kèm vật phẩm đang chọn</label>
        <button id="mail-send" type="button" style="width:100%;padding:7px;border:none;border-radius:6px;font-weight:700;color:#06122a;background:linear-gradient(to bottom,#7db8ff,#3f6fd6);cursor:pointer">📮 Gửi</button>
      </div>
      <div id="mailbox-list"></div>`;
    document.body.appendChild(modal);
    modal.querySelector("#mailbox-close")?.addEventListener("click", () => modal.remove());
    modal.querySelector("#mail-send")?.addEventListener("click", () => {
      const to = (modal.querySelector("#mail-to") as HTMLInputElement)?.value.trim() ?? "";
      const gold = Math.floor(Number((modal.querySelector("#mail-gold") as HTMLInputElement)?.value) || 0);
      const msg = (modal.querySelector("#mail-msg") as HTMLInputElement)?.value ?? "";
      const attach = (modal.querySelector("#mail-attach") as HTMLInputElement)?.checked;
      const attachId = attach ? this.selectedItemId : undefined;
      if (to && (gold >= 1 || attachId)) {
        this.onSendMail(to, gold, msg, attachId);
        (modal.querySelector("#mail-to") as HTMLInputElement).value = "";
        (modal.querySelector("#mail-gold") as HTMLInputElement).value = "";
        (modal.querySelector("#mail-msg") as HTMLInputElement).value = "";
        (modal.querySelector("#mail-attach") as HTMLInputElement).checked = false;
      } else this.log("Nhập người nhận + (số vàng ≥1 hoặc đính kèm vật phẩm đang chọn).", "log-line");
    });
    this.renderMailbox();
  }
  private renderMailbox(): void {
    const list = document.querySelector("#mailbox-list");
    if (!list) return;
    if (this.mail.length === 0) { list.innerHTML = `<div style="color:#8e9192;font-size:12px;text-align:center;padding:8px">Hòm thư trống.</div>`; return; }
    list.innerHTML = `<button id="mail-claim-all" type="button" style="width:100%;margin-bottom:8px;padding:6px;border:none;border-radius:6px;font-weight:700;color:#08240f;background:linear-gradient(to bottom,#7bd88f,#3fa85f);cursor:pointer">📨 Nhận tất cả</button>` + this.mail.map((m) =>
      `<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:6px;background:rgba(28,28,28,0.5);border:1px solid #2a2a2a;border-radius:6px">
        <div style="flex:1;min-width:0"><div style="font-weight:700;color:#ffd166">${m.gold.toLocaleString("vi-VN")} 🪙 <small style="color:#9aa0a6;font-weight:400">từ ${escapeHtml(m.from)}</small></div>${m.message ? `<div style="font-size:11px;color:#cdd3da">${escapeHtml(m.message)}</div>` : ""}</div>
        <button type="button" data-claim="${m.id}" style="padding:6px 12px;border:none;border-radius:4px;font-weight:700;color:#08240f;background:linear-gradient(to bottom,#7bd88f,#3fa85f);cursor:pointer">Nhận</button>
      </div>`
    ).join("");
    list.querySelectorAll<HTMLButtonElement>("[data-claim]").forEach((btn) => btn.addEventListener("click", () => this.onClaimMail(btn.dataset.claim!)));
    list.querySelector<HTMLButtonElement>("#mail-claim-all")?.addEventListener("click", () => this.onClaimAllMail());
  }

  private handleSlashCommand(raw: string): void {
    const [cmd, ...rest] = raw.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();
    if (cmd === "help") {
      const lines = [
        "/help — danh sách lệnh",
        "/me <text> — phát emote",
        "/w <tên> <tin> — nhắn riêng",
        "/friend <tên> — thêm bạn",
        "/unfriend <tên> — bỏ bạn",
        "/g <tin> — chat guild",
        "/ginvite <tên> — mời vào guild",
        "/gaccept — nhận lời mời guild",
        "/inspect <tên> — xem hồ sơ người chơi",
        "/pay <tên> <số> — chuyển vàng (phí 5%)",
        "/who — danh sách người chơi online",
        "/mail — mở Hòm Thư (gửi/nhận vàng)",
        "/gift <số> — lì xì vàng cho mọi bạn online",
        "/clear — xoá nội dung chat"
      ];
      for (const l of lines) this.log(l, "log-line");
      return;
    }
    if (cmd === "me" && arg) { this.onChat(`* ${arg}`); return; }
    if ((cmd === "w" || cmd === "whisper" || cmd === "tell")) {
      const [target, ...msgRest] = rest;
      const msg = msgRest.join(" ").trim();
      if (!target || !msg) { this.log("Cú pháp: /w <tên người chơi> <tin nhắn>", "log-line"); return; }
      this.privateMessageHandler?.(target, msg);
      return;
    }
    if (cmd === "friend" && arg) { this.friendAddHandler?.(arg); return; }
    if (cmd === "unfriend" && arg) { this.friendRemoveHandler?.(arg); return; }
    if ((cmd === "inspect" || cmd === "ins") && arg) { this.inspectHandler?.(arg); return; }
    if (cmd === "pay") {
      const [target, amtStr] = rest;
      const amt = Math.floor(Number(amtStr) || 0);
      if (!target || amt < 1) { this.log("Cú pháp: /pay <tên> <số vàng>", "log-line"); return; }
      this.payHandler?.(target, amt);
      return;
    }
    if (cmd === "who" || cmd === "online") { this.whoHandler?.(); return; }
    if (cmd === "mail") { this.onRequestMail(); this.openMailbox(); return; }
    if (cmd === "gift") { const amt = Math.floor(Number(rest[0]) || 0); if (amt < 1) { this.log("Cú pháp: /gift <số vàng> — lì xì mọi bạn đang online.", "log-line"); return; } this.onGiftFriends(amt); return; }
    if ((cmd === "g" || cmd === "guild") && arg) { this.guildHandlers?.chat(arg); return; }
    if (cmd === "ginvite" && arg) { this.guildHandlers?.invite(arg); return; }
    if (cmd === "gaccept") {
      const invite = this.consumePendingGuildInvite();
      if (!invite) { this.log("Không có lời mời guild nào đang chờ.", "log-line"); return; }
      this.guildHandlers?.accept(invite.guildId);
      return;
    }
    if (cmd === "clear") {
      const root = document.querySelector("#chat-messages");
      if (root) root.innerHTML = "";
      return;
    }
    this.log(`Lệnh không hợp lệ: ${cmd}. Gõ /help để xem danh sách.`, "log-line");
  }

  appendPrivateMessage(from: string, message: string): void {
    const root = document.querySelector("#chat-messages");
    if (!root) return;
    const line = document.createElement("div");
    line.className = "chat-line";
    line.style.color = "#cdb6ff";
    const time = new Date();
    const hh = time.getHours().toString().padStart(2, "0");
    const mm = time.getMinutes().toString().padStart(2, "0");
    line.innerHTML = `<time class="chat-time">${hh}:${mm}</time><strong>[Riêng] ${escapeHtml(from)}</strong><span>${escapeHtml(message)}</span>`;
    root.append(line);
    root.scrollTop = root.scrollHeight;
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
    // Sprint 175: gear power summary — total enhancement (+N) + equipped count.
    const equippedItems = (["weapon", "helmet", "armor", "boots", "ring"] as const)
      .map((s) => this.player!.inventory.equipped[s]).filter((it): it is NonNullable<typeof it> => !!it);
    const totalPlus = equippedItems.reduce((sum, it) => sum + (it.kind === "equipment" ? (it.plusLevel ?? 0) : 0), 0);
    const summary = document.createElement("div");
    summary.style.cssText = "display:flex;justify-content:space-between;font-size:11px;color:#9be7a8;margin-bottom:6px;padding:3px 4px;border-bottom:1px solid #232838";
    summary.innerHTML = `<span>⚒️ Sức mạnh: <strong style="color:#ffd166">+${totalPlus}</strong></span><span>${equippedItems.length}/5 ô</span>`;
    root.append(summary);
    for (const slot of ["weapon", "helmet", "armor", "boots", "ring"] as const) {
      const item = this.player.inventory.equipped[slot];
      const plusBadge = item && item.kind === "equipment" && item.plusLevel ? ` <span style="color:#ffd166;font-size:10px">+${item.plusLevel}</span>` : "";
      const gemBadge = item && item.kind === "equipment" && item.socketGem ? ` <span title="${escapeHtml(item.socketGem.name)}" style="font-size:10px">💠</span>` : "";
      const row = document.createElement("div");
      row.className = "slot";
      row.dataset.slot = slot;
      row.innerHTML = `<span>${t(slot)}${plusBadge}${gemBadge}</span><strong><i class="material-symbols-outlined">${item ? materialIcon(item.slot) : materialIcon(slot)}</i></strong>`;
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
    document.querySelector("#inventory-count")!.textContent = `${this.player.inventory.items.length} / ${bagCapacity(this.player.bagBonus)}`;
    const autoSel = document.querySelector<HTMLSelectElement>("#auto-salvage-select");
    if (autoSel) autoSel.value = this.player.autoSalvageRarity ?? "off";
    const bagBtn = document.querySelector<HTMLButtonElement>("#bag-expand-button");
    if (bagBtn) {
      const bonus = this.player.bagBonus ?? 0;
      if (bonus >= BAG_MAX_BONUS) {
        bagBtn.textContent = "Túi tối đa";
        bagBtn.disabled = true;
      } else {
        bagBtn.textContent = `Mở rộng túi (+5 ô · ${bagUpgradeCost(bonus).toLocaleString("vi-VN")} 🪙)`;
        bagBtn.disabled = this.player.stats.gold < bagUpgradeCost(bonus);
      }
    }
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
    // Sprint 154: render a rarity-sorted copy (epic → rare → common, then by
    // value) without mutating the authoritative inventory order. Locked items
    // get a 🔒 badge so protected gear is obvious at a glance.
    const rarityRank: Record<string, number> = { epic: 0, rare: 1, common: 2 };
    const displayItems = [...this.player.inventory.items].sort((a, b) => {
      const r = (rarityRank[a.rarity] ?? 9) - (rarityRank[b.rarity] ?? 9);
      return r !== 0 ? r : (b.value - a.value);
    });
    for (const item of displayItems) {
      const button = document.createElement("button");
      button.className = `item ${rarityClass[item.rarity]}${item.kind === "consumable" ? " consumable" : ""}${item.id === this.selectedItemId ? " selected" : ""}${item.locked ? " locked" : ""}`;
      button.draggable = true;
      const gemDot = item.kind === "equipment" && item.socketGem
        ? `<span class="item-gem" title="${escapeHtml(item.socketGem.name)}" style="position:absolute;bottom:1px;left:2px;width:7px;height:7px;border-radius:50%;background:#${(getStatGem(item.socketGem.gemId)?.color ?? 0xffffff).toString(16).padStart(6, "0")};box-shadow:0 0 4px 1px #fff8;animation:gemTwinkle 1.4s ease-in-out infinite"></span>`
        : "";
      button.innerHTML = `<i class="material-symbols-outlined">${itemMaterialIcon(item)}</i><small>${itemIcon(item)}</small>${item.locked ? `<span class="item-lock" style="position:absolute;top:1px;right:2px;font-size:10px;line-height:1;text-shadow:0 1px 2px #000">🔒</span>` : ""}${gemDot}`;
      button.style.position = "relative";
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
    // Salvage (Phân Giải) only applies to equipment — turns it into materials.
    const salvageBtn = item.kind === "equipment"
      ? `<button type="button" data-action="salvage">🔨 Phân giải</button>`
      : "";
    // Sprint 151: lock toggle protects an item from sell / salvage / drop.
    const lockBtn = `<button type="button" data-action="lock">${item.locked ? "🔓 Mở khóa" : "🔒 Khóa"}</button>`;
    // Sprint 155: gold enhancement (+N) for equipment.
    const upgradeBtn = item.kind === "equipment"
      ? `<button type="button" data-action="upgrade">⚒️ Cường hóa${item.plusLevel ? ` (+${item.plusLevel})` : ""}</button>`
      : "";
    actions.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <button type="button" data-action="${primaryAction}">${primaryLabel}</button>
      <button type="button" data-action="sell">${t("sell")}</button>
      ${salvageBtn}
      ${upgradeBtn}
      ${lockBtn}
      <button type="button" data-action="drop">${t("drop")}</button>
    `;
    actions.querySelector('[data-action="equip"]')?.addEventListener("click", () => this.onEquip(item.id));
    actions.querySelector('[data-action="use"]')?.addEventListener("click", () => this.onUse(item.id));
    actions.querySelector('[data-action="sell"]')?.addEventListener("click", () => this.onSell(item.id));
    actions.querySelector('[data-action="salvage"]')?.addEventListener("click", () => this.onSalvage(item.id));
    actions.querySelector('[data-action="lock"]')?.addEventListener("click", () => this.onToggleLock(item.id));
    actions.querySelector('[data-action="upgrade"]')?.addEventListener("click", () => this.onUpgradeItem(item.id));
    actions.querySelector('[data-action="drop"]')?.addEventListener("click", () => this.onDrop(item.id));
    // Sprint 186: gem socketing controls for equipment.
    if (item.kind === "equipment") {
      const gemRow = document.createElement("div");
      gemRow.style.cssText = "margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11px";
      if (item.socketGem) {
        gemRow.innerHTML = `<span style="color:#bdfdff">💠 ${escapeHtml(item.socketGem.name)}</span><button type="button" data-unsocket="1" style="padding:3px 8px;border:1px solid #5a3939;border-radius:4px;color:#ff8181;background:#2c1c1c;cursor:pointer">Gỡ ngọc</button>`;
        gemRow.querySelector("[data-unsocket]")?.addEventListener("click", () => this.onUnsocketGem(item.id));
      } else {
        gemRow.innerHTML = `<span style="color:#9aa0a6">Khảm:</span>` + GEM_CATALOG.map((g) =>
          `<button type="button" data-gem="${g.id}" title="${escapeHtml(g.name)} (💎${g.gemPrice})" style="padding:3px 7px;border:none;border-radius:4px;color:#1d1500;font-weight:700;background:#${g.color.toString(16).padStart(6, "0")};cursor:pointer">${escapeHtml(g.name)} 💎${g.gemPrice}</button>`
        ).join("");
        gemRow.querySelectorAll<HTMLButtonElement>("[data-gem]").forEach((btn) => btn.addEventListener("click", () => this.onSocketGem(item.id, btn.dataset.gem!)));
      }
      actions.appendChild(gemRow);
    }
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

  private skillWasCooling = new Set<string>();
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
      // "Ready" flash when a skill comes off cooldown (Sprint 105).
      if (this.skillWasCooling.has(skillId) && !cooling) {
        button.animate(
          [
            { boxShadow: "0 0 0 0 rgba(255,209,102,0)", transform: "scale(1)" },
            { boxShadow: "0 0 12px 4px rgba(255,209,102,0.95)", transform: "scale(1.14)", offset: 0.4 },
            { boxShadow: "0 0 0 0 rgba(255,209,102,0)", transform: "scale(1)" }
          ],
          { duration: 460, easing: "ease-out" }
        );
      }
      if (cooling) this.skillWasCooling.add(skillId);
      else this.skillWasCooling.delete(skillId);
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
    const pct = Math.round((got / Math.max(1, total)) * 100);
    // Sprint 199: visual progress bar + percentage.
    header.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span><strong>Tiến trình:</strong> ${got} / ${total} thành tựu</span><strong style="color:#ffd166">${pct}%</strong></div><div style="height:8px;background:#101820;border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(to right,#c8a948,#ffd166);transition:width .4s"></div></div>`;
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
  // Sprint 178: surface enhancement (+N), enchant count, and lock state.
  const plus = item.plusLevel ? ` +${item.plusLevel}` : "";
  const extras: string[] = [];
  if (item.enchantCount) extras.push(`✨ Tinh luyện: ${item.enchantCount}`);
  if (item.locked) extras.push("🔒 Đã khóa");
  const extraLine = extras.length ? `\n${extras.join(" · ")}` : "";
  return `${item.name}${plus}\n${t(item.rarity)} ${t(item.slot)}\n${stats}\n${t("value")}: ${item.value} ${t("gold")}${extraLine}`;
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
