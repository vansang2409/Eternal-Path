import type { Server, Socket } from "socket.io";
import {
  ARENA_TILE_BOX,
  BASE_MAX_STAMINA,
  BIOME_INFO,
  CLASS_CATALOG,
  DEFAULT_AFK_ZONE,
  DEFAULT_EQUIPPED_SKILLS,
  DEFAULT_LEARNED_SKILLS,
  BAG_SLOT_PACK,
  BAG_MAX_BONUS,
  bagUpgradeCost,
  bagCapacity,
  GEM_TO_GOLD_RATE,
  gemsToGold,
  GOLD_BOOST_GEM_COST,
  GOLD_BOOST_DURATION_MS,
  GOLD_BOOST_MULTIPLIER,
  isGoldBoostActive,
  XP_BOOST_GEM_COST,
  XP_BOOST_DURATION_MS,
  XP_BOOST_MULTIPLIER,
  isXpBoostActive,
  upgradeCost,
  upgradeSuccessChance,
  RESPEC_COST_PER_POINT,
  RAGE_GEM_COST,
  RAGE_DURATION_MS,
  RAGE_MULTIPLIER,
  isRageActive,
  levelMilestone,
  achievementMilestone,
  WEEKLY_CLAIM_INTERVAL_MS,
  WEEKLY_REWARD_GOLD,
  WEEKLY_REWARD_GEMS,
  HAPPY_HOUR_MULTIPLIER,
  HAPPY_HOUR_DURATION_MS,
  HAPPY_HOUR_INTERVAL_MS,
  isHappyHourActive,
  ARENA_KILL_GOLD,
  ARENA_KILL_GEMS,
  SKILL_MAX_RANK,
  SPRINT_DRAIN_PER_SECOND,
  SPRINT_MIN_STAMINA_TO_START,
  SPRINT_MULTIPLIER,
  SPRINT_REGEN_PER_SECOND,
  TALENT_POINTS_PER_LEVEL,
  dayPhaseAt,
  skillRankMultiplier,
  timeOfDay,
  BATTLE_PASS_EXP_PER_KILL,
  BATTLE_PASS_EXP_PER_QUEST,
  BATTLE_PASS_EXP_PER_TIER,
  BATTLE_PASS_PREMIUM_PRICE,
  BATTLE_PASS_TIERS,
  VIP_DAILY_GEMS,
  VIP_EXP_MULTIPLIER,
  VIP_GOLD_MULTIPLIER,
  VIP_PACKAGES,
  isVipActive,
  GUILD_CREATE_COST_GOLD,
  GUILD_INVITE_TTL_MS,
  GUILD_MOTD_MAX,
  GUILD_DESC_MAX,
  GUILD_BANK_MIN_TXN,
  GUILD_DONATE_MIN,
  GUILD_GOLD_PER_EXP,
  GUILD_MAX_LEVEL,
  GUILD_BOOST_GEM_COST,
  GUILD_BOOST_DURATION_MS,
  GUILD_BOOST_EXP_BONUS,
  canManageGuild,
  sanitizeGuildName,
  sanitizeGuildTag,
  guildLevelForExp,
  guildTier,
  guildMaxMembers,
  guildExpProgress,
  isGuildBoostActive,
  guildRaidMaxHp,
  GUILD_RAID_DURATION_MS,
  GUILD_RAID_COOLDOWN_MS,
  GUILD_RAID_ATTACK_COOLDOWN_MS,
  GUILD_RAID_GOLD_FACTOR,
  GUILD_RAID_EXP_FACTOR,
  GUILD_RAID_TOP_GEM,
  guildRaidSummonCost,
  MARKET_MAX_LISTINGS_PER_SELLER,
  MARKET_FEATURE_GEM_COST,
  MARKET_FEATURE_DURATION_MS,
  marketTax,
  marketNet,
  sanitizeMarketPrice,
  isMarketFeatured,
  sortListings,
  DAILY_CLAIM_INTERVAL_MS,
  DAILY_GEM_REWARD,
  computeStreakClaim,
  dateKey,
  earnedTitles,
  isTitleEarned,
  titleLabel,
  getPet,
  petLabel,
  PET_CATALOG,
  MYSTERY_BOX_GEM_COST,
  MYSTERY_DUP_GEMS,
  rollMysteryBox,
  PET_FEED_GOLD_COST,
  PET_FEED_XP,
  PET_TREAT_GEM_COST,
  PET_TREAT_XP,
  petLevelForXp,
  petBuffAtLevel,
  MATERIAL_CATALOG,
  RECIPES,
  classCanLearnSkill,
  getCosmetic,
  dailyDealCosmetic,
  dailyDealPrice,
  dailyDealDayIndex,
  getRecipe,
  getBrewRecipe,
  MOUNT_CATALOG,
  getMount,
  mountSpeedBonus,
  getStatGem,
  isPlayerClass,
  materialDropForMonster,
  salvageYield,
  MONSTER_ATTACK_COOLDOWN_MS,
  MONSTER_ATTACK_RANGE,
  MONSTER_SPEED,
  OFFLINE_REWARD_MAX_MS,
  OFFLINE_REWARD_MIN_MS,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  PLAYER_SPEED,
  SKILL_CATALOG,
  SKILL_LOADOUT_SIZE,
  TILE_SIZE,
  TileId,
  WORLD_HEIGHT,
  WORLD_SEED,
  WORLD_WIDTH,
  achievementById,
  clampToWorld,
  createLoot,
  createShopStock,
  distance,
  gatherSpawnHints,
  generateWorld,
  getMonsterDefinition,
  grantExp,
  isAfkZone,
  isSkillId,
  isWalkableTile,
  monsterAttack,
  monsterDefense,
  monsterMaxHp,
  offlineRewardsFor,
  rollDamage
} from "@mmorpg/shared";
import type {
  ArenaLeaderRow,
  ClientInput,
  ClientToServerEvents,
  Direction,
  AllocatableStat,
  EquipmentItem,
  EquipmentSlot,
  ItemStats,
  FloatingTextEvent,
  GroundItem,
  Item,
  MaterialId,
  MaterialItem,
  MonsterState,
  PlayerState,
  ChatMessage,
  GuildRecord,
  GuildView,
  GuildLeaderboardRow,
  GuildRaidView,
  MarketListing,
  MarketListingView,
  PlayerProfile,
  PartyView,
  QuestListPayload,
  QuestView,
  Rarity,
  ShopItem,
  ServerToClientEvents,
  SkillId,
  Vec2,
  WorldMap,
  WorldMapPayload,
  WorldSnapshot
} from "@mmorpg/shared";
import type { PlayerRepository } from "../db/PlayerRepository.js";
import { guildStore } from "../db/GuildStore.js";
import { marketStore } from "../db/MarketStore.js";
import { mailStore } from "../db/MailStore.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServerSocket = Server<ClientToServerEvents, ServerToClientEvents>;

const TICK_RATE = 20;
const SNAPSHOT_RATE = 15;
const townSpawn = { x: 7 * TILE_SIZE, y: 7 * TILE_SIZE };
const TOWN_HEAL_PER_SECOND = 0.14;
const TOWN_HEAL_FLOATING_COOLDOWN_MS = 1400;
const GROUND_ITEM_PICKUP_RANGE = 72;
const GROUND_ITEM_TTL_MS = 10 * 60 * 1000;
const TREASURE_RESPAWN_MS = 5 * 60 * 1000;
const TREASURE_DROPPED_BY = "treasure";
const TREASURE_CHEST_COUNT = 18;
const SELL_VALUE_RATE = 0.6;
const AUTO_RETARGET_RANGE = 260;
const BAG_FULL_MESSAGE = "Túi đồ đã đầy.";
const ELITE_CHANCE = 0.15;
const ELITE_REWARD_MULTIPLIER = 2.5;
const WORLD_BOSS_RESPAWN_MS = 4 * 60 * 1000;
const WORLD_BOSS_REWARD_MULTIPLIER = 8;
const MAX_ACTIVE_QUESTS = 3;
const PARTY_MAX_SIZE = 4;
const PARTY_INVITE_RANGE = 600;
const PARTY_SHARE_RANGE = 360;
const SAVE_FLUSH_MS = 9000;
const STAT_POINTS_PER_LEVEL = 3;
const STAT_POINT_GAINS: Record<AllocatableStat, number> = {
  attack: 1,
  defense: 1,
  maxHp: 6
};

interface Party {
  id: string;
  leaderId: string;
  memberIds: string[];
}

type QuestCategoryKind = "tutorial" | "story" | "daily";

type QuestObjective =
  | { kind: "killAny" }
  | { kind: "killLevel"; minLevel: number }
  | { kind: "killSpecific"; monsterType: string }
  | { kind: "reachLevel"; level: number }
  | { kind: "openChest" }
  | { kind: "learnSkill" }
  | { kind: "equipRarity"; rarity: "rare" | "epic" }
  | { kind: "craftItem" }
  | { kind: "collectGold"; amount: number }
  | { kind: "salvageGear" }
  | { kind: "upgradeGear" }
  | { kind: "socketGem" }
  | { kind: "sendMail" };

interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  required: number;
  rewardGold: number;
  rewardExp: number;
  category: QuestCategoryKind;
  objective: QuestObjective;
}

interface ActiveQuestState {
  questId: string;
  progress: number;
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  // ─── TUTORIAL (5) — auto-given to brand new players ─────────────────
  {
    id: "tut-first-kill",
    title: "Lần đầu chiến đấu",
    description: "Hạ 1 quái bất kỳ để làm quen combat.",
    required: 1, rewardGold: 25, rewardExp: 40,
    category: "tutorial", objective: { kind: "killAny" }
  },
  {
    id: "tut-slime-hunter",
    title: "Săn Slime",
    description: "Hạ 3 Forest Slime ở rừng Greenwood.",
    required: 3, rewardGold: 30, rewardExp: 60,
    category: "tutorial", objective: { kind: "killSpecific", monsterType: "forestSlime" }
  },
  {
    id: "tut-learn-skill",
    title: "Học kỹ năng đầu tiên",
    description: "Học 1 kỹ năng từ modal Học kỹ năng.",
    required: 1, rewardGold: 30, rewardExp: 50,
    category: "tutorial", objective: { kind: "learnSkill" }
  },
  {
    id: "tut-open-chest",
    title: "Khám phá kho báu",
    description: "Mở 1 Rương Kho Báu rải rác trên bản đồ.",
    required: 1, rewardGold: 40, rewardExp: 80,
    category: "tutorial", objective: { kind: "openChest" }
  },
  {
    id: "tut-equip-rare",
    title: "Trang bị tốt hơn",
    description: "Trang bị 1 món đồ Hiếm (Rare) hoặc cao hơn.",
    required: 1, rewardGold: 35, rewardExp: 70,
    category: "tutorial", objective: { kind: "equipRarity", rarity: "rare" }
  },

  // ─── STORY (8) — always available ────────────────────────────────────
  {
    id: "story-cull-5",
    title: "Diệt quái Greenwood",
    description: "Hạ 5 quái bất kỳ.",
    required: 5, rewardGold: 60, rewardExp: 100,
    category: "story", objective: { kind: "killAny" }
  },
  {
    id: "story-midlands",
    title: "Chinh phục Midlands",
    description: "Hạ 4 quái cấp 4 trở lên.",
    required: 4, rewardGold: 130, rewardExp: 220,
    category: "story", objective: { kind: "killLevel", minLevel: 4 }
  },
  {
    id: "story-deeplands",
    title: "Vực Sâu Gọi Tên",
    description: "Hạ 3 quái cấp 7 trở lên.",
    required: 3, rewardGold: 240, rewardExp: 380,
    category: "story", objective: { kind: "killLevel", minLevel: 7 }
  },
  {
    id: "story-reach-5",
    title: "Lên cấp 5",
    description: "Đạt cấp nhân vật 5.",
    required: 5, rewardGold: 180, rewardExp: 300,
    category: "story", objective: { kind: "reachLevel", level: 5 }
  },
  {
    id: "story-reach-10",
    title: "Lên cấp 10",
    description: "Đạt cấp nhân vật 10.",
    required: 10, rewardGold: 500, rewardExp: 900,
    category: "story", objective: { kind: "reachLevel", level: 10 }
  },
  {
    id: "story-craft",
    title: "Lò Rèn Đầu Tiên",
    description: "Chế tạo 1 trang bị tại Lò Rèn.",
    required: 1, rewardGold: 120, rewardExp: 200,
    category: "story", objective: { kind: "craftItem" }
  },
  {
    id: "story-equip-epic",
    title: "Trang bị Sử Thi",
    description: "Trang bị 1 món Epic.",
    required: 1, rewardGold: 250, rewardExp: 400,
    category: "story", objective: { kind: "equipRarity", rarity: "epic" }
  },
  {
    id: "story-treasure-hunter",
    title: "Thợ Săn Kho Báu",
    description: "Mở 5 Rương Kho Báu.",
    required: 5, rewardGold: 280, rewardExp: 450,
    category: "story", objective: { kind: "openChest" }
  },

  // ─── DAILY POOL (5+) — 3 picked per day per player ──────────────────
  {
    id: "daily-kill-12",
    title: "Hằng ngày: Săn 12 quái",
    description: "Hạ 12 quái bất kỳ. Reset mỗi 24 giờ.",
    required: 12, rewardGold: 220, rewardExp: 360,
    category: "daily", objective: { kind: "killAny" }
  },
  {
    id: "daily-elite-3",
    title: "Hằng ngày: Săn 3 elite/boss",
    description: "Hạ 3 quái cấp 6 trở lên (elite/boss).",
    required: 3, rewardGold: 320, rewardExp: 520,
    category: "daily", objective: { kind: "killLevel", minLevel: 6 }
  },
  {
    id: "daily-chest-2",
    title: "Hằng ngày: Mở 2 rương",
    description: "Mở 2 Rương Kho Báu.",
    required: 2, rewardGold: 180, rewardExp: 280,
    category: "daily", objective: { kind: "openChest" }
  },
  {
    id: "daily-craft-1",
    title: "Hằng ngày: Chế 1 trang bị",
    description: "Chế tạo 1 món tại Lò Rèn.",
    required: 1, rewardGold: 200, rewardExp: 320,
    category: "daily", objective: { kind: "craftItem" }
  },
  {
    id: "daily-slime-8",
    title: "Hằng ngày: Tiêu diệt Slime",
    description: "Hạ 8 Forest Slime.",
    required: 8, rewardGold: 150, rewardExp: 230,
    category: "daily", objective: { kind: "killSpecific", monsterType: "forestSlime" }
  },
  {
    id: "daily-wolf-6",
    title: "Hằng ngày: Săn Sói",
    description: "Hạ 6 Dire Wolf.",
    required: 6, rewardGold: 240, rewardExp: 380,
    category: "daily", objective: { kind: "killSpecific", monsterType: "direWolf" }
  },
  // Sprint 166: daily quests tied to the gear-deepening loop (S151-158).
  {
    id: "daily-salvage-3",
    title: "Hằng ngày: Phân giải 3 trang bị",
    description: "Phân giải 3 trang bị thành nguyên liệu.",
    required: 3, rewardGold: 260, rewardExp: 360,
    category: "daily", objective: { kind: "salvageGear" }
  },
  {
    id: "daily-upgrade-1",
    title: "Hằng ngày: Cường hóa 1 lần",
    description: "Cường hóa trang bị thành công 1 lần.",
    required: 1, rewardGold: 300, rewardExp: 420,
    category: "daily", objective: { kind: "upgradeGear" }
  },
  // Sprint 189: socket-a-gem daily quest.
  {
    id: "daily-socket-1",
    title: "Hằng ngày: Khảm 1 đá quý",
    description: "Khảm 1 viên đá quý vào trang bị.",
    required: 1, rewardGold: 280, rewardExp: 380,
    category: "daily", objective: { kind: "socketGem" }
  },
  // Sprint 204: send-mail daily quest.
  {
    id: "daily-mail-1",
    title: "Hằng ngày: Gửi 1 lá thư",
    description: "Gửi vàng/vật phẩm cho người chơi khác qua Hòm Thư.",
    required: 1, rewardGold: 200, rewardExp: 300,
    category: "daily", objective: { kind: "sendMail" }
  }
];

const TUTORIAL_QUEST_IDS = QUEST_TEMPLATES.filter((q) => q.category === "tutorial").map((q) => q.id);
const DAILY_QUEST_POOL = QUEST_TEMPLATES.filter((q) => q.category === "daily").map((q) => q.id);
const DAILY_QUESTS_PER_DAY = 3;
const DAILY_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class GameWorld {
  private readonly players = new Map<string, PlayerState>();
  private readonly sockets = new Map<string, GameSocket>();
  private readonly inputs = new Map<string, ClientInput>();
  private readonly chatMessages: ChatMessage[] = [];
  private readonly chatCooldowns = new Map<string, number>();
  private readonly lastTownHealTextAt = new Map<string, number>();
  private readonly autoRetarget = new Map<string, boolean>();
  private readonly activeQuests = new Map<string, ActiveQuestState[]>();
  private readonly parties = new Map<string, Party>();
  private readonly playerParty = new Map<string, string>();
  private readonly pendingInvites = new Map<string, string>();
  // Pending guild invites keyed by invitee accountName.
  private readonly guildInvites = new Map<string, { guildId: string; expiresAt: number }>();
  // Ephemeral guild raid bosses keyed by guildId (Sprint 66).
  private readonly guildRaids = new Map<string, { bossName: string; maxHp: number; hp: number; startedAt: number; expiresAt: number; contributors: Map<string, number> }>();
  private readonly guildRaidCooldownUntil = new Map<string, number>();
  private readonly raidAttackCooldown = new Map<string, number>();
  private readonly sessions = new Map<string, { email: string; accountName: string }>();
  private readonly dirtyPlayers = new Set<string>();
  private readonly shopStock: ShopItem[] = createShopStock();
  private readonly groundItems = new Map<string, GroundItem>();
  private readonly returningToSpawn = new Set<string>();
  private monsters: MonsterState[] = [];
  private readonly worldMap: WorldMap;
  private readonly worldMapPayload: WorldMapPayload;
  private readonly chestSlots: Array<{ id: string; position: Vec2; activeItemId?: string; nextSpawnAt: number; lootLevel: number }> = [];
  private tickTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;

  constructor(
    private readonly io: GameServerSocket,
    private readonly repository: PlayerRepository
  ) {
    this.worldMap = generateWorld(WORLD_SEED, WORLD_WIDTH, WORLD_HEIGHT);
    this.worldMapPayload = {
      width: this.worldMap.width,
      height: this.worldMap.height,
      seed: this.worldMap.seed,
      tiles: this.worldMap.tiles,
      landmarks: this.worldMap.landmarks
    };
    this.monsters = createMonsterSpawns(this.worldMap);
    this.initTreasureChestSlots();
  }

  // Pick TREASURE_CHEST_COUNT walkable tiles in remote (mid-to-high level)
  // biomes; deterministic by world seed.
  private initTreasureChestSlots(): void {
    const candidates: Array<{ x: number; y: number; biomeLevel: number }> = [];
    for (let y = 12; y < this.worldMap.height - 12; y += 4) {
      for (let x = 12; x < this.worldMap.width - 12; x += 4) {
        const t = this.worldMap.tiles[y][x];
        if (!isWalkableTile(t)) continue;
        if (t === TileId.TownStone || t === TileId.Road) continue;
        if (x < 24 && y < 24) continue; // not too close to town
        const info = BIOME_INFO[t];
        candidates.push({ x, y, biomeLevel: info?.levelMin ?? 1 });
      }
    }
    let rs = (this.worldMap.seed ^ 0xc4e57) >>> 0;
    const rng = () => {
      rs = (rs + 0x6d2b79f5) | 0;
      let t = rs;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Shuffle and take N.
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    const chosen = candidates.slice(0, TREASURE_CHEST_COUNT);
    for (let i = 0; i < chosen.length; i += 1) {
      const c = chosen[i];
      this.chestSlots.push({
        id: `chest-${i}`,
        position: { x: c.x * TILE_SIZE + TILE_SIZE / 2, y: c.y * TILE_SIZE + TILE_SIZE / 2 },
        nextSpawnAt: 0,
        lootLevel: Math.max(2, c.biomeLevel)
      });
    }
  }

  private maintainTreasureChests(now: number): void {
    for (const slot of this.chestSlots) {
      if (slot.activeItemId) continue;
      if (now < slot.nextSpawnAt) continue;
      // 18% chance the chest contains a Recall Scroll instead of equipment.
      let item: Item | undefined;
      if (Math.random() < 0.18) {
        item = {
          id: `scroll-${now}-${Math.random().toString(36).slice(2, 7)}`,
          kind: "consumable",
          name: "Cuộn Hồi Thành",
          rarity: "rare",
          heal: 0,
          recall: true,
          value: 80
        };
      } else {
        item = createLoot(slot.lootLevel + 2, "voidKnight", false, true);
      }
      if (!item) continue;
      const id = `${TREASURE_DROPPED_BY}-${slot.id}-${now}`;
      const groundItem: GroundItem = {
        id,
        item,
        position: { ...slot.position },
        droppedBy: TREASURE_DROPPED_BY,
        createdAt: now
      };
      this.groundItems.set(id, groundItem);
      slot.activeItemId = id;
    }
  }

  // Pixel position -> tile walkability lookup.
  private isPositionWalkable(position: Vec2): boolean {
    const tx = Math.floor(position.x / TILE_SIZE);
    const ty = Math.floor(position.y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.worldMap.width || ty >= this.worldMap.height) return false;
    return isWalkableTile(this.worldMap.tiles[ty][tx]);
  }

  // Sliding collision: try moving in X and Y separately so a player can
  // slide along walls instead of getting stuck on a corner.
  private resolveMovement(from: Vec2, to: Vec2): Vec2 {
    if (this.isPositionWalkable(to)) return clampToWorld(to);
    const slideX = { x: to.x, y: from.y };
    if (slideX.x !== from.x && this.isPositionWalkable(slideX)) return clampToWorld(slideX);
    const slideY = { x: from.x, y: to.y };
    if (slideY.y !== from.y && this.isPositionWalkable(slideY)) return clampToWorld(slideY);
    return clampToWorld(from);
  }

  start(): void {
    this.tickTimer = setInterval(() => this.tick(1000 / TICK_RATE), 1000 / TICK_RATE);
    this.snapshotTimer = setInterval(() => this.broadcastSnapshot(), 1000 / SNAPSHOT_RATE);
    setInterval(() => this.flushDirty(), SAVE_FLUSH_MS);
    // Broadcast a low-rate world clock so the client can animate the day/night
    // tint without each player having to compute time independently.
    setInterval(() => this.broadcastWorldTime(), 5000);
    // Sprint 167: auto-start the Happy Hour world event on a fixed cadence.
    setInterval(() => this.startHappyHour(), HAPPY_HOUR_INTERVAL_MS);
  }

  // Sprint 167: server-wide x2 gold-drop window, broadcast to everyone.
  private happyHourUntil = 0;
  private startHappyHour(): void {
    this.happyHourUntil = Date.now() + HAPPY_HOUR_DURATION_MS;
    this.io.emit("worldEvent", { kind: "happyHour", until: this.happyHourUntil, multiplier: HAPPY_HOUR_MULTIPLIER });
    this.io.emit("system", `🌟 GIỜ VÀNG bắt đầu! x${HAPPY_HOUR_MULTIPLIER} vàng rơi ra trong ${Math.round(HAPPY_HOUR_DURATION_MS / 60000)} phút!`);
  }

  // Sprint 169: credit an arena kill to the attacker — bumps their kill count,
  // pays the gold/gem bounty, and unlocks the PvP achievements.
  private creditArenaKill(attacker: PlayerState): void {
    attacker.pvpKills = (attacker.pvpKills ?? 0) + 1;
    attacker.stats.gold += ARENA_KILL_GOLD;
    attacker.gems = (attacker.gems ?? 0) + ARENA_KILL_GEMS;
    // Sprint 170: consecutive-kill streak pays escalating gem milestones.
    attacker.arenaStreak = (attacker.arenaStreak ?? 0) + 1;
    const streakBonus: Record<number, number> = { 3: 5, 5: 10, 10: 30 };
    if ((attacker.arenaStreak ?? 0) >= 5) this.unlockAchievement(attacker, "streak-master");
    const bonus = streakBonus[attacker.arenaStreak];
    if (bonus) {
      attacker.gems = (attacker.gems ?? 0) + bonus;
      this.sockets.get(attacker.id)?.emit("system", `🔥 Chuỗi ${attacker.arenaStreak} hạ gục! Thưởng +${bonus} 💎.`);
    }
    this.unlockAchievement(attacker, "pvp-victor");
    if ((attacker.pvpKills ?? 0) >= 10) this.unlockAchievement(attacker, "pvp-champion");
  }

  private broadcastWorldTime(): void {
    const now = Date.now();
    const t01 = timeOfDay(now);
    const phase = dayPhaseAt(t01);
    this.io.emit("worldTime", { serverTime: now, timeOfDay: t01, phase });
  }

  private markDirty(player: PlayerState): void {
    this.dirtyPlayers.add(player.id);
  }

  private flushDirty(): void {
    for (const id of this.dirtyPlayers) {
      const player = this.players.get(id);
      if (player) void this.repository.save(player);
    }
    this.dirtyPlayers.clear();
  }

  private saveNow(player: PlayerState): Promise<void> {
    this.dirtyPlayers.delete(player.id);
    return this.repository.save(player);
  }

  private applyOfflineRewards(player: PlayerState, lastSeenAt: number | undefined, now: number): { elapsedMs: number; exp: number; gold: number; cappedAtMax: boolean } | undefined {
    if (!lastSeenAt) return undefined;
    const rawElapsedMs = now - lastSeenAt;
    if (rawElapsedMs < OFFLINE_REWARD_MIN_MS) return undefined;

    const elapsedMs = Math.min(rawElapsedMs, OFFLINE_REWARD_MAX_MS);
    const rewards = offlineRewardsFor(player.afkZone, elapsedMs);
    if (rewards.exp <= 0 && rewards.gold <= 0) return undefined;

    const leveled = this.grantExpAndStatPoints(player, rewards.exp);
    player.stats.gold += rewards.gold;
    if (leveled) this.updateReachLevelQuests(player);
    this.unlockAchievement(player, "idler");
    if (leveled) this.checkLevelAchievements(player);
    this.markDirty(player);

    return {
      elapsedMs,
      exp: rewards.exp,
      gold: rewards.gold,
      cappedAtMax: rawElapsedMs >= OFFLINE_REWARD_MAX_MS
    };
  }

  connect(socket: GameSocket): void {
    socket.on("login", async ({ email, accountName, password, token }) => {
      let resolvedEmail: string;
      let resolvedName: string;

      if (token) {
        const session = this.sessions.get(token);
        if (!session) {
          socket.emit("system", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
          return;
        }
        resolvedEmail = session.email;
        resolvedName = session.accountName;
      } else {
        const normalizedEmail = normalizeEmail(email ?? "");
        if (!normalizedEmail) {
          socket.emit("system", "Vui lòng nhập email hợp lệ để vào game.");
          return;
        }
        if (!password || password.length < 4) {
          socket.emit("system", "Mật khẩu phải có ít nhất 4 ký tự.");
          return;
        }
        resolvedName = sanitizeName(accountName || normalizedEmail.split("@")[0]);
        const auth = await this.repository.verifyOrCreateAuth(normalizedEmail, resolvedName, password);
        if (!auth.ok) {
          socket.emit("system", "Sai mật khẩu.");
          return;
        }
        resolvedEmail = normalizedEmail;
      }

      const saved = await this.repository.load(resolvedEmail, resolvedName);
      // Guard against saved positions on tiles that became unwalkable after
      // a world regen: snap them back to town spawn.
      const initialPosition = saved.position && this.isPositionWalkable(saved.position) ? { ...saved.position } : { ...townSpawn };
      // Backfill stamina for saves predating the field.
      if (saved.stats.maxStamina === undefined) saved.stats.maxStamina = BASE_MAX_STAMINA;
      if (saved.stats.stamina === undefined) saved.stats.stamina = saved.stats.maxStamina;
      const player: PlayerState = {
        id: socket.id,
        email: resolvedEmail,
        accountName: resolvedName,
        position: initialPosition,
        velocity: { x: 0, y: 0 },
        facing: "down",
        stats: saved.stats,
        unspentPoints: saved.unspentPoints ?? 0,
        inventory: saved.inventory,
        afkZone: saved.afkZone ?? DEFAULT_AFK_ZONE,
        achievements: saved.achievements ?? [],
        lastAttackAt: 0,
        skillCooldowns: createSkillCooldowns(),
        learnedSkills: sanitizeLearnedSkills(saved.learnedSkills),
        equippedSkills: [],
        pvpKills: 0,
        pvpDeaths: 0,
        arenaStreak: 0,
        inArena: false,
        playerClass: saved.playerClass,
        dailyQuestIds: saved.dailyQuestIds,
        dailyResetAt: saved.dailyResetAt,
        tutorialGiven: saved.tutorialGiven,
        talentPoints: saved.talentPoints ?? Math.max(0, saved.stats.level - 1) * TALENT_POINTS_PER_LEVEL,
        skillRanks: saved.skillRanks ?? {},
        totalKills: saved.totalKills ?? 0,
        chestsOpened: saved.chestsOpened ?? 0,
        itemsCrafted: saved.itemsCrafted ?? 0,
        skillLoadouts: saved.skillLoadouts ?? [[], [], []],
        gems: saved.gems ?? 0,
        cosmetics: saved.cosmetics ?? [],
        activeCosmeticSkin: saved.activeCosmeticSkin,
        lastDailyClaimAt: saved.lastDailyClaimAt,
        loginStreak: saved.loginStreak ?? 0,
        streakLastClaimDate: saved.streakLastClaimDate,
        bagBonus: saved.bagBonus ?? 0,
        goldBoostUntil: saved.goldBoostUntil,
        xpBoostUntil: saved.xpBoostUntil,
        rageUntil: saved.rageUntil,
        claimedMilestones: saved.claimedMilestones ?? [],
        claimedAchTiers: saved.claimedAchTiers ?? [],
        activeTitle: saved.activeTitle,
        setBonusAttack: saved.setBonusAttack ?? 0,
        setBonusDefense: saved.setBonusDefense ?? 0,
        setBonusMaxHp: saved.setBonusMaxHp ?? 0,
        ownedPets: saved.ownedPets ?? [],
        ownedMounts: saved.ownedMounts ?? [],
        activeMount: saved.activeMount,
        autoSalvageRarity: saved.autoSalvageRarity ?? "off",
        starterPackClaimed: saved.starterPackClaimed ?? false,
        lastWeeklyClaimAt: saved.lastWeeklyClaimAt ?? 0,
        lastDealDay: saved.lastDealDay ?? 0,
        activePet: saved.activePet,
        petBonusAttack: saved.petBonusAttack ?? 0,
        petBonusDefense: saved.petBonusDefense ?? 0,
        petBonusMaxHp: saved.petBonusMaxHp ?? 0,
        petXp: saved.petXp ?? {},
        battlePassExp: saved.battlePassExp ?? 0,
        battlePassLevel: saved.battlePassLevel ?? 0,
        battlePassPremium: saved.battlePassPremium ?? false,
        battlePassClaimedFree: saved.battlePassClaimedFree ?? [],
        battlePassClaimedPremium: saved.battlePassClaimedPremium ?? [],
        battlePassSeason: saved.battlePassSeason ?? 1,
        titles: saved.titles ?? [],
        friends: saved.friends ?? [],
        vipUntil: saved.vipUntil,
        vipLastDailyDate: saved.vipLastDailyDate
      };
      player.equippedSkills = sanitizeEquippedSkills(saved.equippedSkills, player.learnedSkills);
      // Restore guild membership from the authoritative guild store.
      const guild = guildStore.findByMember(player.accountName);
      if (guild) {
        player.guildId = guild.id;
        player.guildTag = guild.tag;
      }
      this.players.set(socket.id, player);
      this.sockets.set(socket.id, socket);
      this.activeQuests.set(socket.id, []);
      this.initQuestsForPlayer(player);
      const offlineRewards = this.applyOfflineRewards(player, saved.lastSeenAt, Date.now());
      const sessionToken = crypto.randomUUID();
      this.sessions.set(sessionToken, { email: resolvedEmail, accountName: resolvedName });
      socket.emit("session", { token: sessionToken });
      socket.emit("init", { selfId: socket.id, snapshot: this.snapshot(), worldMap: this.worldMapPayload });
      socket.emit("player", player);
      if (offlineRewards) socket.emit("offlineRewards", offlineRewards);
      this.emitQuestList(player);
      socket.emit("shopStock", this.shopStock);
      socket.emit("chatHistory", this.chatMessages);
      this.emitFriendList(player);
      // Push guild roster to the player and refresh online flags for mates.
      if (player.guildId) {
        this.emitGuildUpdate(player.guildId);
        const myGuild = guildStore.get(player.guildId);
        if (myGuild?.motd) socket.emit("system", `📜 [${myGuild.tag}] ${myGuild.motd}`);
      } else socket.emit("guildUpdate", null);
      // Send any in-progress guild raid so the player can join the fight.
      socket.emit("guildRaidUpdate", player.guildId ? this.guildRaidView(player.guildId) : null);
      // Collect any marketplace proceeds that accrued while offline.
      const proceeds = marketStore.collectPending(player.accountName);
      if (proceeds) {
        player.stats.gold += proceeds.gold;
        socket.emit("player", player);
        socket.emit("system", `🏪 Khi bạn offline, ${proceeds.sales.length} món đã bán ngoài chợ — nhận ${proceeds.gold} vàng.`);
        this.markDirty(player);
      }
      socket.emit("marketUpdate", this.marketView(player.accountName));
      socket.emit("titlesUpdate", { earned: earnedTitles(player), active: player.activeTitle });
      // Sprint 201: notify any waiting mail on login.
      const mailCount = mailStore.countFor(player.accountName);
      if (mailCount > 0) socket.emit("system", `📬 Bạn có ${mailCount} thư trong Hòm Thư.`);
      socket.emit("mailList", mailStore.getFor(player.accountName));
      socket.emit("system", `Chào mừng trở lại, ${resolvedName}.`);
      // Notify online friends that this player just came online (Sprint 80).
      for (const other of this.players.values()) {
        if (other.id === player.id) continue;
        if ((other.friends ?? []).includes(player.accountName)) {
          this.sockets.get(other.id)?.emit("system", `🟢 Bạn bè ${player.accountName} vừa online.`);
          this.emitFriendList(other);
        }
      }
    });

    socket.on("input", (input) => {
      if (!this.players.has(socket.id)) return;
      // Anti-cheat: validate input shape so a malicious client can't push
      // arbitrary moveTarget coordinates or impossible booleans.
      if (!input || typeof input !== "object") return;
      const safeInput = {
        seq: Number(input.seq) || 0,
        up: !!input.up,
        down: !!input.down,
        left: !!input.left,
        right: !!input.right,
        sprinting: !!input.sprinting,
        moveTarget: undefined as { x: number; y: number } | undefined
      };
      if (input.moveTarget && typeof input.moveTarget.x === "number" && typeof input.moveTarget.y === "number") {
        // Bound moveTarget to the world rectangle so a tampered client can't
        // teleport-via-moveTarget into negative tile space or off the map.
        const worldW = this.worldMap.width * TILE_SIZE;
        const worldH = this.worldMap.height * TILE_SIZE;
        safeInput.moveTarget = {
          x: Math.max(0, Math.min(worldW, input.moveTarget.x)),
          y: Math.max(0, Math.min(worldH, input.moveTarget.y))
        };
      }
      this.inputs.set(socket.id, safeInput);
    });

    socket.on("setAutoRetarget", ({ enabled }) => {
      if (this.players.has(socket.id)) this.autoRetarget.set(socket.id, enabled);
    });

    socket.on("setAfkZone", ({ zone }) => {
      const player = this.players.get(socket.id);
      if (!player || !isAfkZone(zone)) return;
      if (player.afkZone === zone) {
        socket.emit("player", player);
        return;
      }
      player.afkZone = zone;
      socket.emit("player", player);
      this.markDirty(player);
    });

    socket.on("allocateStat", ({ stat }) => {
      const player = this.players.get(socket.id);
      if (!player || !isAllocatableStat(stat)) return;
      if (player.unspentPoints <= 0) {
        socket.emit("system", "Không còn điểm cộng.");
        socket.emit("player", player);
        return;
      }
      if (stat === "maxHp") {
        player.stats.maxHp += STAT_POINT_GAINS.maxHp;
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + STAT_POINT_GAINS.maxHp);
      } else if (stat === "attack") {
        player.stats.attack += STAT_POINT_GAINS.attack;
      } else {
        player.stats.defense += STAT_POINT_GAINS.defense;
      }
      player.unspentPoints -= 1;
      socket.emit("player", player);
      this.markDirty(player);
    });

    socket.on("acceptQuest", ({ questId }) => {
      const player = this.players.get(socket.id);
      if (!player) {
        socket.emit("system", "Chưa đăng nhập.");
        return;
      }
      const quest = questById(questId);
      if (!quest) {
        socket.emit("system", "Nhiệm vụ không tồn tại.");
        return;
      }
      const active = this.activeQuests.get(socket.id) ?? [];
      if (active.some((entry) => entry.questId === questId)) {
        socket.emit("system", `Đã nhận trước đó: ${quest.title}.`);
        return;
      }
      if (active.length >= MAX_ACTIVE_QUESTS) {
        socket.emit("system", "Đang làm tối đa 3 nhiệm vụ, hoàn tất hoặc bỏ bớt trước.");
        return;
      }
      active.push({ questId, progress: initialQuestProgress(quest, player) });
      this.activeQuests.set(socket.id, active);
      this.updateReachLevelQuests(player);
      this.emitQuestList(player);
      socket.emit("system", `Đã nhận nhiệm vụ: ${quest.title}.`);
    });

    socket.on("claimQuest", async ({ questId }) => {
      const player = this.players.get(socket.id);
      if (!player) {
        socket.emit("system", "Chưa đăng nhập.");
        return;
      }
      this.updateReachLevelQuests(player);
      const active = this.activeQuests.get(socket.id) ?? [];
      const index = active.findIndex((entry) => entry.questId === questId);
      const template = questById(questId);
      if (!template) {
        socket.emit("system", "Nhiệm vụ không tồn tại.");
        this.emitQuestList(player);
        return;
      }
      if (index < 0) {
        socket.emit("system", `Bạn chưa nhận nhiệm vụ: ${template.title}.`);
        this.emitQuestList(player);
        return;
      }
      if (!isQuestComplete(active[index], template)) {
        socket.emit("system", `Chưa hoàn tất: ${template.title}.`);
        this.emitQuestList(player);
        return;
      }
      active.splice(index, 1);
      player.stats.gold += template.rewardGold;
      const leveled = this.grantExpAndStatPoints(player, template.rewardExp);
      this.emitFloating(player.id, player.position, template.rewardExp, "exp", `+${template.rewardExp} exp`);
      this.emitFloating(player.id, player.position, template.rewardGold, "loot", `+${template.rewardGold} gold`);
      if (leveled) this.emitFloating(player.id, player.position, player.stats.level, "level", `Level ${player.stats.level}`);
      if (leveled) this.checkLevelAchievements(player);
      this.updateReachLevelQuests(player);
      this.grantBattlePassExp(player, BATTLE_PASS_EXP_PER_QUEST);
      socket.emit("player", player);
      socket.emit("system", `Hoàn tất nhiệm vụ: ${template.title} (+${template.rewardGold} vàng, +${template.rewardExp} kinh nghiệm).`);
      this.emitQuestList(player);
      this.markDirty(player);
    });

    socket.on("inviteParty", ({ playerId }) => {
      const inviter = this.players.get(socket.id);
      const target = playerId ? this.players.get(playerId) : undefined;
      if (!inviter || !target || target.id === inviter.id) return;
      if (distance(inviter.position, target.position) > PARTY_INVITE_RANGE) {
        socket.emit("system", "Người chơi ở quá xa để mời.");
        return;
      }
      if (this.playerParty.get(target.id)) {
        socket.emit("system", `${target.accountName} đã ở trong một tổ đội.`);
        return;
      }
      let party = this.getParty(inviter.id);
      if (party && party.memberIds.length >= PARTY_MAX_SIZE) {
        socket.emit("system", "Tổ đội đã đầy.");
        return;
      }
      if (!party) {
        party = { id: `party-${Date.now()}-${Math.random().toString(36).slice(2)}`, leaderId: inviter.id, memberIds: [inviter.id] };
        this.parties.set(party.id, party);
        this.playerParty.set(inviter.id, party.id);
        this.unlockAchievement(inviter, "socialite");
        socket.emit("player", inviter);
        this.emitPartyUpdate(party);
      }
      this.pendingInvites.set(target.id, party.id);
      this.sockets.get(target.id)?.emit("partyInvite", { partyId: party.id, fromName: inviter.accountName });
      this.sockets.get(target.id)?.emit("system", `${inviter.accountName} mời bạn vào tổ đội.`);
      socket.emit("system", `Đã mời ${target.accountName} vào tổ đội.`);
    });

    socket.on("acceptParty", ({ partyId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (this.playerParty.get(player.id)) {
        socket.emit("system", "Bạn đã ở trong một tổ đội.");
        return;
      }
      const pending = this.pendingInvites.get(player.id);
      const party = this.parties.get(partyId);
      if (!party || pending !== partyId) {
        socket.emit("system", "Lời mời đã hết hạn.");
        return;
      }
      if (party.memberIds.length >= PARTY_MAX_SIZE) {
        socket.emit("system", "Tổ đội đã đầy.");
        return;
      }
      this.pendingInvites.delete(player.id);
      party.memberIds.push(player.id);
      this.playerParty.set(player.id, party.id);
      this.unlockAchievement(player, "socialite");
      for (const memberId of party.memberIds) {
        this.sockets.get(memberId)?.emit("system", `${player.accountName} đã vào tổ đội.`);
      }
      socket.emit("player", player);
      this.emitPartyUpdate(party);
    });

    socket.on("leaveParty", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!this.playerParty.get(player.id)) return;
      this.removeFromParty(player.id);
      this.sockets.get(player.id)?.emit("partyUpdate", null);
      this.sockets.get(player.id)?.emit("system", "Bạn đã rời tổ đội.");
    });

    socket.on("equipItem", async ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const itemIndex = player.inventory.items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return;
      const item = player.inventory.items[itemIndex];
      if (item.kind !== "equipment") {
        socket.emit("system", "Vật phẩm này không thể trang bị.");
        return;
      }
      player.inventory.items.splice(itemIndex, 1);
      const old = player.inventory.equipped[item.slot];
      if (old) {
        removeItemStats(player, old);
        player.inventory.items.push(old);
      }
      player.inventory.equipped[item.slot] = item;
      addItemStats(player, item);
      this.recomputeSetBonus(player);
      socket.emit("player", player);
      socket.emit("system", `Đã trang bị ${item.name}.`);
      this.markDirty(player);
      if (item.rarity === "rare" || item.rarity === "epic") {
        this.bumpQuestProgress(player, ["equipRarity"], { rarity: item.rarity });
      }
    });

    socket.on("unequipItem", async ({ slot }) => {
      const player = this.players.get(socket.id);
      const item = player?.inventory.equipped[slot];
      if (!player || !item) return;
      delete player.inventory.equipped[slot];
      player.inventory.items.push(item);
      removeItemStats(player, item);
      this.recomputeSetBonus(player);
      socket.emit("player", player);
      socket.emit("system", `Đã tháo ${item.name}.`);
      this.markDirty(player);
    });

    socket.on("targetMonster", ({ monsterId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const target = monsterId ? this.monsters.find((monster) => monster.id === monsterId && !monster.respawnsAt) : undefined;
      player.targetId = target?.id;
      socket.emit("player", player);
    });

    socket.on("targetPlayer", ({ playerId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const target = playerId && playerId !== socket.id ? this.players.get(playerId) : undefined;
      player.targetId = target?.id;
      socket.emit("player", player);
    });

    socket.on("buyShopItem", async ({ shopId }) => {
      const player = this.players.get(socket.id);
      const offer = this.shopStock.find((item) => item.shopId === shopId);
      if (!player || !offer) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Bạn cần về thị trấn để mua đồ.");
        return;
      }
      if (isBagFull(player)) {
        socket.emit("system", BAG_FULL_MESSAGE);
        return;
      }
      if (player.stats.gold < offer.value) {
        socket.emit("system", "Không đủ vàng.");
        return;
      }
      player.stats.gold -= offer.value;
      const item = cloneShopItem(offer);
      player.inventory.items.push(item);
      socket.emit("player", player);
      socket.emit("system", `Đã mua ${offer.name} với ${offer.value} vàng.`);
      this.markDirty(player);
    });

    socket.on("useSkill", ({ skillId }) => {
      const player = this.players.get(socket.id);
      if (!player) {
        socket.emit("system", "Chưa đăng nhập.");
        return;
      }
      this.useSkill(player, skillId, Date.now());
    });

    socket.on("equipSkill", ({ slot, skillId }) => {
      const player = this.players.get(socket.id);
      if (!player) {
        socket.emit("system", "Chưa đăng nhập.");
        return;
      }
      if (!Number.isInteger(slot) || slot < 0 || slot >= SKILL_LOADOUT_SIZE) {
        socket.emit("system", "Ô kỹ năng không hợp lệ.");
        return;
      }
      if (!isSkillId(skillId)) {
        socket.emit("system", "Kỹ năng không tồn tại.");
        return;
      }
      if (!player.learnedSkills.includes(skillId)) {
        socket.emit("system", "Phải học kỹ năng trước khi gắn.");
        return;
      }
      while (player.equippedSkills.length < SKILL_LOADOUT_SIZE) player.equippedSkills.push(null);
      const existingIndex = player.equippedSkills.indexOf(skillId);
      if (existingIndex === slot) return;
      const current = player.equippedSkills[slot];
      player.equippedSkills[slot] = skillId;
      if (existingIndex >= 0 && current) player.equippedSkills[existingIndex] = current;
      else if (existingIndex >= 0) player.equippedSkills[existingIndex] = null;
      this.markDirty(player);
      socket.emit("player", player);
      socket.emit("system", `Đã gắn ${skillLabel(skillId)} vào ô ${slot + 1}.`);
    });

    socket.on("learnSkill", ({ skillId }) => {
      const player = this.players.get(socket.id);
      if (!player) {
        socket.emit("system", "Chưa đăng nhập.");
        return;
      }
      if (!isSkillId(skillId)) {
        socket.emit("system", "Kỹ năng không tồn tại.");
        return;
      }
      if (player.learnedSkills.includes(skillId)) {
        socket.emit("system", "Đã học kỹ năng này rồi.");
        return;
      }
      if (!player.playerClass) {
        socket.emit("system", "Hãy chọn lớp nhân vật trước khi học kỹ năng.");
        return;
      }
      if (!classCanLearnSkill(player.playerClass, skillId)) {
        socket.emit("system", "Kỹ năng này không thuộc lớp của bạn.");
        return;
      }
      const required = SKILL_CATALOG[skillId].requiredLevel;
      if (player.stats.level < required) {
        socket.emit("system", `Cần đạt cấp ${required} để học ${skillLabel(skillId)}.`);
        return;
      }
      player.learnedSkills.push(skillId);
      this.markDirty(player);
      socket.emit("player", player);
      socket.emit("system", `Đã học ${skillLabel(skillId)}.`);
      this.bumpQuestProgress(player, ["learnSkill"]);
    });

    socket.on("saveLoadout", ({ slot }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (typeof slot !== "number" || slot < 0 || slot > 2) {
        socket.emit("system", "Vị trí preset không hợp lệ.");
        return;
      }
      const loadouts = player.skillLoadouts ?? [[], [], []];
      while (loadouts.length < 3) loadouts.push([]);
      loadouts[slot] = [...player.equippedSkills].filter((s): s is SkillId => !!s);
      player.skillLoadouts = loadouts;
      socket.emit("player", player);
      socket.emit("system", `Đã lưu loadout ${slot + 1}.`);
      this.markDirty(player);
    });

    socket.on("buyCosmetic", ({ cosmeticId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const cosmetic = getCosmetic(cosmeticId);
      if (!cosmetic) {
        socket.emit("system", "Vật phẩm cosmetic không tồn tại.");
        return;
      }
      if ((player.cosmetics ?? []).includes(cosmeticId)) {
        socket.emit("system", "Bạn đã sở hữu vật phẩm này.");
        return;
      }
      if (cosmetic.gemPrice === 0) {
        socket.emit("system", "Vật phẩm này chỉ mở qua thành tựu.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < cosmetic.gemPrice) {
        socket.emit("system", `Cần ${cosmetic.gemPrice} Gem (đang có ${gems}).`);
        return;
      }
      player.gems = gems - cosmetic.gemPrice;
      const owned = [...(player.cosmetics ?? []), cosmeticId];
      player.cosmetics = owned;
      this.checkCollectionAchievements(player);
      socket.emit("player", player);
      socket.emit("system", `Đã mua ${cosmetic.name}.`);
      this.markDirty(player);
    });

    socket.on("equipCosmetic", ({ cosmeticId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (cosmeticId === null) {
        player.activeCosmeticSkin = undefined;
        socket.emit("player", player);
        socket.emit("system", "Đã tắt cosmetic.");
        this.markDirty(player);
        return;
      }
      if (!(player.cosmetics ?? []).includes(cosmeticId)) {
        socket.emit("system", "Bạn chưa sở hữu vật phẩm này.");
        return;
      }
      player.activeCosmeticSkin = cosmeticId;
      this.unlockAchievement(player, "fashionista");
      socket.emit("player", player);
      socket.emit("system", "Đã trang bị cosmetic.");
      this.markDirty(player);
    });

    socket.on("addFriend", ({ name }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const cleanName = String(name ?? "").trim().slice(0, 20);
      if (!cleanName || cleanName === player.accountName) return;
      const friends = player.friends ?? [];
      if (friends.includes(cleanName)) {
        socket.emit("system", `${cleanName} đã có trong danh sách bạn.`);
        return;
      }
      friends.push(cleanName);
      player.friends = friends;
      socket.emit("system", `Đã thêm ${cleanName} vào danh sách bạn.`);
      this.emitFriendList(player);
      this.markDirty(player);
    });

    socket.on("removeFriend", ({ name }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const friends = (player.friends ?? []).filter((n) => n !== name);
      player.friends = friends;
      socket.emit("system", `Đã xoá ${name}.`);
      this.emitFriendList(player);
      this.markDirty(player);
    });

    socket.on("privateMessage", ({ to, message }) => {
      const sender = this.players.get(socket.id);
      if (!sender) return;
      const cleanMsg = String(message ?? "").trim().slice(0, 200);
      if (!cleanMsg) return;
      const recipient = [...this.players.values()].find((p) => p.accountName === to);
      if (!recipient) {
        socket.emit("system", `${to} không online.`);
        return;
      }
      this.sockets.get(recipient.id)?.emit("privateMessageReceived", { from: sender.accountName, message: cleanMsg, sentAt: Date.now() });
      socket.emit("privateMessageReceived", { from: `→ ${to}`, message: cleanMsg, sentAt: Date.now() });
    });

    socket.on("buyVip", ({ days }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const pkg = VIP_PACKAGES.find((p) => p.days === days);
      if (!pkg) {
        socket.emit("system", "Gói VIP không hợp lệ.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < pkg.gemPrice) {
        socket.emit("system", `Cần ${pkg.gemPrice} 💎 để mua ${pkg.label} (đang có ${gems}).`);
        return;
      }
      player.gems = gems - pkg.gemPrice;
      const now = Date.now();
      const base = isVipActive(player.vipUntil, now) ? (player.vipUntil ?? now) : now;
      player.vipUntil = base + pkg.days * 24 * 60 * 60 * 1000;
      socket.emit("player", player);
      socket.emit("system", `🌟 Đã kích hoạt ${pkg.label}! VIP hết hạn: ${new Date(player.vipUntil).toLocaleDateString("vi-VN")}.`);
      this.markDirty(player);
    });

    socket.on("claimVipDaily", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isVipActive(player.vipUntil)) {
        socket.emit("system", "Bạn cần là VIP đang còn hạn để nhận thưởng hằng ngày.");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (player.vipLastDailyDate === today) {
        socket.emit("system", "Hôm nay bạn đã nhận thưởng VIP rồi.");
        return;
      }
      player.gems = (player.gems ?? 0) + VIP_DAILY_GEMS;
      player.vipLastDailyDate = today;
      socket.emit("player", player);
      socket.emit("system", `🌟 Nhận thưởng VIP: +${VIP_DAILY_GEMS} 💎.`);
      this.markDirty(player);
    });

    // Dev-only cheat for automated smoke tests. Never enabled in production
    // (requires explicit DEV_CHEATS=1 env; not set in Dockerfile/compose).
    if (process.env.DEV_CHEATS === "1") {
      (socket as Socket).on("devGrant", (payload: { gold?: number; gems?: number; talentPoints?: number; exp?: number }) => {
        const player = this.players.get(socket.id);
        if (!player) return;
        player.stats.gold += Math.max(0, Number(payload?.gold) || 0);
        player.gems = (player.gems ?? 0) + Math.max(0, Number(payload?.gems) || 0);
        if (payload?.talentPoints) player.talentPoints = (player.talentPoints ?? 0) + Math.max(0, Number(payload.talentPoints) || 0);
        if (payload?.exp) this.grantExpAndStatPoints(player, Math.max(0, Number(payload.exp) || 0));
        socket.emit("player", player);
      });
      (socket as Socket).on("devGrantItem", (payload: { name?: string; rarity?: Rarity; value?: number; slot?: EquipmentSlot; themeId?: string; stats?: ItemStats }) => {
        const player = this.players.get(socket.id);
        if (!player) return;
        const item: EquipmentItem = {
          id: `dev-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          name: String(payload?.name ?? "Dev Item").slice(0, 40),
          rarity: (payload?.rarity ?? "common") as Rarity,
          kind: "equipment",
          slot: (payload?.slot ?? "weapon") as EquipmentSlot,
          value: Math.max(1, Number(payload?.value) || 100),
          stats: payload?.stats ?? { attack: 5 },
          themeId: payload?.themeId
        };
        player.inventory.items.push(item);
        socket.emit("player", player);
      });
      (socket as Socket).on("devHappyHour", () => {
        this.startHappyHour();
      });
      (socket as Socket).on("devLootItem", (payload: { rarity?: Rarity; slot?: EquipmentSlot }) => {
        const player = this.players.get(socket.id);
        if (!player) return;
        const item: EquipmentItem = {
          id: `loot-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          name: "Loot Test", rarity: (payload?.rarity ?? "common") as Rarity,
          kind: "equipment", slot: (payload?.slot ?? "weapon") as EquipmentSlot,
          value: 100, stats: { attack: 5 }
        };
        if (!this.tryAutoSalvage(player, item)) player.inventory.items.push(item);
        socket.emit("player", player);
      });
      (socket as Socket).on("devGrantAchievement", (payload: { id?: string }) => {
        const player = this.players.get(socket.id);
        if (!player || !payload?.id) return;
        if (!player.achievements.includes(payload.id)) player.achievements.push(payload.id);
        socket.emit("player", player);
      });
      (socket as Socket).on("devArenaKill", () => {
        const player = this.players.get(socket.id);
        if (!player) return;
        this.creditArenaKill(player);
        socket.emit("player", player);
      });
      (socket as Socket).on("devArenaDeath", () => {
        const player = this.players.get(socket.id);
        if (!player) return;
        player.arenaStreak = 0;
        socket.emit("player", player);
      });
      (socket as Socket).on("devClearQuests", () => {
        const player = this.players.get(socket.id);
        if (!player) return;
        this.activeQuests.set(socket.id, []);
        this.emitQuestList(player);
      });
      (socket as Socket).on("devGrantMaterial", (payload: { count?: number; value?: number; materialId?: MaterialId }) => {
        const player = this.players.get(socket.id);
        if (!player) return;
        const n = Math.max(1, Math.min(40, Number(payload?.count) || 1));
        const mid = (payload?.materialId && MATERIAL_CATALOG[payload.materialId] ? payload.materialId : "slimeCore") as MaterialId;
        const info = MATERIAL_CATALOG[mid];
        for (let i = 0; i < n; i++) {
          player.inventory.items.push({
            id: `devmat-${Date.now()}-${i}-${Math.floor(Math.random() * 1e4)}`,
            kind: "material",
            materialId: mid,
            name: info.name,
            rarity: info.rarity,
            value: Math.max(1, Number(payload?.value) || info.value)
          });
        }
        socket.emit("player", player);
      });
    }

    socket.on("createGuild", ({ name, tag }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (player.guildId) {
        socket.emit("system", "Bạn đã ở trong một guild. Rời guild trước khi lập guild mới.");
        return;
      }
      const cleanName = sanitizeGuildName(name);
      const cleanTag = sanitizeGuildTag(tag);
      if (!cleanName) {
        socket.emit("system", "Tên guild phải dài 3-20 ký tự.");
        return;
      }
      if (!cleanTag) {
        socket.emit("system", "Tag guild phải gồm 2-4 chữ/số (vd: DN, EP1).");
        return;
      }
      if (guildStore.findByNameOrTag(cleanName, cleanTag)) {
        socket.emit("system", "Tên hoặc tag guild đã tồn tại. Chọn tên khác nhé.");
        return;
      }
      if (player.stats.gold < GUILD_CREATE_COST_GOLD) {
        socket.emit("system", `Cần ${GUILD_CREATE_COST_GOLD} vàng để lập guild (đang có ${player.stats.gold}).`);
        return;
      }
      player.stats.gold -= GUILD_CREATE_COST_GOLD;
      const record: GuildRecord = {
        id: `guild-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        name: cleanName,
        tag: cleanTag,
        motd: "Chào mừng đến với guild!",
        createdAt: Date.now(),
        members: [{ accountName: player.accountName, rank: "leader", joinedAt: Date.now(), contribution: 0 }],
        exp: 0,
        level: 1
      };
      guildStore.upsert(record);
      player.guildId = record.id;
      player.guildTag = record.tag;
      this.unlockAchievement(player, "guild-founder");
      socket.emit("player", player);
      this.emitGuildUpdate(record.id);
      this.io.emit("system", `🏰 Guild [${record.tag}] ${record.name} vừa được thành lập bởi ${player.accountName}!`);
      this.markDirty(player);
    });

    socket.on("guildInvitePlayer", ({ name }) => {
      const inviter = this.players.get(socket.id);
      if (!inviter || !inviter.guildId) return;
      const guild = guildStore.get(inviter.guildId);
      if (!guild) return;
      const inviterRank = guild.members.find((m) => m.accountName === inviter.accountName)?.rank;
      if (!canManageGuild(inviterRank)) {
        socket.emit("system", "Chỉ Hội Trưởng hoặc Sĩ Quan mới được mời thành viên.");
        return;
      }
      const inviteCap = guildMaxMembers(guildLevelForExp(guild.exp ?? 0));
      if (guild.members.length >= inviteCap) {
        socket.emit("system", `Guild đã đầy (${inviteCap} thành viên). Lên cấp guild để mở thêm chỗ.`);
        return;
      }
      const cleanName = String(name ?? "").trim().slice(0, 20);
      const target = [...this.players.values()].find((p) => p.accountName === cleanName);
      if (!target) {
        socket.emit("system", `${cleanName} không online.`);
        return;
      }
      if (target.guildId) {
        socket.emit("system", `${cleanName} đã ở trong một guild khác.`);
        return;
      }
      this.guildInvites.set(target.accountName, { guildId: guild.id, expiresAt: Date.now() + GUILD_INVITE_TTL_MS });
      this.sockets.get(target.id)?.emit("guildInvite", {
        guildId: guild.id,
        guildName: guild.name,
        tag: guild.tag,
        from: inviter.accountName
      });
      socket.emit("system", `Đã gửi lời mời guild tới ${cleanName}.`);
    });

    socket.on("acceptGuildInvite", ({ guildId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (player.guildId) {
        socket.emit("system", "Bạn đã ở trong một guild.");
        return;
      }
      const invite = this.guildInvites.get(player.accountName);
      if (!invite || invite.guildId !== guildId || invite.expiresAt < Date.now()) {
        socket.emit("system", "Lời mời guild không còn hiệu lực.");
        return;
      }
      const guild = guildStore.get(guildId);
      if (!guild) {
        socket.emit("system", "Guild không còn tồn tại.");
        return;
      }
      if (guild.members.length >= guildMaxMembers(guildLevelForExp(guild.exp ?? 0))) {
        socket.emit("system", "Guild đã đầy.");
        return;
      }
      this.guildInvites.delete(player.accountName);
      guild.members.push({ accountName: player.accountName, rank: "member", joinedAt: Date.now() });
      guildStore.markDirty();
      player.guildId = guild.id;
      player.guildTag = guild.tag;
      socket.emit("player", player);
      this.emitGuildUpdate(guild.id);
      this.broadcastGuildSystem(guild, `${player.accountName} đã gia nhập guild! 🎉`);
      this.markDirty(player);
    });

    socket.on("leaveGuild", () => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      this.removeFromGuild(player.accountName, player.guildId, "leave");
    });

    socket.on("disbandGuild", () => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const rank = guild.members.find((m) => m.accountName === player.accountName)?.rank;
      if (rank !== "leader") {
        socket.emit("system", "Chỉ Hội Trưởng mới được giải tán guild.");
        return;
      }
      const guildId = guild.id;
      const tag = guild.tag;
      const name = guild.name;
      const memberNames = guild.members.map((m) => m.accountName);
      // Clear runtime guild state for every online member.
      for (const p of this.players.values()) {
        if (p.guildId === guildId) {
          p.guildId = undefined;
          p.guildTag = undefined;
          const sock = this.sockets.get(p.id);
          sock?.emit("player", p);
          sock?.emit("guildUpdate", null);
          sock?.emit("guildRaidUpdate", null);
          sock?.emit("system", `🏰 Guild [${tag}] ${name} đã bị Hội Trưởng giải tán.`);
          this.markDirty(p);
        }
      }
      // Tear down any active raid + cooldown for the guild, then remove it.
      this.guildRaids.delete(guildId);
      this.guildRaidCooldownUntil.delete(guildId);
      guildStore.remove(guildId);
      this.io.emit("system", `🏰 Guild [${tag}] ${name} (${memberNames.length} thành viên) đã giải tán.`);
      this.broadcastGuildLeaderboard();
    });

    socket.on("kickGuildMember", ({ accountName }) => {
      const actor = this.players.get(socket.id);
      if (!actor || !actor.guildId) return;
      const guild = guildStore.get(actor.guildId);
      if (!guild) return;
      const actorRank = guild.members.find((m) => m.accountName === actor.accountName)?.rank;
      const targetMember = guild.members.find((m) => m.accountName === accountName);
      if (!targetMember || targetMember.accountName === actor.accountName) return;
      // Officers can only kick plain members; the leader can kick anyone.
      const allowed =
        actorRank === "leader" ||
        (actorRank === "officer" && targetMember.rank === "member");
      if (!allowed) {
        socket.emit("system", "Bạn không có quyền trục xuất thành viên này.");
        return;
      }
      this.removeFromGuild(accountName, guild.id, "kick", actor.accountName);
    });

    socket.on("promoteGuildMember", ({ accountName }) => {
      const actor = this.players.get(socket.id);
      if (!actor || !actor.guildId) return;
      const guild = guildStore.get(actor.guildId);
      if (!guild) return;
      const actorRank = guild.members.find((m) => m.accountName === actor.accountName)?.rank;
      if (actorRank !== "leader") {
        socket.emit("system", "Chỉ Hội Trưởng mới được thăng/giáng chức.");
        return;
      }
      const member = guild.members.find((m) => m.accountName === accountName);
      if (!member || member.rank === "leader") return;
      member.rank = member.rank === "member" ? "officer" : "member";
      guildStore.markDirty();
      this.emitGuildUpdate(guild.id);
      this.broadcastGuildSystem(
        guild,
        member.rank === "officer"
          ? `${accountName} được thăng chức Sĩ Quan ⭐`
          : `${accountName} bị giáng xuống Thành Viên.`
      );
    });

    socket.on("setGuildMotd", ({ motd }) => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const rank = guild.members.find((m) => m.accountName === player.accountName)?.rank;
      if (!canManageGuild(rank)) {
        socket.emit("system", "Chỉ Hội Trưởng hoặc Sĩ Quan mới được đổi thông báo guild.");
        return;
      }
      guild.motd = String(motd ?? "").trim().slice(0, GUILD_MOTD_MAX);
      guildStore.markDirty();
      this.emitGuildUpdate(guild.id);
    });

    socket.on("setGuildDescription", ({ desc }) => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const rank = guild.members.find((m) => m.accountName === player.accountName)?.rank;
      if (!canManageGuild(rank)) {
        socket.emit("system", "Chỉ Hội Trưởng hoặc Sĩ Quan mới được sửa mô tả tuyển quân.");
        return;
      }
      guild.desc = String(desc ?? "").trim().slice(0, GUILD_DESC_MAX);
      guildStore.markDirty();
      socket.emit("system", "Đã cập nhật mô tả tuyển quân guild.");
      this.broadcastGuildLeaderboard();
    });

    socket.on("guildChat", ({ message }) => {
      const sender = this.players.get(socket.id);
      if (!sender || !sender.guildId) {
        socket.emit("system", "Bạn chưa ở trong guild nào. Gõ U để mở bảng guild.");
        return;
      }
      const guild = guildStore.get(sender.guildId);
      if (!guild) return;
      const cleanMsg = String(message ?? "").trim().slice(0, 200);
      if (!cleanMsg) return;
      const payload = { from: sender.accountName, tag: guild.tag, message: cleanMsg, sentAt: Date.now() };
      for (const p of this.players.values()) {
        if (p.guildId === guild.id) this.sockets.get(p.id)?.emit("guildChatMessage", payload);
      }
    });

    socket.on("donateGuild", ({ amount }) => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) {
        socket.emit("system", "Bạn chưa ở trong guild nào.");
        return;
      }
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const gold = Math.floor(Number(amount) || 0);
      if (gold < GUILD_DONATE_MIN) {
        socket.emit("system", `Góp tối thiểu ${GUILD_DONATE_MIN} vàng.`);
        return;
      }
      if (player.stats.gold < gold) {
        socket.emit("system", `Không đủ vàng (đang có ${player.stats.gold}).`);
        return;
      }
      if (guildLevelForExp(guild.exp ?? 0) >= GUILD_MAX_LEVEL) {
        socket.emit("system", "Guild đã đạt cấp tối đa — không cần góp thêm.");
        return;
      }
      player.stats.gold -= gold;
      const member = guild.members.find((m) => m.accountName === player.accountName);
      if (member) member.contribution = (member.contribution ?? 0) + gold;
      socket.emit("player", player);
      socket.emit("system", `Đã góp ${gold} vàng cho guild (+${gold * GUILD_GOLD_PER_EXP} EXP guild).`);
      this.markDirty(player);
      this.addGuildExp(guild, gold * GUILD_GOLD_PER_EXP);
    });

    socket.on("depositGuildBank", ({ amount }) => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const gold = Math.floor(Number(amount) || 0);
      if (gold < GUILD_BANK_MIN_TXN) {
        socket.emit("system", `Gửi tối thiểu ${GUILD_BANK_MIN_TXN} vàng vào quỹ.`);
        return;
      }
      if (player.stats.gold < gold) {
        socket.emit("system", `Không đủ vàng (đang có ${player.stats.gold}).`);
        return;
      }
      player.stats.gold -= gold;
      guild.bank = (guild.bank ?? 0) + gold;
      guildStore.markDirty();
      socket.emit("player", player);
      this.unlockAchievement(player, "philanthropist");
      this.markDirty(player);
      this.broadcastGuildSystem(guild, `${player.accountName} gửi ${gold.toLocaleString("vi-VN")} vàng vào quỹ (tổng: ${guild.bank.toLocaleString("vi-VN")}).`);
      this.emitGuildUpdate(guild.id);
    });

    socket.on("withdrawGuildBank", ({ amount }) => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const rank = guild.members.find((m) => m.accountName === player.accountName)?.rank;
      if (rank !== "leader") {
        socket.emit("system", "Chỉ Hội Trưởng mới được rút quỹ guild.");
        return;
      }
      const gold = Math.floor(Number(amount) || 0);
      if (gold < GUILD_BANK_MIN_TXN) {
        socket.emit("system", `Rút tối thiểu ${GUILD_BANK_MIN_TXN} vàng.`);
        return;
      }
      if ((guild.bank ?? 0) < gold) {
        socket.emit("system", `Quỹ không đủ (đang có ${(guild.bank ?? 0).toLocaleString("vi-VN")}).`);
        return;
      }
      guild.bank = (guild.bank ?? 0) - gold;
      player.stats.gold += gold;
      guildStore.markDirty();
      socket.emit("player", player);
      this.markDirty(player);
      this.broadcastGuildSystem(guild, `${player.accountName} rút ${gold.toLocaleString("vi-VN")} vàng từ quỹ (còn: ${guild.bank.toLocaleString("vi-VN")}).`);
      this.emitGuildUpdate(guild.id);
    });

    socket.on("buyGuildBoost", () => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const rank = guild.members.find((m) => m.accountName === player.accountName)?.rank;
      if (!canManageGuild(rank)) {
        socket.emit("system", "Chỉ Hội Trưởng hoặc Sĩ Quan mới được mua Guild Boost.");
        return;
      }
      if (isGuildBoostActive(guild.boostUntil)) {
        socket.emit("system", "Guild Boost đang còn hiệu lực.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < GUILD_BOOST_GEM_COST) {
        socket.emit("system", `Cần ${GUILD_BOOST_GEM_COST} 💎 để mua Guild Boost (đang có ${gems}).`);
        return;
      }
      player.gems = gems - GUILD_BOOST_GEM_COST;
      guild.boostUntil = Date.now() + GUILD_BOOST_DURATION_MS;
      guildStore.markDirty();
      socket.emit("player", player);
      this.markDirty(player);
      this.broadcastGuildSystem(guild, `${player.accountName} kích hoạt Guild Boost ⚡ +${Math.round(GUILD_BOOST_EXP_BONUS * 100)}% EXP trong 48h!`);
      this.emitGuildUpdate(guild.id);
    });

    socket.on("requestMarket", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      socket.emit("marketUpdate", this.marketView(player.accountName));
    });

    socket.on("inspectPlayer", ({ name }) => {
      const requester = this.players.get(socket.id);
      if (!requester) return;
      const cleanName = String(name ?? "").trim().slice(0, 20);
      const target = [...this.players.values()].find((p) => p.accountName === cleanName);
      if (!target) {
        socket.emit("playerProfile", null);
        socket.emit("system", `${cleanName || "Người chơi"} không online.`);
        return;
      }
      const guild = target.guildId ? guildStore.get(target.guildId) : undefined;
      const pet = getPet(target.activePet);
      const profile: PlayerProfile = {
        accountName: target.accountName,
        level: target.stats.level,
        playerClass: target.playerClass,
        title: titleLabel(target.activeTitle),
        guildTag: target.guildTag,
        guildName: guild?.name,
        petName: pet ? petLabel(pet.id) : undefined,
        petLevel: pet ? petLevelForXp((target.petXp ?? {})[pet.id] ?? 0) : undefined,
        pvpKills: target.pvpKills ?? 0,
        totalKills: target.totalKills ?? 0,
        vip: isVipActive(target.vipUntil)
      };
      socket.emit("playerProfile", profile);
    });

    socket.on("requestGuildLeaderboard", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      socket.emit("guildLeaderboard", this.guildLeaderboard(player.guildId));
    });

    socket.on("summonGuildRaid", () => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) {
        socket.emit("system", "Bạn cần ở trong guild để triệu hồi Boss.");
        return;
      }
      const guild = guildStore.get(player.guildId);
      if (!guild) return;
      const rank = guild.members.find((m) => m.accountName === player.accountName)?.rank;
      if (!canManageGuild(rank)) {
        socket.emit("system", "Chỉ Hội Trưởng hoặc Sĩ Quan mới được triệu hồi Boss.");
        return;
      }
      if (this.guildRaids.has(guild.id)) {
        socket.emit("system", "Boss của guild đang xuất hiện rồi.");
        return;
      }
      const now = Date.now();
      const cd = this.guildRaidCooldownUntil.get(guild.id) ?? 0;
      if (now < cd) {
        socket.emit("system", `Cần chờ ${Math.ceil((cd - now) / 60000)} phút nữa mới triệu hồi Boss tiếp.`);
        return;
      }
      const level = guildLevelForExp(guild.exp ?? 0);
      const summonCost = guildRaidSummonCost(level);
      if ((guild.bank ?? 0) < summonCost) {
        socket.emit("system", `Cần ${summonCost.toLocaleString("vi-VN")} vàng trong Quỹ Guild để triệu hồi Boss (quỹ đang có ${(guild.bank ?? 0).toLocaleString("vi-VN")}).`);
        return;
      }
      guild.bank = (guild.bank ?? 0) - summonCost;
      guildStore.markDirty();
      const maxHp = guildRaidMaxHp(level);
      this.guildRaids.set(guild.id, {
        bossName: "Hỗn Độn Ma Vương",
        maxHp,
        hp: maxHp,
        startedAt: now,
        expiresAt: now + GUILD_RAID_DURATION_MS,
        contributors: new Map()
      });
      this.broadcastGuildSystem(guild, `⚔️ ${player.accountName} đã triệu hồi Boss Hỗn Độn Ma Vương (${maxHp.toLocaleString("vi-VN")} HP, tốn ${summonCost.toLocaleString("vi-VN")} vàng quỹ)! Mở bảng Guild (U) để cùng đánh.`);
      this.broadcastGuildRaid(guild.id);
      this.emitGuildUpdate(guild.id);
    });

    socket.on("raidAttack", () => {
      const player = this.players.get(socket.id);
      if (!player || !player.guildId) return;
      const raid = this.guildRaids.get(player.guildId);
      if (!raid || raid.hp <= 0) return;
      const now = Date.now();
      const last = this.raidAttackCooldown.get(socket.id) ?? 0;
      if (now - last < GUILD_RAID_ATTACK_COOLDOWN_MS) return;
      this.raidAttackCooldown.set(socket.id, now);
      // Damage = effective attack with ±15% variance.
      const dmg = Math.max(1, Math.round(player.stats.attack * (0.85 + Math.random() * 0.3)));
      raid.hp = Math.max(0, raid.hp - dmg);
      raid.contributors.set(player.accountName, (raid.contributors.get(player.accountName) ?? 0) + dmg);
      if (raid.hp <= 0) {
        this.resolveGuildRaid(player.guildId, raid);
      } else {
        this.broadcastGuildRaid(player.guildId);
      }
    });

    socket.on("listMarketItem", ({ itemId, price }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const cleanPrice = sanitizeMarketPrice(price);
      if (cleanPrice === undefined) {
        socket.emit("system", "Giá không hợp lệ.");
        return;
      }
      if (marketStore.countBySeller(player.accountName) >= MARKET_MAX_LISTINGS_PER_SELLER) {
        socket.emit("system", `Bạn chỉ được rao tối đa ${MARKET_MAX_LISTINGS_PER_SELLER} món cùng lúc.`);
        return;
      }
      const itemIndex = player.inventory.items.findIndex((it) => it.id === itemId);
      if (itemIndex < 0) {
        socket.emit("system", "Không tìm thấy vật phẩm trong túi.");
        return;
      }
      // Escrow: pull the item out of the bag and onto the listing.
      const [item] = player.inventory.items.splice(itemIndex, 1);
      const listing: MarketListing = {
        id: `mkt-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
        sellerName: player.accountName,
        item,
        price: cleanPrice,
        listedAt: Date.now()
      };
      marketStore.add(listing);
      socket.emit("player", player);
      socket.emit("system", `Đã rao ${item.name} giá ${cleanPrice} vàng (phí bán ${Math.round(0.05 * 100)}% khi giao dịch).`);
      this.markDirty(player);
      this.broadcastMarket();
    });

    socket.on("cancelMarketListing", ({ listingId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const listing = marketStore.get(listingId);
      if (!listing || listing.sellerName !== player.accountName) {
        socket.emit("system", "Không tìm thấy tin rao của bạn.");
        return;
      }
      if (isBagFull(player)) {
        socket.emit("system", "Túi đồ đầy — không thể nhận lại vật phẩm.");
        return;
      }
      marketStore.remove(listingId);
      player.inventory.items.push(listing.item);
      socket.emit("player", player);
      socket.emit("system", `Đã gỡ tin rao và nhận lại ${listing.item.name}.`);
      this.markDirty(player);
      this.broadcastMarket();
    });

    socket.on("featureMarketListing", ({ listingId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const listing = marketStore.get(listingId);
      if (!listing || listing.sellerName !== player.accountName) {
        socket.emit("system", "Không tìm thấy tin rao của bạn.");
        return;
      }
      if (isMarketFeatured(listing.featuredUntil)) {
        socket.emit("system", "Tin này đang được làm nổi bật rồi.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < MARKET_FEATURE_GEM_COST) {
        socket.emit("system", `Cần ${MARKET_FEATURE_GEM_COST} 💎 để làm nổi bật tin (đang có ${gems}).`);
        return;
      }
      player.gems = gems - MARKET_FEATURE_GEM_COST;
      listing.featuredUntil = Date.now() + MARKET_FEATURE_DURATION_MS;
      marketStore.markDirty();
      socket.emit("player", player);
      socket.emit("system", `✨ Đã ghim ${listing.item.name} lên đầu chợ trong 48h.`);
      this.markDirty(player);
      this.broadcastMarket();
    });

    socket.on("buyMarketItem", ({ listingId }) => {
      const buyer = this.players.get(socket.id);
      if (!buyer) return;
      const listing = marketStore.get(listingId);
      if (!listing) {
        socket.emit("system", "Tin rao không còn tồn tại.");
        this.broadcastMarket();
        return;
      }
      if (listing.sellerName === buyer.accountName) {
        socket.emit("system", "Không thể mua món bạn đang rao. Hãy gỡ tin nếu muốn lấy lại.");
        return;
      }
      if (buyer.stats.gold < listing.price) {
        socket.emit("system", `Không đủ vàng (cần ${listing.price}, đang có ${buyer.stats.gold}).`);
        return;
      }
      if (isBagFull(buyer)) {
        socket.emit("system", BAG_FULL_MESSAGE);
        return;
      }
      // Atomic transfer: remove listing first so two buyers can't race it.
      marketStore.remove(listing.id);
      buyer.stats.gold -= listing.price;
      buyer.inventory.items.push(listing.item);
      socket.emit("player", buyer);
      socket.emit("system", `Đã mua ${listing.item.name} với giá ${listing.price} vàng.`);
      this.unlockAchievement(buyer, "big-spender");
      this.markDirty(buyer);

      // Pay the seller their proceeds (price minus burned tax).
      const net = marketNet(listing.price);
      const seller = [...this.players.values()].find((p) => p.accountName === listing.sellerName);
      if (seller) {
        seller.stats.gold += net;
        this.sockets.get(seller.id)?.emit("player", seller);
        this.sockets.get(seller.id)?.emit("system", `💰 ${buyer.accountName} đã mua ${listing.item.name} — bạn nhận ${net} vàng (đã trừ ${marketTax(listing.price)} phí).`);
        this.unlockAchievement(seller, "merchant");
        this.markDirty(seller);
      } else {
        marketStore.addPending(listing.sellerName, net, listing.item.name, Date.now());
      }
      this.broadcastMarket();
    });

    socket.on("buyBattlePassPremium", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (player.battlePassPremium) {
        socket.emit("system", "Bạn đã sở hữu Battle Pass Premium mùa này.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < BATTLE_PASS_PREMIUM_PRICE) {
        socket.emit("system", `Cần ${BATTLE_PASS_PREMIUM_PRICE} 💎 để mở Premium (đang có ${gems}).`);
        return;
      }
      player.gems = gems - BATTLE_PASS_PREMIUM_PRICE;
      player.battlePassPremium = true;
      socket.emit("player", player);
      socket.emit("system", "🎉 Đã kích hoạt Battle Pass Premium!");
      this.markDirty(player);
    });

    socket.on("claimBattlePassTier", ({ tier, track }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const tierDef = BATTLE_PASS_TIERS.find((t) => t.level === tier);
      if (!tierDef) return;
      const currentLevel = player.battlePassLevel ?? 0;
      if (tier > currentLevel) {
        socket.emit("system", `Chưa đạt cấp ${tier}.`);
        return;
      }
      if (track === "premium" && !player.battlePassPremium) {
        socket.emit("system", "Cần mua Premium để nhận phần thưởng này.");
        return;
      }
      const claimedList = track === "free" ? (player.battlePassClaimedFree ??= []) : (player.battlePassClaimedPremium ??= []);
      if (claimedList.includes(tier)) {
        socket.emit("system", "Đã nhận phần thưởng này.");
        return;
      }
      const reward = track === "free" ? tierDef.freeReward : tierDef.premiumReward;
      // Grant the reward.
      switch (reward.kind) {
        case "gold":
          player.stats.gold += reward.amount;
          break;
        case "gem":
          player.gems = (player.gems ?? 0) + reward.amount;
          break;
        case "scroll": {
          if (isBagFull(player)) { socket.emit("system", BAG_FULL_MESSAGE); return; }
          for (let i = 0; i < reward.amount; i += 1) {
            const scroll: Item = {
              id: `scroll-bp-${Date.now()}-${i}`,
              kind: "consumable",
              name: "Cuộn Hồi Thành",
              rarity: "rare",
              heal: 0,
              recall: true,
              value: 80
            };
            player.inventory.items.push(scroll);
            if (isBagFull(player)) break;
          }
          break;
        }
        case "material": {
          if (!reward.materialId) break;
          const info = MATERIAL_CATALOG[reward.materialId];
          for (let i = 0; i < reward.amount; i += 1) {
            if (isBagFull(player)) break;
            const item: MaterialItem = {
              id: `mat-bp-${Date.now()}-${i}`,
              kind: "material",
              materialId: reward.materialId,
              name: info.name,
              rarity: info.rarity,
              value: info.value
            };
            player.inventory.items.push(item);
          }
          break;
        }
        case "title":
          if (reward.title) {
            (player.titles ??= []).push(reward.title);
          }
          break;
      }
      claimedList.push(tier);
      socket.emit("player", player);
      socket.emit("system", `Đã nhận phần thưởng ${track === "premium" ? "Premium" : "Free"} cấp ${tier}.`);
      this.markDirty(player);
    });

    socket.on("claimDailyReward", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const now = Date.now();
      const last = player.lastDailyClaimAt ?? 0;
      if (now - last < DAILY_CLAIM_INTERVAL_MS) {
        const remainingHours = ((DAILY_CLAIM_INTERVAL_MS - (now - last)) / 3600000).toFixed(1);
        socket.emit("system", `Cần chờ ${remainingHours} giờ nữa mới nhận được thưởng hằng ngày.`);
        return;
      }
      player.gems = (player.gems ?? 0) + DAILY_GEM_REWARD;
      player.lastDailyClaimAt = now;
      socket.emit("player", player);
      socket.emit("system", `Nhận thưởng hằng ngày: +${DAILY_GEM_REWARD} Gem.`);
      this.markDirty(player);
    });

    socket.on("claimLoginStreak", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const today = dateKey();
      const result = computeStreakClaim(player.streakLastClaimDate, today, player.loginStreak ?? 0);
      if (!result.canClaim || !result.reward) {
        socket.emit("system", "Hôm nay bạn đã điểm danh rồi — quay lại ngày mai nhé.");
        return;
      }
      player.loginStreak = result.newStreak;
      player.streakLastClaimDate = today;
      player.stats.gold += result.reward.gold;
      player.gems = (player.gems ?? 0) + result.reward.gems;
      socket.emit("player", player);
      socket.emit(
        "system",
        `📅 Điểm danh ngày ${((result.newStreak - 1) % 7) + 1} (chuỗi ${result.newStreak}): nhận ${result.reward.label}.`
      );
      if (result.reward.gold > 0) this.emitFloating(player.id, player.position, result.reward.gold, "loot", `+${result.reward.gold} gold`);
      if (result.newStreak >= 7) this.unlockAchievement(player, "devout");
      this.markDirty(player);
    });

    socket.on("requestTitles", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      socket.emit("titlesUpdate", { earned: earnedTitles(player), active: player.activeTitle });
    });

    socket.on("setActiveTitle", ({ titleId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (titleId === null) {
        player.activeTitle = undefined;
        socket.emit("player", player);
        socket.emit("titlesUpdate", { earned: earnedTitles(player), active: undefined });
        this.markDirty(player);
        return;
      }
      if (!isTitleEarned(titleId, player)) {
        socket.emit("system", "Bạn chưa mở khoá danh hiệu này.");
        return;
      }
      player.activeTitle = titleId;
      this.unlockAchievement(player, "titled");
      socket.emit("player", player);
      socket.emit("titlesUpdate", { earned: earnedTitles(player), active: player.activeTitle });
      socket.emit("system", `Đã gắn danh hiệu «${titleLabel(titleId)}».`);
      this.markDirty(player);
    });

    socket.on("buyPet", ({ petId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const pet = getPet(petId);
      if (!pet) {
        socket.emit("system", "Linh thú không tồn tại.");
        return;
      }
      if ((player.ownedPets ?? []).includes(pet.id)) {
        socket.emit("system", "Bạn đã sở hữu linh thú này.");
        return;
      }
      if (pet.gemPrice > 0) {
        const gems = player.gems ?? 0;
        if (gems < pet.gemPrice) {
          socket.emit("system", `Cần ${pet.gemPrice} 💎 để mua ${pet.name} (đang có ${gems}).`);
          return;
        }
        player.gems = gems - pet.gemPrice;
      } else {
        if (player.stats.gold < pet.goldPrice) {
          socket.emit("system", `Cần ${pet.goldPrice} vàng để mua ${pet.name} (đang có ${player.stats.gold}).`);
          return;
        }
        player.stats.gold -= pet.goldPrice;
      }
      player.ownedPets = [...(player.ownedPets ?? []), pet.id];
      this.checkCollectionAchievements(player);
      this.unlockAchievement(player, "beast-tamer");
      socket.emit("player", player);
      socket.emit("system", `🐾 Đã thu phục ${pet.name}! Mở bảng Linh Thú (P) để trang bị.`);
      this.markDirty(player);
    });

    socket.on("equipPet", ({ petId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (petId === null) {
        player.activePet = undefined;
        this.recomputePetBonus(player);
        socket.emit("player", player);
        socket.emit("system", "Đã thu hồi linh thú.");
        this.markDirty(player);
        return;
      }
      if (!(player.ownedPets ?? []).includes(petId) || !getPet(petId)) {
        socket.emit("system", "Bạn chưa sở hữu linh thú này.");
        return;
      }
      player.activePet = petId;
      this.recomputePetBonus(player);
      socket.emit("player", player);
      socket.emit("system", `🐾 Đã trang bị ${getPet(petId)!.name}.`);
      this.markDirty(player);
    });

    socket.on("feedPet", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (player.stats.gold < PET_FEED_GOLD_COST) {
        socket.emit("system", `Cần ${PET_FEED_GOLD_COST} vàng để cho linh thú ăn.`);
        return;
      }
      if (!this.grantPetXp(player, PET_FEED_XP)) return;
      player.stats.gold -= PET_FEED_GOLD_COST;
      socket.emit("player", player);
      this.markDirty(player);
    });

    socket.on("petTreat", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const gems = player.gems ?? 0;
      if (gems < PET_TREAT_GEM_COST) {
        socket.emit("system", `Cần ${PET_TREAT_GEM_COST} 💎 để mua bánh thưởng linh thú.`);
        return;
      }
      if (!this.grantPetXp(player, PET_TREAT_XP)) return;
      player.gems = gems - PET_TREAT_GEM_COST;
      socket.emit("player", player);
      this.markDirty(player);
    });

    // Sprint 184: sacrifice an owned (non-active) pet to feed XP to the active.
    socket.on("sacrificePet", ({ petId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!player.activePet) {
        socket.emit("system", "Hãy trang bị linh thú để nhận XP trước khi hiến tế.");
        return;
      }
      if (petId === player.activePet) {
        socket.emit("system", "Không thể hiến tế linh thú đang dùng.");
        return;
      }
      const owned = player.ownedPets ?? [];
      if (!owned.includes(petId)) {
        socket.emit("system", "Bạn không sở hữu linh thú này.");
        return;
      }
      const sac = getPet(petId);
      const xpGain = 300 + (player.petXp?.[petId] ?? 0);
      player.ownedPets = owned.filter((id) => id !== petId);
      if (player.petXp) delete player.petXp[petId];
      this.grantPetXp(player, xpGain);
      socket.emit("player", player);
      socket.emit("system", `🔥 Đã hiến tế ${sac?.name ?? "linh thú"} → +${xpGain} XP cho linh thú đang dùng.`);
      this.markDirty(player);
    });

    // Sprint 186: socket a stat gem into an equipment item (Gem cost).
    socket.on("socketGem", ({ itemId, gemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const item = player.inventory.items.find((it) => it.id === itemId);
      if (!item || item.kind !== "equipment") {
        socket.emit("system", "Chỉ khảm được trang bị.");
        return;
      }
      if (item.socketGem) {
        socket.emit("system", "Trang bị đã có đá quý — gỡ ra trước khi khảm mới.");
        return;
      }
      const gem = getStatGem(gemId);
      if (!gem) { socket.emit("system", "Đá quý không tồn tại."); return; }
      const gems = player.gems ?? 0;
      if (gems < gem.gemPrice) {
        socket.emit("system", `Cần ${gem.gemPrice} 💎 để khảm ${gem.name} (đang có ${gems}).`);
        return;
      }
      player.gems = gems - gem.gemPrice;
      const equipped = player.inventory.equipped[item.slot];
      const isEquipped = equipped?.id === item.id;
      if (isEquipped && equipped) removeItemStats(player, equipped);
      const s = item.stats;
      if (gem.stats.attack) s.attack = (s.attack ?? 0) + gem.stats.attack;
      if (gem.stats.defense) s.defense = (s.defense ?? 0) + gem.stats.defense;
      if (gem.stats.maxHp) s.maxHp = (s.maxHp ?? 0) + gem.stats.maxHp;
      item.socketGem = { gemId: gem.id, name: gem.name, stats: { ...gem.stats } };
      if (isEquipped) addItemStats(player, item);
      this.unlockAchievement(player, "jeweler");
      this.bumpQuestProgress(player, ["socketGem"]);
      socket.emit("player", player);
      socket.emit("system", `💠 Đã khảm ${gem.name} vào ${item.name}.`);
      this.markDirty(player);
    });

    // Sprint 186: remove the socketed gem (destroyed) and subtract its stats.
    socket.on("unsocketGem", ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const item = player.inventory.items.find((it) => it.id === itemId);
      if (!item || item.kind !== "equipment" || !item.socketGem) {
        socket.emit("system", "Trang bị này chưa khảm đá quý.");
        return;
      }
      const equipped = player.inventory.equipped[item.slot];
      const isEquipped = equipped?.id === item.id;
      if (isEquipped && equipped) removeItemStats(player, equipped);
      const g = item.socketGem.stats;
      const s = item.stats;
      if (g.attack && s.attack) s.attack = Math.max(0, s.attack - g.attack);
      if (g.defense && s.defense) s.defense = Math.max(0, s.defense - g.defense);
      if (g.maxHp && s.maxHp) s.maxHp = Math.max(0, s.maxHp - g.maxHp);
      const gemName = item.socketGem.name;
      delete item.socketGem;
      if (isEquipped) addItemStats(player, item);
      socket.emit("player", player);
      socket.emit("system", `Đã gỡ ${gemName} (đá quý bị tiêu hao).`);
      this.markDirty(player);
    });

    socket.on("buyGoldBoost", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (isGoldBoostActive(player.goldBoostUntil)) {
        socket.emit("system", "Bình Tăng Vàng đang còn hiệu lực.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < GOLD_BOOST_GEM_COST) {
        socket.emit("system", `Cần ${GOLD_BOOST_GEM_COST} 💎 để mua Bình Tăng Vàng (đang có ${gems}).`);
        return;
      }
      player.gems = gems - GOLD_BOOST_GEM_COST;
      player.goldBoostUntil = Date.now() + GOLD_BOOST_DURATION_MS;
      socket.emit("player", player);
      socket.emit("system", `🪙 Bình Tăng Vàng kích hoạt: +${Math.round((GOLD_BOOST_MULTIPLIER - 1) * 100)}% vàng trong 30 phút!`);
      this.markDirty(player);
    });

    // Sprint 153: premium XP boost potion — +50% EXP for 30 minutes.
    socket.on("buyXpBoost", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (isXpBoostActive(player.xpBoostUntil)) {
        socket.emit("system", "Bình Tăng XP đang còn hiệu lực.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < XP_BOOST_GEM_COST) {
        socket.emit("system", `Cần ${XP_BOOST_GEM_COST} 💎 để mua Bình Tăng XP (đang có ${gems}).`);
        return;
      }
      player.gems = gems - XP_BOOST_GEM_COST;
      player.xpBoostUntil = Date.now() + XP_BOOST_DURATION_MS;
      socket.emit("player", player);
      socket.emit("system", `📘 Bình Tăng XP kích hoạt: +${Math.round((XP_BOOST_MULTIPLIER - 1) * 100)}% XP trong 30 phút!`);
      this.markDirty(player);
    });

    // Sprint 162: rage potion — +25% attack damage for 10 minutes.
    socket.on("buyRagePotion", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (isRageActive(player.rageUntil)) {
        socket.emit("system", "Bình Cuồng Nộ đang còn hiệu lực.");
        return;
      }
      const gems = player.gems ?? 0;
      if (gems < RAGE_GEM_COST) {
        socket.emit("system", `Cần ${RAGE_GEM_COST} 💎 để mua Bình Cuồng Nộ (đang có ${gems}).`);
        return;
      }
      player.gems = gems - RAGE_GEM_COST;
      player.rageUntil = Date.now() + RAGE_DURATION_MS;
      socket.emit("player", player);
      socket.emit("system", `⚔️ Bình Cuồng Nộ kích hoạt: +${Math.round((RAGE_MULTIPLIER - 1) * 100)}% sát thương trong 10 phút!`);
      this.markDirty(player);
    });

    // Sprint 165: claim a one-time level-milestone reward chest.
    socket.on("claimLevelMilestone", ({ level }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const milestone = levelMilestone(Number(level));
      if (!milestone) {
        socket.emit("system", "Mốc phần thưởng không hợp lệ.");
        return;
      }
      if (player.stats.level < milestone.level) {
        socket.emit("system", `Cần đạt cấp ${milestone.level} để nhận mốc này.`);
        return;
      }
      const claimed = player.claimedMilestones ?? [];
      if (claimed.includes(milestone.level)) {
        socket.emit("system", "Bạn đã nhận mốc này rồi.");
        return;
      }
      claimed.push(milestone.level);
      player.claimedMilestones = claimed;
      player.stats.gold += milestone.gold;
      player.gems = (player.gems ?? 0) + milestone.gems;
      socket.emit("player", player);
      socket.emit("system", `🎁 Mốc cấp ${milestone.level}: nhận ${milestone.gold.toLocaleString("vi-VN")} vàng + ${milestone.gems} 💎!`);
      this.emitFloating(player.id, player.position, milestone.gold, "loot", `Mốc cấp ${milestone.level}`);
      this.markDirty(player);
    });

    // Sprint 174: claim a one-time achievement-count completion reward.
    socket.on("claimAchievementMilestone", ({ count }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const milestone = achievementMilestone(Number(count));
      if (!milestone) {
        socket.emit("system", "Mốc thành tựu không hợp lệ.");
        return;
      }
      if ((player.achievements?.length ?? 0) < milestone.count) {
        socket.emit("system", `Cần mở ${milestone.count} thành tựu để nhận mốc này (đang có ${player.achievements?.length ?? 0}).`);
        return;
      }
      const claimed = player.claimedAchTiers ?? [];
      if (claimed.includes(milestone.count)) {
        socket.emit("system", "Bạn đã nhận mốc thành tựu này rồi.");
        return;
      }
      claimed.push(milestone.count);
      player.claimedAchTiers = claimed;
      player.gems = (player.gems ?? 0) + milestone.gems;
      socket.emit("player", player);
      socket.emit("system", `🏅 Mốc ${milestone.count} thành tựu: nhận ${milestone.gems} 💎!`);
      this.markDirty(player);
    });

    socket.on("exchangeGemsForGold", ({ gems }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const spend = Math.floor(Number(gems) || 0);
      if (spend < 1) {
        socket.emit("system", "Số Gem đổi không hợp lệ.");
        return;
      }
      if ((player.gems ?? 0) < spend) {
        socket.emit("system", `Không đủ Gem (đang có ${player.gems ?? 0}).`);
        return;
      }
      player.gems = (player.gems ?? 0) - spend;
      const gold = gemsToGold(spend);
      player.stats.gold += gold;
      socket.emit("player", player);
      socket.emit("system", `💱 Đã đổi ${spend} 💎 thành ${gold.toLocaleString("vi-VN")} vàng.`);
      this.markDirty(player);
    });

    socket.on("buyBagSlots", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const bonus = player.bagBonus ?? 0;
      if (bonus >= BAG_MAX_BONUS) {
        socket.emit("system", "Túi đồ đã mở rộng tối đa.");
        return;
      }
      const cost = bagUpgradeCost(bonus);
      if (player.stats.gold < cost) {
        socket.emit("system", `Cần ${cost.toLocaleString("vi-VN")} vàng để mở rộng túi (+${BAG_SLOT_PACK} ô).`);
        return;
      }
      player.stats.gold -= cost;
      player.bagBonus = bonus + BAG_SLOT_PACK;
      socket.emit("player", player);
      socket.emit("system", `🎒 Đã mở rộng túi đồ lên ${bagCapacity(player.bagBonus)} ô.`);
      if ((player.bagBonus ?? 0) >= BAG_MAX_BONUS) this.unlockAchievement(player, "bag-master");
      this.markDirty(player);
    });

    socket.on("buyMysteryBox", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const gems = player.gems ?? 0;
      if (gems < MYSTERY_BOX_GEM_COST) {
        socket.emit("system", `Cần ${MYSTERY_BOX_GEM_COST} 💎 để mở Rương Bí Ẩn (đang có ${gems}).`);
        return;
      }
      player.gems = gems - MYSTERY_BOX_GEM_COST;
      const reward = rollMysteryBox();
      let converted = false;
      let label = reward.label;
      if (reward.kind === "gold") {
        player.stats.gold += reward.amount ?? 0;
      } else if (reward.kind === "gems") {
        player.gems = (player.gems ?? 0) + (reward.amount ?? 0);
      } else if (reward.kind === "cosmetic" && reward.id) {
        if ((player.cosmetics ?? []).includes(reward.id)) {
          player.gems = (player.gems ?? 0) + MYSTERY_DUP_GEMS;
          converted = true;
          label = `${reward.label} (đã có → +${MYSTERY_DUP_GEMS} 💎)`;
        } else {
          player.cosmetics = [...(player.cosmetics ?? []), reward.id];
          this.checkCollectionAchievements(player);
        }
      } else if (reward.kind === "pet" && reward.id) {
        if ((player.ownedPets ?? []).includes(reward.id)) {
          player.gems = (player.gems ?? 0) + MYSTERY_DUP_GEMS;
          converted = true;
          label = `${reward.label} (đã có → +${MYSTERY_DUP_GEMS} 💎)`;
        } else {
          player.ownedPets = [...(player.ownedPets ?? []), reward.id];
          this.checkCollectionAchievements(player);
        }
      }
      socket.emit("player", player);
      socket.emit("mysteryBoxResult", { kind: reward.kind, label, converted });
      socket.emit("system", `🎁 Rương Bí Ẩn: ${label}!`);
      this.unlockAchievement(player, "high-roller");
      this.markDirty(player);
    });

    socket.on("loadLoadout", ({ slot }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (typeof slot !== "number" || slot < 0 || slot > 2) {
        socket.emit("system", "Vị trí preset không hợp lệ.");
        return;
      }
      const loadouts = player.skillLoadouts ?? [];
      const target = loadouts[slot];
      if (!target || target.length === 0) {
        socket.emit("system", `Preset ${slot + 1} chưa có dữ liệu.`);
        return;
      }
      // Filter to only currently-learned skills.
      const learned = new Set(player.learnedSkills);
      const next: SkillId[] = [];
      for (const id of target) {
        if (learned.has(id)) next.push(id);
        if (next.length >= 4) break;
      }
      player.equippedSkills = next;
      socket.emit("player", player);
      socket.emit("system", `Đã chuyển sang loadout ${slot + 1}.`);
      this.markDirty(player);
    });

    socket.on("upgradeSkill", ({ skillId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isSkillId(skillId)) {
        socket.emit("system", "Kỹ năng không tồn tại.");
        return;
      }
      if (!player.learnedSkills.includes(skillId)) {
        socket.emit("system", "Bạn chưa học kỹ năng này.");
        return;
      }
      const ranks = player.skillRanks ?? {};
      const current = ranks[skillId] ?? 0;
      if (current >= SKILL_MAX_RANK) {
        socket.emit("system", `${skillLabel(skillId)} đã đạt cấp tối đa.`);
        return;
      }
      const points = player.talentPoints ?? 0;
      if (points < 1) {
        socket.emit("system", "Không đủ điểm tài năng.");
        return;
      }
      ranks[skillId] = current + 1;
      player.skillRanks = ranks;
      player.talentPoints = points - 1;
      socket.emit("player", player);
      socket.emit("system", `Nâng ${skillLabel(skillId)} lên cấp ${current + 1}/${SKILL_MAX_RANK}.`);
      this.markDirty(player);
      this.unlockAchievement(player, "talent-spent");
    });

    // Sprint 156: respec all spent talent points for gold so players can
    // re-spec their skill ranks freely.
    socket.on("respecTalents", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const ranks = player.skillRanks ?? {};
      const spent = Object.values(ranks).reduce((a, b) => a + (b ?? 0), 0);
      if (spent <= 0) {
        socket.emit("system", "Bạn chưa tiêu điểm tài năng nào.");
        return;
      }
      const cost = RESPEC_COST_PER_POINT * spent;
      if (player.stats.gold < cost) {
        socket.emit("system", `Cần ${cost.toLocaleString("vi-VN")} vàng để tẩy ${spent} điểm tài năng.`);
        return;
      }
      player.stats.gold -= cost;
      player.talentPoints = (player.talentPoints ?? 0) + spent;
      player.skillRanks = {};
      socket.emit("player", player);
      socket.emit("system", `Đã tẩy ${spent} điểm tài năng (−${cost.toLocaleString("vi-VN")} vàng). Phân bổ lại tùy ý!`);
      this.markDirty(player);
    });

    socket.on("useItem", async ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const itemIndex = player.inventory.items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return;
      const item = player.inventory.items[itemIndex];
      if (item.kind !== "consumable") return;
      // Recall scroll: teleport to town spawn.
      if (item.recall) {
        player.inventory.items.splice(itemIndex, 1);
        player.position = { ...townSpawn };
        player.velocity = { x: 0, y: 0 };
        socket.emit("player", player);
        socket.emit("system", `Đã dùng ${item.name}, trở về thị trấn.`);
        this.markDirty(player);
        this.unlockAchievement(player, "homeward");
        return;
      }
      const before = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + item.heal);
      const healed = player.stats.hp - before;
      player.inventory.items.splice(itemIndex, 1);
      socket.emit("player", player);
      if (healed > 0) this.emitFloating(player.id, player.position, healed, "heal", `+${healed} hp`);
      socket.emit("system", healed > 0 ? `Đã dùng ${item.name} hồi ${healed} máu.` : "Máu đã đầy.");
      this.markDirty(player);
    });

    socket.on("sellItem", async ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Bạn cần về thị trấn để bán trang bị.");
        return;
      }
      const itemIndex = player.inventory.items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return;
      if (player.inventory.items[itemIndex].locked) {
        socket.emit("system", "🔒 Vật phẩm đang khóa — mở khóa trước khi bán.");
        return;
      }
      const [item] = player.inventory.items.splice(itemIndex, 1);
      const gold = sellValue(item.value);
      player.stats.gold += gold;
      socket.emit("player", player);
      socket.emit("system", `Đã bán ${item.name} được ${gold} vàng.`);
      this.emitFloating(player.id, player.position, gold, "loot", `+${gold} gold`);
      this.markDirty(player);
    });

    socket.on("requestOnline", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const players = [...this.players.values()]
        .map((p) => ({ accountName: p.accountName, level: p.stats.level, guildTag: p.guildTag }))
        .sort((a, b) => b.level - a.level)
        .slice(0, 50);
      socket.emit("onlineList", { count: this.players.size, players });
    });

    socket.on("payPlayer", ({ to, amount }) => {
      const sender = this.players.get(socket.id);
      if (!sender) return;
      const gold = Math.floor(Number(amount) || 0);
      const cleanTo = String(to ?? "").trim().slice(0, 20);
      if (gold < 1) {
        socket.emit("system", "Số vàng chuyển không hợp lệ.");
        return;
      }
      if (cleanTo === sender.accountName) {
        socket.emit("system", "Không thể chuyển vàng cho chính mình.");
        return;
      }
      if (sender.stats.gold < gold) {
        socket.emit("system", `Không đủ vàng (đang có ${sender.stats.gold}).`);
        return;
      }
      const recipient = [...this.players.values()].find((p) => p.accountName === cleanTo);
      if (!recipient) {
        socket.emit("system", `${cleanTo || "Người chơi"} không online.`);
        return;
      }
      // 5% transfer tax burned (sink, consistent with the marketplace).
      const net = gold - Math.floor(gold * 0.05);
      sender.stats.gold -= gold;
      recipient.stats.gold += net;
      socket.emit("player", sender);
      socket.emit("system", `Đã chuyển ${gold.toLocaleString("vi-VN")} vàng cho ${cleanTo} (họ nhận ${net.toLocaleString("vi-VN")} sau phí 5%).`);
      this.sockets.get(recipient.id)?.emit("player", recipient);
      this.sockets.get(recipient.id)?.emit("system", `💰 ${sender.accountName} đã chuyển cho bạn ${net.toLocaleString("vi-VN")} vàng.`);
      this.markDirty(sender);
      this.markDirty(recipient);
    });

    // Sprint 201: mailbox — send gold to any player (delivered offline).
    socket.on("sendMail", ({ to, gold, message, itemId }) => {
      const sender = this.players.get(socket.id);
      if (!sender) return;
      const amount = Math.floor(Number(gold) || 0);
      const cleanTo = String(to ?? "").trim().slice(0, 20);
      const cleanMsg = String(message ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      if (!cleanTo) { socket.emit("system", "Nhập tên người nhận."); return; }
      if (cleanTo === sender.accountName) { socket.emit("system", "Không thể gửi thư cho chính mình."); return; }
      // Sprint 202: optional item attachment — escrow it out of the bag.
      let attached: Item | undefined;
      let attachIdx = -1;
      if (itemId) {
        attachIdx = sender.inventory.items.findIndex((it) => it.id === itemId);
        if (attachIdx < 0) { socket.emit("system", "Không tìm thấy vật phẩm để đính kèm."); return; }
        const it = sender.inventory.items[attachIdx];
        if (it.locked) { socket.emit("system", "🔒 Vật phẩm đang khóa — mở khóa trước khi gửi."); return; }
        if (it.kind === "equipment" && sender.inventory.equipped[it.slot]?.id === it.id) { socket.emit("system", "Hãy tháo trang bị trước khi gửi."); return; }
        attached = it;
      }
      if (amount < 1 && !attached) { socket.emit("system", "Nhập số vàng hoặc đính kèm vật phẩm."); return; }
      if (amount > 0 && sender.stats.gold < amount) { socket.emit("system", `Không đủ vàng (đang có ${sender.stats.gold}).`); return; }
      const mail = { id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, from: sender.accountName, to: cleanTo, gold: Math.max(0, amount), message: cleanMsg, sentAt: Date.now(), item: attached };
      if (!mailStore.send(mail)) { socket.emit("system", `Hòm thư của ${cleanTo} đã đầy.`); return; }
      if (attached && attachIdx >= 0) sender.inventory.items.splice(attachIdx, 1);
      sender.stats.gold -= Math.max(0, amount);
      socket.emit("player", sender);
      const sentParts = [amount > 0 ? `${amount.toLocaleString("vi-VN")} vàng` : "", attached ? attached.name : ""].filter(Boolean).join(" + ");
      socket.emit("system", `📮 Đã gửi ${sentParts} cho ${cleanTo}.`);
      this.unlockAchievement(sender, "pen-pal");
      this.bumpQuestProgress(sender, ["sendMail"]);
      this.markDirty(sender);
      // Notify the recipient live if they're online.
      const online = [...this.players.values()].find((p) => p.accountName === cleanTo);
      if (online) {
        this.sockets.get(online.id)?.emit("system", `📬 Bạn có thư mới từ ${sender.accountName} (mở Hòm Thư để nhận).`);
        this.sockets.get(online.id)?.emit("mailList", mailStore.getFor(cleanTo));
      }
    });

    socket.on("requestMail", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      socket.emit("mailList", mailStore.getFor(player.accountName));
    });

    socket.on("claimMail", ({ mailId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      // Peek first: if there's an item but the bag is full, don't consume the mail.
      const peek = mailStore.getFor(player.accountName).find((m) => m.id === String(mailId ?? ""));
      if (peek?.item && isBagFull(player)) { socket.emit("system", BAG_FULL_MESSAGE); return; }
      const mail = mailStore.claim(player.accountName, String(mailId ?? ""));
      if (!mail) { socket.emit("system", "Thư không còn tồn tại."); return; }
      player.stats.gold += mail.gold;
      if (mail.item) player.inventory.items.push(mail.item);
      socket.emit("player", player);
      socket.emit("mailList", mailStore.getFor(player.accountName));
      const gotParts = [mail.gold > 0 ? `${mail.gold.toLocaleString("vi-VN")} vàng` : "", mail.item ? mail.item.name : ""].filter(Boolean).join(" + ");
      socket.emit("system", `📨 Đã nhận ${gotParts} từ ${mail.from}.`);
      if (mail.gold > 0) this.emitFloating(player.id, player.position, mail.gold, "loot", `+${mail.gold} thư`);
      this.markDirty(player);
    });

    socket.on("sellAllMaterials", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      let count = 0;
      let gold = 0;
      player.inventory.items = player.inventory.items.filter((item) => {
        if (item.kind === "material") {
          count += 1;
          gold += sellValue(item.value);
          return false;
        }
        return true;
      });
      if (count === 0) {
        socket.emit("system", "Không có nguyên liệu nào để bán.");
        return;
      }
      player.stats.gold += gold;
      socket.emit("player", player);
      socket.emit("system", `Đã bán ${count} nguyên liệu được ${gold.toLocaleString("vi-VN")} vàng.`);
      this.markDirty(player);
    });

    socket.on("sellJunk", async () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Bạn cần về thị trấn để bán trang bị.");
        return;
      }

      let soldCount = 0;
      let gold = 0;
      player.inventory.items = player.inventory.items.filter((item) => {
        const junk = item.kind === "equipment" && item.rarity === "common";
        if (junk) {
          soldCount += 1;
          gold += sellValue(item.value);
        }
        return !junk;
      });
      if (soldCount === 0) {
        socket.emit("system", "Không có trang bị thường nào để bán.");
        return;
      }

      player.stats.gold += gold;
      socket.emit("player", player);
      socket.emit("system", `Đã bán ${soldCount} món đồ thường được ${gold} vàng.`);
      this.emitFloating(player.id, player.position, gold, "loot", `+${gold} gold`);
      this.markDirty(player);
    });

    socket.on("craftRecipe", ({ recipeId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Cần về thị trấn để mở lò rèn.");
        return;
      }
      this.craftRecipe(player, recipeId);
    });

    // Sprint 171: brew HP potions from materials at the alchemy bench.
    socket.on("brewPotion", ({ recipeId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Cần về thị trấn để luyện đan.");
        return;
      }
      this.brewPotion(player, recipeId);
    });

    // Sprint 172: buy a mount (gold sink) → adds to owned list.
    socket.on("buyMount", ({ mountId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const mount = getMount(mountId);
      if (!mount) {
        socket.emit("system", "Thú cưỡi không tồn tại.");
        return;
      }
      const owned = player.ownedMounts ?? [];
      if (owned.includes(mount.id)) {
        socket.emit("system", "Bạn đã sở hữu thú cưỡi này.");
        return;
      }
      if (player.stats.gold < mount.goldPrice) {
        socket.emit("system", `Cần ${mount.goldPrice.toLocaleString("vi-VN")} vàng để mua ${mount.name}.`);
        return;
      }
      player.stats.gold -= mount.goldPrice;
      owned.push(mount.id);
      player.ownedMounts = owned;
      player.activeMount = mount.id;
      this.unlockAchievement(player, "rider");
      socket.emit("player", player);
      socket.emit("system", `🐎 Đã mua & cưỡi ${mount.name} (${mount.desc})!`);
      this.markDirty(player);
    });

    // Sprint 172: equip / unequip an owned mount.
    socket.on("equipMount", ({ mountId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (mountId === null) {
        player.activeMount = undefined;
        socket.emit("player", player);
        socket.emit("system", "Đã xuống ngựa.");
        this.markDirty(player);
        return;
      }
      if (!(player.ownedMounts ?? []).includes(mountId)) {
        socket.emit("system", "Bạn chưa sở hữu thú cưỡi này.");
        return;
      }
      player.activeMount = mountId;
      socket.emit("player", player);
      socket.emit("system", `🐎 Đang cưỡi ${getMount(mountId)?.name}.`);
      this.markDirty(player);
    });

    socket.on("enchantItem", ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Cần về thị trấn để tinh luyện.");
        return;
      }
      this.enchantItem(player, itemId);
    });

    socket.on("salvageItem", ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      this.salvageItem(player, itemId);
    });

    // Sprint 151: toggle a protective lock on an inventory item so it can't be
    // accidentally sold, salvaged, or dropped.
    socket.on("toggleItemLock", ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const item = player.inventory.items.find((it) => it.id === itemId);
      if (!item) {
        socket.emit("system", "Không tìm thấy vật phẩm trong túi.");
        return;
      }
      item.locked = !item.locked;
      socket.emit("player", player);
      socket.emit("system", item.locked ? `🔒 Đã khóa ${item.name}.` : `🔓 Đã mở khóa ${item.name}.`);
      this.markDirty(player);
    });

    // Sprint 152: mass-salvage unequipped, unlocked gear by rarity / junk.
    socket.on("salvageAll", ({ rarity }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      this.salvageAll(player, String(rarity ?? "junk"));
    });

    // Sprint 176: set the auto-salvage loot filter threshold.
    socket.on("setAutoSalvage", ({ rarity }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const valid = rarity === "off" || rarity === "common" || rarity === "rare";
      player.autoSalvageRarity = valid ? rarity : "off";
      socket.emit("player", player);
      const label = player.autoSalvageRarity === "off" ? "TẮT" : player.autoSalvageRarity === "common" ? "đồ Thường" : "đồ Thường + Hiếm";
      socket.emit("system", `🔧 Tự phân giải: ${label}.`);
      this.markDirty(player);
    });

    // Sprint 180: claim the one-time starter pack (welcome gift).
    socket.on("claimStarterPack", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (player.starterPackClaimed) {
        socket.emit("system", "Bạn đã nhận Gói Tân Thủ rồi.");
        return;
      }
      player.starterPackClaimed = true;
      player.stats.gold += 3000;
      player.gems = (player.gems ?? 0) + 30;
      for (let i = 0; i < 5; i += 1) {
        const info = MATERIAL_CATALOG.slimeCore;
        player.inventory.items.push({
          id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`,
          kind: "material", materialId: "slimeCore", name: info.name, rarity: info.rarity, value: info.value
        });
      }
      player.xpBoostUntil = Date.now() + XP_BOOST_DURATION_MS;
      socket.emit("player", player);
      socket.emit("system", "🎁 Gói Tân Thủ: +3.000 vàng, +30 💎, 5 Lõi Slime, và Bình Tăng XP 30 phút!");
      this.emitFloating(player.id, player.position, 3000, "loot", "Gói Tân Thủ");
      this.markDirty(player);
    });

    // Sprint 190: claim the weekly login reward (7-day cooldown).
    socket.on("claimWeeklyReward", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const now = Date.now();
      const last = player.lastWeeklyClaimAt ?? 0;
      if (now - last < WEEKLY_CLAIM_INTERVAL_MS) {
        const days = ((WEEKLY_CLAIM_INTERVAL_MS - (now - last)) / 86400000).toFixed(1);
        socket.emit("system", `Thưởng tuần đã nhận — còn ${days} ngày nữa.`);
        return;
      }
      player.lastWeeklyClaimAt = now;
      player.stats.gold += WEEKLY_REWARD_GOLD;
      player.gems = (player.gems ?? 0) + WEEKLY_REWARD_GEMS;
      socket.emit("player", player);
      socket.emit("system", `📦 Thưởng tuần: +${WEEKLY_REWARD_GOLD.toLocaleString("vi-VN")} vàng, +${WEEKLY_REWARD_GEMS} 💎!`);
      this.emitFloating(player.id, player.position, WEEKLY_REWARD_GOLD, "loot", "Thưởng tuần");
      this.markDirty(player);
    });

    // Sprint 206: buy the rotating daily-deal cosmetic at a discount (1/day).
    socket.on("buyDailyDeal", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const today = dailyDealDayIndex();
      if ((player.lastDealDay ?? 0) === today) {
        socket.emit("system", "Bạn đã mua khuyến mãi hôm nay rồi — quay lại ngày mai.");
        return;
      }
      const cosmetic = dailyDealCosmetic();
      const owned = player.cosmetics ?? [];
      if (owned.includes(cosmetic.id)) {
        socket.emit("system", `Bạn đã sở hữu ${cosmetic.name}.`);
        return;
      }
      const price = dailyDealPrice();
      const gems = player.gems ?? 0;
      if (gems < price) {
        socket.emit("system", `Cần ${price} 💎 để mua ${cosmetic.name} (KM).`);
        return;
      }
      player.gems = gems - price;
      player.cosmetics = [...owned, cosmetic.id];
      player.lastDealDay = today;
      this.checkCollectionAchievements(player);
      socket.emit("player", player);
      socket.emit("system", `🏷️ Mua KM ${cosmetic.name} chỉ ${price} 💎 (giảm ${Math.round(35)}%)!`);
      this.markDirty(player);
    });

    // Sprint 181: fuse 3 common gear into 1 rare-or-better piece at the forge.
    socket.on("fuseGear", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Cần về thị trấn để hợp nhất trang bị.");
        return;
      }
      this.fuseGear(player);
    });

    // Sprint 155: gold enhancement (+N) at the forge.
    socket.on("upgradeItem", ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Cần về thị trấn để cường hóa.");
        return;
      }
      this.upgradeItem(player, itemId);
    });

    socket.on("selectClass", ({ playerClass }) => {
      const player = this.players.get(socket.id);
      if (!player) {
        socket.emit("system", "Chưa đăng nhập.");
        return;
      }
      if (player.playerClass) {
        socket.emit("system", "Bạn đã chọn lớp rồi, không thể đổi.");
        return;
      }
      if (!isPlayerClass(playerClass)) {
        socket.emit("system", "Lớp nhân vật không hợp lệ.");
        return;
      }
      const info = CLASS_CATALOG[playerClass];
      player.playerClass = playerClass;
      // Apply one-time stat bonuses.
      player.stats.maxHp += info.startBonusMaxHp;
      player.stats.hp = Math.min(player.stats.hp + info.startBonusMaxHp, player.stats.maxHp);
      player.stats.attack += info.startBonusAttack;
      player.stats.defense += info.startBonusDefense;
      // Default-learned skills: keep only those allowed by class.
      player.learnedSkills = player.learnedSkills.filter((s) => info.skills.includes(s));
      // Always grant the first class skill so the player has something castable.
      if (info.skills.length && !player.learnedSkills.includes(info.skills[0])) {
        player.learnedSkills.push(info.skills[0]);
      }
      // Clear any equipped skills that no longer match (server will sanitize).
      player.equippedSkills = player.equippedSkills.map((s) => s && player.learnedSkills.includes(s) ? s : null);
      this.markDirty(player);
      socket.emit("player", player);
      socket.emit("system", `Chào mừng ${info.name}! HP +${info.startBonusMaxHp}, ATK +${info.startBonusAttack}, DEF +${info.startBonusDefense}.`);
    });

    socket.on("leaderboardRequest", () => {
      const players = [...this.players.values()].map((p) => ({
        playerId: p.id,
        accountName: p.accountName,
        level: p.stats.level,
        gold: p.stats.gold,
        pvpKills: p.pvpKills ?? 0
      }));
      const byLevel = [...players].sort((a, b) => b.level - a.level || b.gold - a.gold).slice(0, 10);
      const byGold = [...players].sort((a, b) => b.gold - a.gold).slice(0, 10);
      const byKills = [...players].sort((a, b) => b.pvpKills - a.pvpKills).slice(0, 10);
      socket.emit("leaderboard", { byLevel, byGold, byKills });
    });

    socket.on("rerollDailyQuests", () => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const cost = 100;
      if (player.stats.gold < cost) {
        socket.emit("system", `Cần ${cost} vàng để làm mới nhiệm vụ hằng ngày.`);
        return;
      }
      player.stats.gold -= cost;
      // Force a re-roll regardless of timer.
      const pool = [...DAILY_QUEST_POOL];
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const fresh = pool.slice(0, DAILY_QUESTS_PER_DAY);
      const oldDaily = new Set(player.dailyQuestIds ?? []);
      const active = this.activeQuests.get(player.id) ?? [];
      const filtered = active.filter((entry) => !oldDaily.has(entry.questId));
      for (const id of fresh) {
        const template = questById(id);
        if (template) filtered.push({ questId: id, progress: initialQuestProgress(template, player) });
      }
      this.activeQuests.set(player.id, filtered);
      player.dailyQuestIds = fresh;
      player.dailyResetAt = Date.now();
      socket.emit("player", player);
      socket.emit("system", `Đã làm mới nhiệm vụ hằng ngày (-${cost} vàng).`);
      this.emitQuestList(player);
      this.markDirty(player);
    });

    socket.on("arenaLeaderboardRequest", () => {
      const rows: ArenaLeaderRow[] = [];
      for (const p of this.players.values()) {
        if ((p.pvpKills ?? 0) === 0 && (p.pvpDeaths ?? 0) === 0) continue;
        rows.push({ playerId: p.id, accountName: p.accountName, kills: p.pvpKills ?? 0, deaths: p.pvpDeaths ?? 0 });
      }
      rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      socket.emit("arenaLeaderboard", rows.slice(0, 10));
    });

    socket.on("dropItem", async ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const itemIndex = player.inventory.items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return;
      if (player.inventory.items[itemIndex].locked) {
        socket.emit("system", "🔒 Vật phẩm đang khóa — mở khóa trước khi thả.");
        return;
      }
      const [item] = player.inventory.items.splice(itemIndex, 1);
      const groundItem: GroundItem = {
        id: `ground-${Date.now()}-${Math.random()}`,
        item,
        position: scatterAround(player.position),
        droppedBy: player.id,
        createdAt: Date.now()
      };
      this.groundItems.set(groundItem.id, groundItem);
      socket.emit("player", player);
      socket.emit("system", `Đã thả ${item.name}.`);
      this.markDirty(player);
      this.broadcastSnapshot();
    });

    socket.on("pickupGroundItem", async ({ groundItemId }) => {
      const player = this.players.get(socket.id);
      const groundItem = this.groundItems.get(groundItemId);
      if (!player || !groundItem) return;
      if (distance(player.position, groundItem.position) > GROUND_ITEM_PICKUP_RANGE) {
        socket.emit("system", "Bạn cần đứng gần vật phẩm hơn để nhặt.");
        return;
      }
      if (isBagFull(player)) {
        socket.emit("system", BAG_FULL_MESSAGE);
        return;
      }
      this.groundItems.delete(groundItem.id);
      // Treasure chest pickup: schedule the slot to respawn in 5 minutes.
      if (groundItem.droppedBy === TREASURE_DROPPED_BY) {
        const slot = this.chestSlots.find((s) => s.activeItemId === groundItem.id);
        if (slot) {
          slot.activeItemId = undefined;
          slot.nextSpawnAt = Date.now() + TREASURE_RESPAWN_MS;
        }
        this.bumpQuestProgress(player, ["openChest"]);
        player.chestsOpened = (player.chestsOpened ?? 0) + 1;
        if (player.chestsOpened >= 10) this.unlockAchievement(player, "treasure-hoard");
      }
      player.inventory.items.push(groundItem.item);
      socket.emit("player", player);
      socket.emit("system", `Đã nhặt ${groundItem.item.name}.`);
      this.emitFloating(player.id, player.position, 0, "loot", groundItem.item.name);
      this.markDirty(player);
      this.broadcastSnapshot();
    });

    socket.on("chatMessage", ({ message }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      // Anti-cheat: bound message length + reject high-frequency spam beyond
      // the existing 900ms cooldown window.
      if (typeof message !== "string") return;
      if (message.length > 200) {
        socket.emit("system", "Tin nhắn quá dài.");
        return;
      }
      const now = Date.now();
      if (now - (this.chatCooldowns.get(socket.id) ?? 0) < 900) {
        socket.emit("system", "Chat đang hồi, chờ một chút nhé.");
        return;
      }
      const clean = message.replace(/\s+/g, " ").trim().slice(0, 160);
      if (!clean) return;
      const chatMessage: ChatMessage = {
        id: `${now}-${socket.id}`,
        playerId: socket.id,
        accountName: player.accountName,
        message: clean,
        sentAt: now
      };
      this.chatCooldowns.set(socket.id, now);
      this.chatMessages.push(chatMessage);
      while (this.chatMessages.length > 50) this.chatMessages.shift();
      this.io.emit("chatMessage", chatMessage);
    });

    socket.on("disconnect", async () => {
      const player = this.players.get(socket.id);
      if (player) await this.saveNow(player);
      this.removeFromParty(socket.id);
      const guildId = player?.guildId;
      this.players.delete(socket.id);
      // After removal, refresh online flags for remaining guildmates.
      if (guildId) this.emitGuildUpdate(guildId);
      this.sockets.delete(socket.id);
      this.inputs.delete(socket.id);
      this.chatCooldowns.delete(socket.id);
      this.lastTownHealTextAt.delete(socket.id);
      this.autoRetarget.delete(socket.id);
      this.activeQuests.delete(socket.id);
      this.raidAttackCooldown.delete(socket.id);
    });
  }

  private tick(deltaMs: number): void {
    const now = Date.now();
    this.updatePlayers(deltaMs);
    this.updateTownHealing(deltaMs, now);
    this.updateMonsters(deltaMs, now);
    this.updateCombat(now);
    this.updateStatusEffects(now);
    this.updateRespawns(now);
    this.cleanupGroundItems(now);
    this.maintainTreasureChests(now);
    this.updateGuildRaids(now);
  }

  // Expire guild raids whose timer ran out before the boss was defeated.
  private updateGuildRaids(now: number): void {
    for (const [guildId, raid] of this.guildRaids) {
      if (now >= raid.expiresAt && raid.hp > 0) {
        this.guildRaids.delete(guildId);
        this.guildRaidCooldownUntil.set(guildId, now + GUILD_RAID_COOLDOWN_MS);
        const guild = guildStore.get(guildId);
        if (guild) this.broadcastGuildSystem(guild, `Boss ${raid.bossName} đã rút lui (hết giờ). Thử lại sau!`);
        this.broadcastGuildRaid(guildId);
      }
    }
  }

  private updatePlayers(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const [id, player] of this.players) {
      const input = this.inputs.get(id);
      if (!input) continue;
      const axis = {
        x: Number(input.right) - Number(input.left),
        y: Number(input.down) - Number(input.up)
      };
      // Compute current effective speed: base + equipment speed bonus,
      // and apply sprint multiplier if requested + sufficient stamina.
      const maxStam = player.stats.maxStamina ?? BASE_MAX_STAMINA;
      const curStam = player.stats.stamina ?? maxStam;
      const speedBonusPct = equipmentSpeedBonusPct(player) + mountSpeedBonus(player.activeMount);
      const baseSpeed = PLAYER_SPEED * (1 + speedBonusPct / 100);
      const wantSprint = !!input.sprinting && curStam >= SPRINT_MIN_STAMINA_TO_START;
      const sprinting = wantSprint && curStam > 0;
      const moving = axis.x !== 0 || axis.y !== 0 || !!input.moveTarget;
      const speed = sprinting && moving ? baseSpeed * SPRINT_MULTIPLIER : baseSpeed;

      // Stamina update.
      if (sprinting && moving) {
        const next = Math.max(0, curStam - SPRINT_DRAIN_PER_SECOND * dt);
        player.stats.stamina = next;
      } else if (curStam < maxStam) {
        const next = Math.min(maxStam, curStam + SPRINT_REGEN_PER_SECOND * dt);
        player.stats.stamina = next;
      }
      if (player.stats.maxStamina === undefined) player.stats.maxStamina = maxStam;

      // Auto-stop only when the moveTarget is on the targeted monster
      // (player clicked the mob) AND they are already within attack range.
      // Don't clear moveTarget if the player wants to walk past or away
      // from the target.
      const aliveTarget = player.targetId ? this.monsters.find((m) => m.id === player.targetId && !m.respawnsAt && m.hp > 0) : undefined;
      if (input.moveTarget && aliveTarget &&
          distance(input.moveTarget, aliveTarget.position) <= 48 &&
          distance(player.position, aliveTarget.position) <= PLAYER_ATTACK_RANGE) {
        input.moveTarget = undefined;
      }
      const manualLength = Math.hypot(axis.x, axis.y);
      if (manualLength > 0) {
        player.velocity = { x: (axis.x / manualLength) * speed, y: (axis.y / manualLength) * speed };
      } else if (input.moveTarget) {
        const dx = input.moveTarget.x - player.position.x;
        const dy = input.moveTarget.y - player.position.y;
        const targetDistance = Math.hypot(dx, dy);
        if (targetDistance > 5) {
          player.velocity = { x: (dx / targetDistance) * speed, y: (dy / targetDistance) * speed };
        } else {
          player.velocity = { x: 0, y: 0 };
        }
      } else {
        player.velocity = { x: 0, y: 0 };
      }
      const candidate = {
        x: player.position.x + player.velocity.x * dt,
        y: player.position.y + player.velocity.y * dt
      };
      // Anti-cheat: cap how far a player can move per tick. Even with full
      // speed + sprint + max speed gear, the player should never exceed
      // ~400 px/sec. Reject any candidate that violates this.
      const maxMovePerTick = 400 * dt + 4; // px allowance per tick
      const dxc = candidate.x - player.position.x;
      const dyc = candidate.y - player.position.y;
      if (Math.hypot(dxc, dyc) > maxMovePerTick) {
        // Snap movement to the legal max in the chosen direction.
        const len = Math.hypot(dxc, dyc) || 1;
        candidate.x = player.position.x + (dxc / len) * maxMovePerTick;
        candidate.y = player.position.y + (dyc / len) * maxMovePerTick;
      }
      player.position = this.resolveMovement(player.position, candidate);
      player.facing = facingFromAxis(player.velocity, player.facing);
    }
  }

  private updateTownHealing(deltaMs: number, now: number): void {
    for (const player of this.players.values()) {
      if (!isInTown(player.position) || player.stats.hp >= player.stats.maxHp) continue;
      // Arena tiles do NOT heal — otherwise duels would never end.
      if (isInArena(player.position)) continue;
      const heal = Math.max(1, Math.ceil(player.stats.maxHp * TOWN_HEAL_PER_SECOND * (deltaMs / 1000)));
      const before = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
      const healed = player.stats.hp - before;
      if (healed <= 0) continue;

      const lastTextAt = this.lastTownHealTextAt.get(player.id) ?? 0;
      if (now - lastTextAt > TOWN_HEAL_FLOATING_COOLDOWN_MS || player.stats.hp === player.stats.maxHp) {
        this.emitFloating(player.id, player.position, healed, "heal", `+${healed} hp`);
        this.lastTownHealTextAt.set(player.id, now);
      }
      this.sockets.get(player.id)?.emit("player", player);
    }
  }

  private updateMonsters(deltaMs: number, now: number): void {
    const dt = deltaMs / 1000;
    for (const monster of this.monsters) {
      if (monster.respawnsAt) continue;

      const previousTarget = monster.targetPlayerId ? this.players.get(monster.targetPlayerId) : undefined;
      const target = this.findMonsterTarget(monster);
      monster.targetPlayerId = target?.id;
      if (target) {
        this.returningToSpawn.delete(monster.id);
        if (isInTown(target.position)) {
          monster.targetPlayerId = undefined;
          monster.velocity = { x: 0, y: 0 };
          continue;
        }
        const dx = target.position.x - monster.position.x;
        const dy = target.position.y - monster.position.y;
        const len = Math.hypot(dx, dy) || 1;
        const slowMul = freezeSlowFor(monster);
        const effectiveSpeed = MONSTER_SPEED * slowMul;
        const defForChase = getMonsterDefinition(monster.type);
        const wantRange = defForChase.ranged ? (defForChase.rangedAttackRange ?? 200) - 30 : MONSTER_ATTACK_RANGE;
        monster.velocity = distance(monster.position, target.position) > wantRange
          ? { x: (dx / len) * effectiveSpeed, y: (dy / len) * effectiveSpeed }
          : { x: 0, y: 0 };
      } else if (previousTarget && isInTown(previousTarget.position)) {
        this.returningToSpawn.add(monster.id);
        monster.velocity = velocityToward(monster.position, monster.spawn, MONSTER_SPEED);
      } else if (this.returningToSpawn.has(monster.id)) {
        if (distance(monster.position, monster.spawn) <= 8) {
          this.returningToSpawn.delete(monster.id);
          monster.velocity = { x: 0, y: 0 };
        } else {
          monster.velocity = velocityToward(monster.position, monster.spawn, MONSTER_SPEED);
        }
      } else if (now % 1800 < 60) {
        const angle = Math.random() * Math.PI * 2;
        monster.velocity = { x: Math.cos(angle) * MONSTER_SPEED * 0.45, y: Math.sin(angle) * MONSTER_SPEED * 0.45 };
      }

      const next = {
        x: monster.position.x + monster.velocity.x * dt,
        y: monster.position.y + monster.velocity.y * dt
      };
      if (distance(monster.spawn, next) < monster.leashRadius) {
        monster.position = this.resolveMovement(monster.position, next);
      } else {
        monster.velocity = { x: 0, y: 0 };
        monster.targetPlayerId = undefined;
        this.returningToSpawn.add(monster.id);
      }
    }
  }

  private updateCombat(now: number): void {
    for (const player of this.players.values()) {
      let monsterTarget = this.selectedLivingMonster(player);
      const playerTarget = monsterTarget ? undefined : this.selectedPvpTarget(player);
      if (player.targetId && !monsterTarget && !playerTarget) {
        monsterTarget = this.tryAutoRetarget(player);
      }
      const canAttackMonster = monsterTarget && distance(player.position, monsterTarget.position) <= PLAYER_ATTACK_RANGE;
      if (((!monsterTarget || !canAttackMonster) && !playerTarget) || now - player.lastAttackAt < PLAYER_ATTACK_COOLDOWN_MS) continue;

      player.lastAttackAt = now;
      if (monsterTarget && canAttackMonster) {
        this.damageMonster(player, monsterTarget, 1, now);
      } else if (playerTarget) {
        this.hitPlayer(player, playerTarget);
      }
    }

    for (const monster of this.monsters) {
      if (monster.respawnsAt || !monster.targetPlayerId) continue;
      const player = this.players.get(monster.targetPlayerId);
      if (player && isInTown(player.position)) {
        monster.targetPlayerId = undefined;
        monster.velocity = { x: 0, y: 0 };
        continue;
      }
      const def = getMonsterDefinition(monster.type);
      const effectiveRange = def.ranged ? (def.rangedAttackRange ?? 200) : MONSTER_ATTACK_RANGE;
      if (!player || distance(monster.position, player.position) > effectiveRange) continue;
      if (Date.now() - monster.lastAttackAt < MONSTER_ATTACK_COOLDOWN_MS) continue;

      monster.lastAttackAt = Date.now();
      const result = rollDamage(monster.attack, player.stats.defense, monster.level - player.stats.level);
      player.stats.hp = Math.max(0, player.stats.hp - result.damage);
      this.emitFloating(player.id, player.position, result.damage, "damage");
      // Visual projectile for ranged casters.
      if (def.ranged) {
        this.io.emit("monsterProjectile", {
          sourceId: monster.id,
          sourcePosition: { ...monster.position },
          targetPosition: { ...player.position },
          color: def.rangedProjectileColor ?? 0xff8a4f
        });
      }
      if (player.stats.hp <= 0) {
        player.position = { ...townSpawn };
        player.stats.hp = Math.ceil(player.stats.maxHp * 0.65);
        this.sockets.get(player.id)?.emit("system", "Bạn đã bị hạ gục và được đưa về thị trấn.");
      }
      this.sockets.get(player.id)?.emit("player", player);
    }
  }

  private useSkill(player: PlayerState, skillId: SkillId, now: number): void {
    if (!isSkillId(skillId)) return;
    if (!player.equippedSkills.includes(skillId)) {
      this.sockets.get(player.id)?.emit("system", "Kỹ năng này chưa được gắn vào ô.");
      return;
    }
    if (now < player.skillCooldowns[skillId]) {
      this.sockets.get(player.id)?.emit("system", "Kỹ năng đang hồi.");
      return;
    }
    const info = SKILL_CATALOG[skillId];
    const label = skillLabel(skillId);
    // Apply rank multiplier to damage / heal / lifesteal effectiveness.
    const rank = player.skillRanks?.[skillId] ?? 0;
    const rankMul = skillRankMultiplier(rank);

    if (info.effect === "healSelf") {
      if (player.stats.hp >= player.stats.maxHp) {
        this.sockets.get(player.id)?.emit("system", "Máu đã đầy.");
        return;
      }
      const healAmount = Math.ceil(player.stats.maxHp * (info.healPercent ?? 0) * rankMul);
      const before = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAmount);
      const healed = player.stats.hp - before;
      player.skillCooldowns[skillId] = now + info.cooldownMs;
      this.emitFloating(player.id, player.position, healed, "heal", `+${healed} hp`);
      this.io.emit("skillCast", { casterId: player.id, skillId, position: { ...player.position } });
      this.sockets.get(player.id)?.emit("player", player);
      return;
    }

    if (info.effect === "damageSingle" || info.effect === "lifestealSingle") {
      const target = this.selectedLivingMonster(player);
      if (!target || distance(player.position, target.position) > PLAYER_ATTACK_RANGE) {
        this.sockets.get(player.id)?.emit("system", `Cần chọn quái trong tầm để dùng ${label}.`);
        return;
      }
      player.skillCooldowns[skillId] = now + info.cooldownMs;
      const hpBeforeMonster = target.hp;
      this.damageMonster(player, target, (info.damageMultiplier ?? 1) * rankMul, now, label);
      this.applySkillEffect(target, info.appliesEffect, now);
      if (info.effect === "lifestealSingle") {
        const damageDealt = hpBeforeMonster - target.hp;
        const drain = Math.max(1, Math.floor(damageDealt * (info.lifestealPercent ?? 0) * rankMul));
        const before = player.stats.hp;
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + drain);
        const healed = player.stats.hp - before;
        if (healed > 0) this.emitFloating(player.id, player.position, healed, "heal", `+${healed} hp`);
      }
      this.io.emit("skillCast", { casterId: player.id, skillId, position: { ...player.position }, targetPosition: { ...target.position } });
      this.sockets.get(player.id)?.emit("player", player);
      return;
    }

    // damageAoe
    const radius = info.aoeRadius ?? 100;
    const targets = this.monsters.filter((monster) => !monster.respawnsAt && monster.hp > 0 && distance(player.position, monster.position) <= radius);
    if (targets.length === 0) {
      this.sockets.get(player.id)?.emit("system", `Không có quái nào trong tầm ${label}.`);
      return;
    }
    player.skillCooldowns[skillId] = now + info.cooldownMs;
    for (const monster of targets) {
      this.damageMonster(player, monster, (info.damageMultiplier ?? 1) * rankMul, now, label);
      this.applySkillEffect(monster, info.appliesEffect, now);
    }
    this.io.emit("skillCast", { casterId: player.id, skillId, position: { ...player.position } });
    this.sockets.get(player.id)?.emit("player", player);
  }

  // Attach a status effect to a monster, replacing the same-kind effect if
  // any (so multiple burns from the same skill don't stack indefinitely).
  private applySkillEffect(monster: MonsterState, apply: import("@mmorpg/shared").SkillStatusApply | undefined, now: number): void {
    if (!apply) return;
    const effects = monster.activeEffects ?? [];
    const filtered = effects.filter((e) => e.kind !== apply.kind);
    filtered.push({
      kind: apply.kind,
      endsAt: now + apply.durationMs,
      tickDamage: apply.tickDamage,
      lastTickAt: apply.tickDamage ? now : undefined,
      slowMultiplier: apply.slowMultiplier
    });
    monster.activeEffects = filtered;
  }

  // Per-tick processing of status effects: apply DOT damage, expire timers,
  // and remove dead monsters.
  private updateStatusEffects(now: number): void {
    for (const monster of this.monsters) {
      if (!monster.activeEffects || monster.activeEffects.length === 0) continue;
      if (monster.respawnsAt) {
        monster.activeEffects = [];
        continue;
      }
      const remaining: typeof monster.activeEffects = [];
      for (const eff of monster.activeEffects) {
        if (now >= eff.endsAt) continue; // expired
        // DOT: tick every 1 second.
        if (eff.tickDamage && now - (eff.lastTickAt ?? 0) >= 1000) {
          monster.hp = Math.max(0, monster.hp - eff.tickDamage);
          eff.lastTickAt = now;
          this.emitFloating(monster.id, monster.position, eff.tickDamage, "damage", `${eff.tickDamage} ${eff.kind === "burn" ? "🔥" : "🩸"}`);
          if (monster.hp <= 0) {
            // Credit kill to the most recent attacker via existing system.
            const player = monster.targetPlayerId ? this.players.get(monster.targetPlayerId) : undefined;
            if (player) this.killMonster(player, monster, now);
            else {
              monster.respawnsAt = now + monster.respawnDurationMs;
              monster.velocity = { x: 0, y: 0 };
            }
          }
        }
        remaining.push(eff);
      }
      monster.activeEffects = remaining;
    }
  }

  private grantExpAndStatPoints(player: PlayerState, exp: number): boolean {
    const previousLevel = player.stats.level;
    // Stack VIP (+20%) and guild perk/boost EXP multipliers.
    let mult = isVipActive(player.vipUntil) ? VIP_EXP_MULTIPLIER : 1;
    mult *= this.guildExpMultiplier(player);
    if (isXpBoostActive(player.xpBoostUntil)) mult *= XP_BOOST_MULTIPLIER;
    const boosted = mult === 1 ? exp : Math.round(exp * mult);
    const result = grantExp(player.stats, boosted);
    player.stats = result.stats;
    const levelsGained = Math.max(0, player.stats.level - previousLevel);
    if (levelsGained > 0) {
      player.unspentPoints += levelsGained * STAT_POINTS_PER_LEVEL;
      player.talentPoints = (player.talentPoints ?? 0) + levelsGained * TALENT_POINTS_PER_LEVEL;
    }
    return levelsGained > 0;
  }

  private checkLevelAchievements(player: PlayerState): void {
    if (player.stats.level >= 5) this.unlockAchievement(player, "reach-level-5");
    if (player.stats.level >= 10) this.unlockAchievement(player, "reach-level-10");
    if (player.stats.level >= 20) this.unlockAchievement(player, "reach-level-20");
  }

  // Sprint 196: unlock collection achievements once the player owns enough
  // pets / cosmetics.
  private checkCollectionAchievements(player: PlayerState): void {
    if ((player.ownedPets?.length ?? 0) >= 6) this.unlockAchievement(player, "pet-collector");
    if ((player.cosmetics?.length ?? 0) >= 6) this.unlockAchievement(player, "cosmetic-collector");
  }

  private unlockAchievement(player: PlayerState, achievementId: string): boolean {
    if (player.achievements.includes(achievementId)) return false;
    const achievement = achievementById(achievementId);
    if (!achievement) return false;
    player.achievements.push(achievement.id);
    this.sockets.get(player.id)?.emit("achievementUnlocked", achievement);
    // Sprint 198: broadcast prestige achievements server-wide for hype.
    const PRESTIGE = new Set(["slay-boss", "apex-smith", "streak-master", "pet-collector", "cosmetic-collector", "raid-slayer", "beast-master", "pvp-champion"]);
    if (PRESTIGE.has(achievement.id)) {
      this.io.emit("system", `🎉 ${player.accountName} vừa mở thành tựu «${achievement.title}»!`);
    }
    // Grant the one-time reward (Sprint 67), if any.
    const reward = achievement.reward;
    if (reward && (reward.gold || reward.gems)) {
      if (reward.gold) player.stats.gold += reward.gold;
      if (reward.gems) player.gems = (player.gems ?? 0) + reward.gems;
      this.sockets.get(player.id)?.emit("player", player);
      const parts = [reward.gold ? `${reward.gold} vàng` : "", reward.gems ? `${reward.gems} 💎` : ""].filter(Boolean).join(" + ");
      this.sockets.get(player.id)?.emit("system", `🏅 Thành tựu «${achievement.title}» — thưởng ${parts}.`);
    }
    this.markDirty(player);
    return true;
  }

  private damageMonster(player: PlayerState, monster: MonsterState, attackMultiplier: number, now: number, label?: string): void {
    // Sprint 162: rage potion amplifies all outgoing damage while active.
    const rageMult = isRageActive(player.rageUntil) ? RAGE_MULTIPLIER : 1;
    const result = rollDamage(player.stats.attack * attackMultiplier * rageMult, monster.defense, player.stats.level - monster.level);
    monster.hp = Math.max(0, monster.hp - result.damage);
    const text = label ? `${result.damage} ${label}${result.crit ? " crit" : ""}` : result.crit ? `${result.damage} crit` : undefined;
    this.emitFloating(monster.id, monster.position, result.damage, "damage", text);
    if (monster.hp <= 0) this.killMonster(player, monster, now);
  }

  private killMonster(player: PlayerState, monster: MonsterState, now: number): void {
    monster.respawnsAt = now + monster.respawnDurationMs;
    monster.velocity = { x: 0, y: 0 };
    monster.targetPlayerId = undefined;
    this.returningToSpawn.delete(monster.id);

    const exp = Math.floor((28 + monster.level * 18) * rewardMultiplier(monster));
    let goldMult = isVipActive(player.vipUntil) ? VIP_GOLD_MULTIPLIER : 1;
    goldMult *= this.guildGoldMultiplier(player);
    if (isGoldBoostActive(player.goldBoostUntil)) goldMult *= GOLD_BOOST_MULTIPLIER;
    if (isHappyHourActive(this.happyHourUntil)) goldMult *= HAPPY_HOUR_MULTIPLIER;
    let gold = goldForMonster(monster);
    if (goldMult !== 1) gold = Math.round(gold * goldMult);
    player.stats.gold += gold;
    for (const recipient of this.expRecipientsFor(player)) {
      const leveled = this.grantExpAndStatPoints(recipient, exp);
      if (leveled) this.updateReachLevelQuests(recipient);
      if (leveled) this.checkLevelAchievements(recipient);
      this.emitFloating(recipient.id, recipient.position, exp, "exp", `+${exp} exp`);
      if (leveled) this.emitFloating(recipient.id, recipient.position, recipient.stats.level, "level", `Level ${recipient.stats.level}`);
      if (recipient.id !== player.id) {
        this.sockets.get(recipient.id)?.emit("player", recipient);
        this.markDirty(recipient);
      }
    }
    this.updateQuestProgressForKill(player, monster);
    player.totalKills = (player.totalKills ?? 0) + 1;
    // Battle Pass exp from kills — silently accrue, leveling auto.
    this.grantBattlePassExp(player, BATTLE_PASS_EXP_PER_KILL);
    this.unlockAchievement(player, "first-blood");
    if (player.totalKills >= 100) this.unlockAchievement(player, "kill-100");
    if (player.totalKills >= 500) this.unlockAchievement(player, "kill-500");
    if (monster.level >= 8) this.unlockAchievement(player, "deep-explorer");
    if (monster.elite) this.unlockAchievement(player, "slay-elite");
    if (monster.boss && monster.type === "eternalWarden") this.unlockAchievement(player, "slay-boss");
    if (monster.boss && monster.type !== "eternalWarden") this.unlockAchievement(player, "slay-dungeon-boss");
    this.emitFloating(player.id, player.position, gold, "loot", `+${gold} gold`);

    const lootItem = createLoot(monster.level, monster.type, monster.elite || monster.boss, monster.boss);
    let collectedItem: Item | undefined;
    if (lootItem) {
      if (this.tryAutoSalvage(player, lootItem)) {
        // Sprint 176: auto-salvaged on pickup; nothing added to the bag.
      } else if (isBagFull(player)) {
        this.sockets.get(player.id)?.emit("system", BAG_FULL_MESSAGE);
      } else {
        collectedItem = lootItem;
        player.inventory.items.push(lootItem);
        this.emitFloating(player.id, player.position, 0, "loot", lootItem.name);
        if (lootItem.rarity === "rare" || lootItem.rarity === "epic") {
          this.io.emit("announce", {
            accountName: player.accountName,
            itemName: lootItem.name,
            rarity: lootItem.rarity
          });
        }
        if (lootItem.rarity === "epic") this.unlockAchievement(player, "epic-find");
      }
    }
    if (monster.boss) {
      this.io.emit("bossAnnounce", { kind: "defeat", bossName: monster.name, accountName: player.accountName });
      // World boss guarantees a Mount Pendant if the player still has bag space.
      if (monster.type === "eternalWarden" && !isBagFull(player)) {
        const mount: EquipmentItem = {
          id: `mount-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: "equipment",
          name: "Bùa Cưỡi Gió",
          rarity: "epic",
          slot: "ring",
          stats: { speed: 25, attack: 4, maxHp: 30 },
          value: 600
        };
        player.inventory.items.push(mount);
        this.sockets.get(player.id)?.emit("system", "Bạn nhận được Bùa Cưỡi Gió (+25% tốc độ).");
        this.emitFloating(player.id, player.position, 0, "loot", mount.name);
        this.unlockAchievement(player, "mount-rider");
        // Warden's Heart — endgame crafting material.
        const heart: MaterialItem = {
          id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: "material",
          materialId: "wardenHeart",
          name: MATERIAL_CATALOG.wardenHeart.name,
          rarity: "epic",
          value: MATERIAL_CATALOG.wardenHeart.value
        };
        if (!isBagFull(player)) {
          player.inventory.items.push(heart);
          this.sockets.get(player.id)?.emit("system", "Nhặt được Trái Tim Hộ Pháp.");
          this.emitFloating(player.id, player.position, 0, "loot", heart.name);
        }
      }
    }
    // Material drop: 30% chance per kill (50% for elite, 100% for boss).
    this.tryDropMaterial(player, monster);
    this.sockets.get(player.id)?.emit("loot", { playerId: player.id, gold, item: collectedItem });
    this.tryAutoRetarget(player);
    this.emitQuestList(player);

    this.sockets.get(player.id)?.emit("player", player);
    this.markDirty(player);
  }

  private tryDropMaterial(player: PlayerState, monster: MonsterState): void {
    const materialId = materialDropForMonster(monster.type);
    if (!materialId) return;
    const chance = monster.boss ? 1 : monster.elite ? 0.5 : 0.3;
    if (Math.random() > chance) return;
    if (isBagFull(player)) {
      this.sockets.get(player.id)?.emit("system", BAG_FULL_MESSAGE);
      return;
    }
    const info = MATERIAL_CATALOG[materialId];
    const item: MaterialItem = {
      id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: "material",
      materialId,
      name: info.name,
      rarity: info.rarity,
      value: info.value
    };
    player.inventory.items.push(item);
    this.emitFloating(player.id, player.position, 0, "loot", info.name);
  }

  // Re-roll stats on a rare/epic equipment item the player owns.
  // Cost: 3x crystalShard if rare, 5x voidAsh if epic. Each successful
  // enchantment randomises stat values within ~30% of original budget.
  private enchantItem(player: PlayerState, itemId: string): void {
    const idx = player.inventory.items.findIndex((it) => it.id === itemId);
    if (idx < 0) {
      this.sockets.get(player.id)?.emit("system", "Không tìm thấy vật phẩm trong túi.");
      return;
    }
    const item = player.inventory.items[idx];
    if (item.kind !== "equipment") {
      this.sockets.get(player.id)?.emit("system", "Chỉ tinh luyện được trang bị.");
      return;
    }
    if (item.rarity !== "rare" && item.rarity !== "epic") {
      this.sockets.get(player.id)?.emit("system", "Chỉ tinh luyện được trang bị Hiếm hoặc Sử Thi.");
      return;
    }
    const requiredMaterial: MaterialId = item.rarity === "epic" ? "voidAsh" : "crystalShard";
    const requiredQty = item.rarity === "epic" ? 5 : 3;
    const matIndices = player.inventory.items
      .map((it, i) => it.kind === "material" && (it as MaterialItem).materialId === requiredMaterial ? i : -1)
      .filter((i) => i >= 0);
    if (matIndices.length < requiredQty) {
      this.sockets.get(player.id)?.emit("system", `Cần ${requiredQty} ${MATERIAL_CATALOG[requiredMaterial].name} để tinh luyện.`);
      return;
    }
    // Consume materials (descending index).
    const toRemove = matIndices.slice(0, requiredQty).sort((a, b) => b - a);
    for (const i of toRemove) player.inventory.items.splice(i, 1);
    // Re-roll stats: keep slot/rarity/name, multiply each existing stat by
    // a per-stat random factor between 0.7 and 1.3 to deliver variance.
    const newStats: { attack?: number; defense?: number; maxHp?: number; speed?: number } = {};
    if (item.stats.attack) newStats.attack = Math.max(1, Math.round(item.stats.attack * (0.7 + Math.random() * 0.6)));
    if (item.stats.defense) newStats.defense = Math.max(1, Math.round(item.stats.defense * (0.7 + Math.random() * 0.6)));
    if (item.stats.maxHp) newStats.maxHp = Math.max(1, Math.round(item.stats.maxHp * (0.7 + Math.random() * 0.6)));
    if (item.stats.speed) newStats.speed = Math.max(1, Math.round(item.stats.speed * (0.7 + Math.random() * 0.6)));
    // If the item is currently equipped, refresh derived stats.
    const equippedItem = player.inventory.equipped[item.slot];
    const isEquipped = equippedItem?.id === item.id;
    if (isEquipped && equippedItem) {
      removeItemStats(player, equippedItem);
    }
    item.stats = newStats;
    item.enchantCount = (item.enchantCount ?? 0) + 1;
    if (isEquipped) addItemStats(player, item);
    this.unlockAchievement(player, "enchanter");
    this.sockets.get(player.id)?.emit("player", player);
    this.sockets.get(player.id)?.emit("system", `Đã tinh luyện ${item.name} (lần ${item.enchantCount}).`);
    this.emitFloating(player.id, player.position, 0, "loot", `+Tinh luyện`);
    this.markDirty(player);
  }

  // Salvage (Phân Giải): dismantle an unequipped equipment item into crafting
  // materials by rarity. Cannot salvage the item you're wearing.
  private salvageItem(player: PlayerState, itemId: string): void {
    const idx = player.inventory.items.findIndex((it) => it.id === itemId);
    if (idx < 0) {
      this.sockets.get(player.id)?.emit("system", "Không tìm thấy vật phẩm trong túi.");
      return;
    }
    const item = player.inventory.items[idx];
    if (item.kind !== "equipment") {
      this.sockets.get(player.id)?.emit("system", "Chỉ phân giải được trang bị.");
      return;
    }
    if (player.inventory.equipped[item.slot]?.id === item.id) {
      this.sockets.get(player.id)?.emit("system", "Hãy tháo trang bị trước khi phân giải.");
      return;
    }
    if (item.locked) {
      this.sockets.get(player.id)?.emit("system", "🔒 Vật phẩm đang khóa — mở khóa trước khi phân giải.");
      return;
    }
    // Remove the gear, then grant salvage materials by rarity.
    player.inventory.items.splice(idx, 1);
    const yields = salvageYield(item.rarity);
    const granted: string[] = [];
    for (const [matId, qty] of Object.entries(yields) as [MaterialId, number][]) {
      const info = MATERIAL_CATALOG[matId];
      for (let n = 0; n < qty; n += 1) {
        const mat: MaterialItem = {
          id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${n}`,
          kind: "material",
          materialId: matId,
          name: info.name,
          rarity: info.rarity,
          value: info.value
        };
        player.inventory.items.push(mat);
      }
      granted.push(`${qty}x ${info.name}`);
    }
    this.unlockAchievement(player, "salvager");
    this.bumpQuestProgress(player, ["salvageGear"]);
    this.sockets.get(player.id)?.emit("player", player);
    this.sockets.get(player.id)?.emit("system", `Đã phân giải ${item.name} → ${granted.join(", ")}.`);
    this.emitFloating(player.id, player.position, 0, "loot", "Phân giải");
    this.markDirty(player);
  }

  // Sprint 155: spend gold to enhance an equipment item to "+N". Each success
  // raises every stat ~10% (min +1). Early levels are guaranteed; high levels
  // can fail (gold lost, item kept) so it stays a long-term gold sink.
  private upgradeItem(player: PlayerState, itemId: string): void {
    const idx = player.inventory.items.findIndex((it) => it.id === itemId);
    if (idx < 0) {
      this.sockets.get(player.id)?.emit("system", "Không tìm thấy vật phẩm trong túi.");
      return;
    }
    const item = player.inventory.items[idx];
    if (item.kind !== "equipment") {
      this.sockets.get(player.id)?.emit("system", "Chỉ cường hóa được trang bị.");
      return;
    }
    const plus = item.plusLevel ?? 0;
    const cost = upgradeCost(plus);
    if (player.stats.gold < cost) {
      this.sockets.get(player.id)?.emit("system", `Cần ${cost.toLocaleString("vi-VN")} vàng để cường hóa +${plus + 1}.`);
      return;
    }
    player.stats.gold -= cost;
    const equipped = player.inventory.equipped[item.slot];
    const isEquipped = equipped?.id === item.id;
    if (isEquipped && equipped) removeItemStats(player, equipped);
    const success = Math.random() < upgradeSuccessChance(plus);
    if (success) {
      const s = item.stats;
      if (s.attack) s.attack = Math.max(s.attack + 1, Math.round(s.attack * 1.1));
      if (s.defense) s.defense = Math.max(s.defense + 1, Math.round(s.defense * 1.1));
      if (s.maxHp) s.maxHp = Math.max(s.maxHp + 1, Math.round(s.maxHp * 1.1));
      if (s.speed) s.speed = Math.max(s.speed + 1, Math.round(s.speed * 1.1));
      item.plusLevel = plus + 1;
      this.unlockAchievement(player, "enhancer");
      this.bumpQuestProgress(player, ["upgradeGear"]);
    }
    if (isEquipped) addItemStats(player, item);
    this.sockets.get(player.id)?.emit("player", player);
    if (success) {
      this.sockets.get(player.id)?.emit("system", `✨ Cường hóa thành công! ${item.name} giờ là +${item.plusLevel}.`);
      this.emitFloating(player.id, player.position, 0, "loot", `+${item.plusLevel} THÀNH CÔNG`);
    } else {
      this.sockets.get(player.id)?.emit("system", `💢 Cường hóa thất bại — mất ${cost.toLocaleString("vi-VN")} vàng, trang bị giữ nguyên +${plus}.`);
      this.emitFloating(player.id, player.position, 0, "loot", `THẤT BẠI`);
    }
    this.markDirty(player);
  }

  // Sprint 176: loot filter — auto-dismantle freshly-dropped gear at or below
  // the player's threshold into materials, returning true if it was consumed.
  private tryAutoSalvage(player: PlayerState, item: Item): boolean {
    if (item.kind !== "equipment") return false;
    const setting = player.autoSalvageRarity ?? "off";
    if (setting === "off") return false;
    const qualifies = item.rarity === "common" || (setting === "rare" && item.rarity === "rare");
    if (!qualifies) return false;
    for (const [matId, qty] of Object.entries(salvageYield(item.rarity)) as [MaterialId, number][]) {
      const info = MATERIAL_CATALOG[matId];
      for (let n = 0; n < qty; n += 1) {
        player.inventory.items.push({
          id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${n}`,
          kind: "material", materialId: matId, name: info.name, rarity: info.rarity, value: info.value
        });
      }
    }
    this.emitFloating(player.id, player.position, 0, "loot", "Tự phân giải");
    return true;
  }

  // Sprint 152: salvage every unequipped, UNLOCKED equipment item matching a
  // rarity filter ("junk" = common + uncommon) in one action. Respects the
  // Sprint 151 item lock so prized gear is never mass-dismantled.
  private salvageAll(player: PlayerState, filter: string): void {
    const matches = (r: Rarity): boolean =>
      filter === "junk" ? r === "common" : r === filter;
    const targets = player.inventory.items.filter(
      (it) => it.kind === "equipment" && !it.locked && matches(it.rarity) &&
        player.inventory.equipped[(it as EquipmentItem).slot]?.id !== it.id
    );
    if (targets.length === 0) {
      this.sockets.get(player.id)?.emit("system", "Không có trang bị phù hợp để phân giải hàng loạt.");
      return;
    }
    const totals: Partial<Record<MaterialId, number>> = {};
    for (const it of targets) {
      const idx = player.inventory.items.findIndex((x) => x.id === it.id);
      if (idx >= 0) player.inventory.items.splice(idx, 1);
      for (const [matId, qty] of Object.entries(salvageYield(it.rarity)) as [MaterialId, number][]) {
        totals[matId] = (totals[matId] ?? 0) + qty;
      }
    }
    const granted: string[] = [];
    for (const [matId, qty] of Object.entries(totals) as [MaterialId, number][]) {
      const info = MATERIAL_CATALOG[matId];
      for (let n = 0; n < qty; n += 1) {
        player.inventory.items.push({
          id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${n}`,
          kind: "material", materialId: matId, name: info.name, rarity: info.rarity, value: info.value
        });
      }
      granted.push(`${qty}x ${info.name}`);
    }
    this.unlockAchievement(player, "salvager");
    this.unlockAchievement(player, "recycler");
    for (let i = 0; i < targets.length; i += 1) this.bumpQuestProgress(player, ["salvageGear"]);
    this.sockets.get(player.id)?.emit("player", player);
    this.sockets.get(player.id)?.emit("system", `Đã phân giải ${targets.length} trang bị → ${granted.join(", ")}.`);
    this.emitFloating(player.id, player.position, 0, "loot", `Phân giải x${targets.length}`);
    this.markDirty(player);
  }

  // Sprint 181: fuse 3 unequipped, unlocked COMMON equipment items into one
  // rare-or-better piece — a gear sink with an upgrade-gamble payoff.
  private fuseGear(player: PlayerState): void {
    const commons = player.inventory.items.filter(
      (it) => it.kind === "equipment" && it.rarity === "common" && !it.locked &&
        player.inventory.equipped[(it as EquipmentItem).slot]?.id !== it.id
    );
    if (commons.length < 3) {
      this.sockets.get(player.id)?.emit("system", `Cần 3 trang bị Thường (chưa khóa, chưa mặc) để hợp nhất — đang có ${commons.length}.`);
      return;
    }
    if (isBagFull(player)) {
      this.sockets.get(player.id)?.emit("system", BAG_FULL_MESSAGE);
      return;
    }
    // Consume the 3 cheapest commons (descending index for safe splice).
    const victims = commons.slice(0, 3);
    const indices = victims.map((v) => player.inventory.items.findIndex((x) => x.id === v.id)).sort((a, b) => b - a);
    for (const idx of indices) if (idx >= 0) player.inventory.items.splice(idx, 1);
    // Roll a rare-or-better item; force rare if RNG keeps rolling common.
    let fused: Item | undefined;
    for (let i = 0; i < 12 && !fused; i += 1) {
      const cand = createLoot(player.stats.level, "emberSprite", false, true);
      if (cand && cand.kind === "equipment" && (cand.rarity === "rare" || cand.rarity === "epic")) fused = cand;
    }
    if (!fused) {
      const cand = createLoot(player.stats.level, "emberSprite", false, true);
      if (cand && cand.kind === "equipment") { cand.rarity = "rare"; fused = cand; }
    }
    if (!fused || fused.kind !== "equipment") {
      this.sockets.get(player.id)?.emit("system", "Hợp nhất thất bại — thử lại.");
      return;
    }
    player.inventory.items.push(fused);
    this.unlockAchievement(player, "fusionist");
    this.sockets.get(player.id)?.emit("player", player);
    this.sockets.get(player.id)?.emit("system", `🔮 Hợp nhất thành công: ${fused.name} (${fused.rarity === "epic" ? "Sử Thi" : "Hiếm"})!`);
    this.emitFloating(player.id, player.position, 0, "loot", fused.name);
    this.markDirty(player);
  }

  // Sprint 171: brew an HP potion from materials, mirroring craftRecipe's
  // material-consumption logic but producing a consumable.
  private brewPotion(player: PlayerState, recipeId: string): void {
    const recipe = getBrewRecipe(recipeId);
    if (!recipe) {
      this.sockets.get(player.id)?.emit("system", "Công thức luyện đan không tồn tại.");
      return;
    }
    const needed = new Map(Object.entries(recipe.cost) as [MaterialId, number][]);
    const indexByMaterial = new Map<MaterialId, number[]>();
    const owned = new Map<MaterialId, number>();
    player.inventory.items.forEach((item, idx) => {
      if (item.kind !== "material") return;
      const m = item as MaterialItem;
      owned.set(m.materialId, (owned.get(m.materialId) ?? 0) + 1);
      const arr = indexByMaterial.get(m.materialId) ?? [];
      arr.push(idx);
      indexByMaterial.set(m.materialId, arr);
    });
    for (const [mid, qty] of needed) {
      if ((owned.get(mid) ?? 0) < qty) {
        this.sockets.get(player.id)?.emit("system", `Thiếu ${MATERIAL_CATALOG[mid].name} (${owned.get(mid) ?? 0}/${qty}).`);
        return;
      }
    }
    if (isBagFull(player)) {
      this.sockets.get(player.id)?.emit("system", BAG_FULL_MESSAGE);
      return;
    }
    const toRemove: number[] = [];
    for (const [mid, qty] of needed) {
      const arr = indexByMaterial.get(mid)!;
      for (let i = 0; i < qty; i += 1) toRemove.push(arr[i]);
    }
    toRemove.sort((a, b) => b - a);
    for (const idx of toRemove) player.inventory.items.splice(idx, 1);
    player.inventory.items.push({
      id: `potion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: "consumable",
      name: recipe.name,
      rarity: "common",
      value: recipe.value,
      heal: recipe.heal
    });
    this.sockets.get(player.id)?.emit("player", player);
    this.unlockAchievement(player, "alchemist");
    this.sockets.get(player.id)?.emit("system", `⚗️ Luyện đan thành công: ${recipe.name} (+${recipe.heal} HP).`);
    this.emitFloating(player.id, player.position, 0, "loot", recipe.name);
    this.markDirty(player);
  }

  private craftRecipe(player: PlayerState, recipeId: string): void {
    const recipe = getRecipe(recipeId);
    if (!recipe) {
      this.sockets.get(player.id)?.emit("system", "Công thức không tồn tại.");
      return;
    }
    // Verify the player has the required materials.
    const needed = new Map(Object.entries(recipe.cost) as [MaterialId, number][]);
    const owned = new Map<MaterialId, number>();
    const indexByMaterial = new Map<MaterialId, number[]>();
    player.inventory.items.forEach((item, idx) => {
      if (item.kind !== "material") return;
      const m = item as MaterialItem;
      owned.set(m.materialId, (owned.get(m.materialId) ?? 0) + 1);
      const arr = indexByMaterial.get(m.materialId) ?? [];
      arr.push(idx);
      indexByMaterial.set(m.materialId, arr);
    });
    for (const [mid, qty] of needed) {
      if ((owned.get(mid) ?? 0) < qty) {
        const info = MATERIAL_CATALOG[mid];
        this.sockets.get(player.id)?.emit("system", `Thiếu ${info.name} (${owned.get(mid) ?? 0}/${qty}).`);
        return;
      }
    }
    if (isBagFull(player)) {
      this.sockets.get(player.id)?.emit("system", BAG_FULL_MESSAGE);
      return;
    }
    // Consume materials: collect indices to remove, sorted descending.
    const toRemove: number[] = [];
    for (const [mid, qty] of needed) {
      const arr = indexByMaterial.get(mid)!;
      for (let i = 0; i < qty; i += 1) toRemove.push(arr[i]);
    }
    toRemove.sort((a, b) => b - a);
    for (const idx of toRemove) player.inventory.items.splice(idx, 1);
    // Produce the equipment item via createLoot with guaranteed=true.
    const crafted = createLoot(recipe.level, recipe.themeFrom, false, true);
    if (!crafted || crafted.kind !== "equipment") {
      this.sockets.get(player.id)?.emit("system", "Lò rèn nguội — thử lại sau.");
      return;
    }
    // Override the loot's slot, rarity, and name to match the recipe.
    crafted.name = recipe.name;
    crafted.rarity = recipe.rarity;
    crafted.slot = recipe.slot;
    player.inventory.items.push(crafted);
    this.sockets.get(player.id)?.emit("system", `Chế tạo thành công: ${crafted.name}.`);
    this.emitFloating(player.id, player.position, 0, "loot", crafted.name);
    this.sockets.get(player.id)?.emit("player", player);
    this.markDirty(player);
    this.bumpQuestProgress(player, ["craftItem"]);
    player.itemsCrafted = (player.itemsCrafted ?? 0) + 1;
    if (player.itemsCrafted >= 5) this.unlockAchievement(player, "craft-master");
    // Sprint 159: apex recipes unlock the master smith achievement.
    if (["abyssal-greatsword", "dragonscale-plate", "eternal-signet", "abyssal-crown", "dragonstride-boots"].includes(recipe.id)) {
      this.unlockAchievement(player, "apex-smith");
    }
  }

  private updateRespawns(now: number): void {
    for (const monster of this.monsters) {
      if (!monster.respawnsAt || monster.respawnsAt > now) continue;
      monster.hp = monster.maxHp;
      monster.position = { ...monster.spawn };
      monster.respawnsAt = undefined;
      this.returningToSpawn.delete(monster.id);
      if (monster.boss) {
        resetBoss(monster);
        this.io.emit("bossAnnounce", { kind: "spawn", bossName: monster.name });
      } else {
        rerollMonsterRank(monster);
      }
    }
  }

  private updateQuestProgressForKill(player: PlayerState, monster: MonsterState): void {
    const active = this.activeQuests.get(player.id);
    if (!active) return;
    for (const entry of active) {
      const template = questById(entry.questId);
      if (!template || isQuestComplete(entry, template)) continue;
      const obj = template.objective;
      if (obj.kind === "killAny") entry.progress = Math.min(template.required, entry.progress + 1);
      else if (obj.kind === "killLevel" && monster.level >= obj.minLevel) entry.progress = Math.min(template.required, entry.progress + 1);
      else if (obj.kind === "killSpecific" && monster.type === obj.monsterType) entry.progress = Math.min(template.required, entry.progress + 1);
    }
  }

  // Auto-give tutorial quests to brand-new players, and refresh daily quests
  // when 24h has elapsed since last roll.
  private initQuestsForPlayer(player: PlayerState): void {
    const active = this.activeQuests.get(player.id) ?? [];
    // Tutorial — given once per character.
    if (!player.tutorialGiven) {
      for (const id of TUTORIAL_QUEST_IDS) {
        if (active.find((entry) => entry.questId === id)) continue;
        const template = questById(id);
        if (!template) continue;
        active.push({ questId: id, progress: initialQuestProgress(template, player) });
      }
      player.tutorialGiven = true;
    }
    // Daily — pick fresh ones if expired or missing.
    const now = Date.now();
    const needsReset = !player.dailyResetAt || now - player.dailyResetAt >= DAILY_RESET_INTERVAL_MS;
    if (needsReset || !player.dailyQuestIds || player.dailyQuestIds.length === 0) {
      const pool = [...DAILY_QUEST_POOL];
      // Simple Fisher-Yates shuffle.
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const fresh = pool.slice(0, DAILY_QUESTS_PER_DAY);
      // Drop yesterday's daily entries from active.
      const stale = new Set(player.dailyQuestIds ?? []);
      const filtered = active.filter((entry) => !stale.has(entry.questId));
      // Auto-accept fresh daily quests so the player sees them immediately.
      for (const id of fresh) {
        const template = questById(id);
        if (!template) continue;
        filtered.push({ questId: id, progress: initialQuestProgress(template, player) });
      }
      this.activeQuests.set(player.id, filtered);
      player.dailyQuestIds = fresh;
      player.dailyResetAt = now;
    } else {
      this.activeQuests.set(player.id, active);
    }
    this.markDirty(player);
  }

  // Generic progress hook for non-kill objectives (chest, learnSkill, equip, craft).
  private bumpQuestProgress(player: PlayerState, kinds: QuestObjective["kind"][], extra?: { rarity?: "rare" | "epic" }): void {
    const active = this.activeQuests.get(player.id);
    if (!active) return;
    let changed = false;
    for (const entry of active) {
      const template = questById(entry.questId);
      if (!template || isQuestComplete(entry, template)) continue;
      const obj = template.objective;
      if (!kinds.includes(obj.kind)) continue;
      if (obj.kind === "equipRarity") {
        const want = obj.rarity;
        if (!extra?.rarity) continue;
        // Equipping epic also satisfies the rare quest.
        const matches = want === "rare" ? (extra.rarity === "rare" || extra.rarity === "epic") : extra.rarity === "epic";
        if (!matches) continue;
      }
      entry.progress = Math.min(template.required, entry.progress + 1);
      changed = true;
    }
    if (changed) this.emitQuestList(player);
  }

  private updateReachLevelQuests(player: PlayerState): void {
    const active = this.activeQuests.get(player.id);
    if (!active) return;
    for (const entry of active) {
      const template = questById(entry.questId);
      if (template?.objective.kind === "reachLevel") {
        entry.progress = Math.min(template.required, player.stats.level);
      }
    }
  }

  private emitQuestList(player: PlayerState): void {
    this.updateReachLevelQuests(player);
    this.sockets.get(player.id)?.emit("questList", questListFor(player, this.activeQuests.get(player.id) ?? []));
  }

  private getParty(playerId: string): Party | undefined {
    const partyId = this.playerParty.get(playerId);
    return partyId ? this.parties.get(partyId) : undefined;
  }

  private expRecipientsFor(killer: PlayerState): PlayerState[] {
    const party = this.getParty(killer.id);
    if (!party) return [killer];
    const recipients: PlayerState[] = [];
    for (const id of party.memberIds) {
      const member = this.players.get(id);
      if (!member) continue;
      if (member.id === killer.id || distance(killer.position, member.position) <= PARTY_SHARE_RANGE) {
        recipients.push(member);
      }
    }
    if (!recipients.some((member) => member.id === killer.id)) recipients.push(killer);
    return recipients;
  }

  private partyView(party: Party): PartyView {
    return {
      id: party.id,
      leaderId: party.leaderId,
      members: party.memberIds.map((id) => {
        const member = this.players.get(id);
        return {
          id,
          accountName: member?.accountName ?? "?",
          level: member?.stats.level ?? 1,
          hp: member?.stats.hp ?? 0,
          maxHp: member?.stats.maxHp ?? 1,
          isLeader: id === party.leaderId
        };
      })
    };
  }

  private emitPartyUpdate(party: Party): void {
    const view = this.partyView(party);
    for (const id of party.memberIds) this.sockets.get(id)?.emit("partyUpdate", view);
  }

  private removeFromParty(playerId: string): void {
    this.pendingInvites.delete(playerId);
    const partyId = this.playerParty.get(playerId);
    if (!partyId) return;
    this.playerParty.delete(playerId);
    const party = this.parties.get(partyId);
    if (!party) return;
    party.memberIds = party.memberIds.filter((id) => id !== playerId);
    if (party.leaderId === playerId) party.leaderId = party.memberIds[0] ?? "";
    if (party.memberIds.length <= 1) {
      for (const remaining of party.memberIds) {
        this.playerParty.delete(remaining);
        this.sockets.get(remaining)?.emit("partyUpdate", null);
        this.sockets.get(remaining)?.emit("system", "Tổ đội đã giải tán.");
      }
      this.parties.delete(party.id);
    } else {
      this.emitPartyUpdate(party);
    }
  }

  private cleanupGroundItems(now: number): void {
    for (const [id, groundItem] of this.groundItems) {
      if (groundItem.droppedBy === TREASURE_DROPPED_BY) continue;
      if (now - groundItem.createdAt > GROUND_ITEM_TTL_MS) this.groundItems.delete(id);
    }
  }

  private findMonsterTarget(monster: MonsterState): PlayerState | undefined {
    let best: PlayerState | undefined;
    let bestDistance = monster.aggroRadius;
    for (const player of this.players.values()) {
      if (isInTown(player.position)) continue;
      const d = distance(monster.position, player.position);
      if (d < bestDistance) {
        best = player;
        bestDistance = d;
      }
    }
    return best;
  }

  private selectedLivingMonster(player: PlayerState): MonsterState | undefined {
    if (!player.targetId) return undefined;
    const target = this.monsters.find((monster) => monster.id === player.targetId && !monster.respawnsAt);
    return target?.hp && target.hp > 0 ? target : undefined;
  }

  private tryAutoRetarget(player: PlayerState): MonsterState | undefined {
    const selectedMonster = player.targetId ? this.monsters.find((monster) => monster.id === player.targetId) : undefined;
    const previousTargetId = player.targetId;
    if (!selectedMonster || !this.autoRetarget.get(player.id)) {
      player.targetId = undefined;
      if (player.targetId !== previousTargetId) this.sockets.get(player.id)?.emit("player", player);
      return undefined;
    }

    let best: MonsterState | undefined;
    let bestDistance = AUTO_RETARGET_RANGE;
    for (const monster of this.monsters) {
      if (monster.id === selectedMonster.id || monster.respawnsAt || monster.hp <= 0) continue;
      const d = distance(player.position, monster.position);
      if (d <= bestDistance) {
        best = monster;
        bestDistance = d;
      }
    }
    player.targetId = best?.id;
    if (player.targetId !== previousTargetId) this.sockets.get(player.id)?.emit("player", player);
    return best;
  }

  private selectedPvpTarget(attacker: PlayerState): PlayerState | undefined {
    if (!attacker.targetId) return undefined;
    // PvP is only allowed when both fighters are in the arena rectangle.
    if (!isInArena(attacker.position)) return undefined;
    const target = this.players.get(attacker.targetId);
    if (!target || target.id === attacker.id) return undefined;
    if (!isInArena(target.position)) return undefined;
    if (distance(attacker.position, target.position) > PLAYER_ATTACK_RANGE) return undefined;
    return target;
  }

  private hitPlayer(attacker: PlayerState, target: PlayerState): void {
    const result = rollDamage(attacker.stats.attack, target.stats.defense, attacker.stats.level - target.stats.level);
    target.stats.hp = Math.max(0, target.stats.hp - result.damage);
    this.emitFloating(target.id, target.position, result.damage, "damage", result.crit ? `${result.damage} crit` : undefined);

    if (target.stats.hp <= 0) {
      target.position = { ...townSpawn };
      target.velocity = { x: 0, y: 0 };
      target.targetId = undefined;
      target.stats.hp = target.stats.maxHp; // full heal on arena death
      attacker.targetId = undefined;
      target.pvpDeaths = (target.pvpDeaths ?? 0) + 1;
      target.arenaStreak = 0;
      this.creditArenaKill(attacker);
      this.sockets.get(target.id)?.emit("system", `Bạn đã bị ${attacker.accountName} hạ tại Đấu Trường.`);
      this.sockets.get(attacker.id)?.emit("system", `Bạn đã hạ ${target.accountName} tại Đấu Trường! +${ARENA_KILL_GOLD} vàng, +${ARENA_KILL_GEMS} 💎 (Kills: ${attacker.pvpKills})`);
      this.io.emit("arenaKill", { killerName: attacker.accountName, victimName: target.accountName });
      this.markDirty(target);
      this.markDirty(attacker);
    }

    this.sockets.get(target.id)?.emit("player", target);
    this.sockets.get(attacker.id)?.emit("player", attacker);
  }

  // Grant battle-pass exp and roll over tier levels. Caps at the catalog max.
  private emitFriendList(player: PlayerState): void {
    const online = new Set([...this.players.values()].map((p) => p.accountName));
    const rows = (player.friends ?? []).map((name) => ({ name, online: online.has(name) }));
    this.sockets.get(player.id)?.emit("friendList", rows);
  }

  /** Build the client-facing view of a guild with live presence info. */
  private guildView(guild: GuildRecord): GuildView {
    const onlineByName = new Map([...this.players.values()].map((p) => [p.accountName, p]));
    // Leader first, then officers, then members; online before offline.
    const rankOrder = { leader: 0, officer: 1, member: 2 } as const;
    const members = [...guild.members]
      .sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank] || a.joinedAt - b.joinedAt)
      .map((m) => {
        const live = onlineByName.get(m.accountName);
        return {
          accountName: m.accountName,
          rank: m.rank,
          level: live?.stats.level ?? 0,
          online: !!live,
          playerClass: live?.playerClass,
          contribution: m.contribution ?? 0
        };
      });
    const exp = guild.exp ?? 0;
    const level = guildLevelForExp(exp);
    const tier = guildTier(level);
    const progress = guildExpProgress(exp);
    return {
      id: guild.id,
      name: guild.name,
      tag: guild.tag,
      motd: guild.motd,
      createdAt: guild.createdAt,
      members,
      maxMembers: tier.maxMembers,
      exp,
      level,
      expInto: progress.into,
      expSpan: progress.span,
      atMaxLevel: progress.atMax,
      expBonus: tier.expBonus,
      goldBonus: tier.goldBonus,
      boostUntil: guild.boostUntil,
      boostActive: isGuildBoostActive(guild.boostUntil),
      bank: guild.bank ?? 0
    };
  }

  // ── Guild perk multipliers (Sprint 57) ──────────────────────────────
  // A player's guild grants a passive EXP/gold bonus by guild level, plus a
  // time-limited Gem boost on top of EXP. Returns 1.0 when not in a guild.
  private guildExpMultiplier(player: PlayerState): number {
    if (!player.guildId) return 1;
    const guild = guildStore.get(player.guildId);
    if (!guild) return 1;
    const tier = guildTier(guildLevelForExp(guild.exp ?? 0));
    const boost = isGuildBoostActive(guild.boostUntil) ? GUILD_BOOST_EXP_BONUS : 0;
    return 1 + tier.expBonus + boost;
  }

  private guildGoldMultiplier(player: PlayerState): number {
    if (!player.guildId) return 1;
    const guild = guildStore.get(player.guildId);
    if (!guild) return 1;
    return 1 + guildTier(guildLevelForExp(guild.exp ?? 0)).goldBonus;
  }

  /** Add EXP to a guild, handle level-ups (announce), and refresh roster. */
  private addGuildExp(guild: GuildRecord, amount: number): void {
    if (amount <= 0) return;
    const before = guildLevelForExp(guild.exp ?? 0);
    guild.exp = (guild.exp ?? 0) + amount;
    const after = guildLevelForExp(guild.exp);
    guild.level = after;
    guildStore.markDirty();
    if (after > before) {
      const tier = guildTier(after);
      this.broadcastGuildSystem(
        guild,
        `Guild đạt cấp ${after}! 🎉 Buff: +${Math.round(tier.expBonus * 100)}% EXP, +${Math.round(tier.goldBonus * 100)}% vàng, ${tier.maxMembers} slot.`
      );
      // Ranking can shift on level-up — refresh everyone's view.
      this.broadcastGuildLeaderboard();
    }
    this.emitGuildUpdate(guild.id);
  }

  // ── Marketplace (Sprint 58/59) ──────────────────────────────────────
  /** Listings as seen by a given viewer (flags their own + featured/net/tax). */
  private marketView(viewerName: string): MarketListingView[] {
    const now = Date.now();
    // Server sends featured-first/newest as the default order; the client can
    // re-sort/filter locally for the browse tab.
    const ordered = sortListings(marketStore.all(), "featured", now);
    return ordered.map((l) => ({
      ...l,
      mine: l.sellerName === viewerName,
      net: marketNet(l.price),
      tax: marketTax(l.price),
      featured: isMarketFeatured(l.featuredUntil, now)
    }));
  }

  /** Push the (viewer-specific) listing book to every online player. */
  private broadcastMarket(): void {
    for (const p of this.players.values()) {
      this.sockets.get(p.id)?.emit("marketUpdate", this.marketView(p.accountName));
    }
  }

  /** Send the fresh roster to every online member of a guild. */
  private emitGuildUpdate(guildId: string): void {
    const guild = guildStore.get(guildId);
    if (!guild) return;
    const view = this.guildView(guild);
    for (const p of this.players.values()) {
      if (p.guildId === guildId) this.sockets.get(p.id)?.emit("guildUpdate", view);
    }
  }

  /** Global guild ranking by level desc → exp desc, top 20 (Sprint 60). */
  private guildLeaderboard(viewerGuildId: string | undefined): GuildLeaderboardRow[] {
    const now = Date.now();
    return guildStore
      .all()
      .sort((a, b) => guildLevelForExp(b.exp ?? 0) - guildLevelForExp(a.exp ?? 0) || (b.exp ?? 0) - (a.exp ?? 0) || a.createdAt - b.createdAt)
      .slice(0, 20)
      .map((g, i) => ({
        rank: i + 1,
        guildId: g.id,
        name: g.name,
        tag: g.tag,
        level: guildLevelForExp(g.exp ?? 0),
        exp: g.exp ?? 0,
        memberCount: g.members.length,
        boostActive: isGuildBoostActive(g.boostUntil, now),
        mine: g.id === viewerGuildId,
        desc: g.desc
      }));
  }

  /** Push the ranking to every online player (after a guild levels up). */
  private broadcastGuildLeaderboard(): void {
    for (const p of this.players.values()) {
      this.sockets.get(p.id)?.emit("guildLeaderboard", this.guildLeaderboard(p.guildId));
    }
  }

  // ── Guild Raid (Sprint 66) ──────────────────────────────────────────
  private guildRaidView(guildId: string): GuildRaidView | null {
    const raid = this.guildRaids.get(guildId);
    if (!raid) return null;
    const contributors = [...raid.contributors.entries()]
      .map(([accountName, damage]) => ({ accountName, damage }))
      .sort((a, b) => b.damage - a.damage);
    return { bossName: raid.bossName, maxHp: raid.maxHp, hp: raid.hp, expiresAt: raid.expiresAt, startedAt: raid.startedAt, contributors };
  }

  private broadcastGuildRaid(guildId: string): void {
    const view = this.guildRaidView(guildId);
    for (const p of this.players.values()) {
      if (p.guildId === guildId) this.sockets.get(p.id)?.emit("guildRaidUpdate", view);
    }
  }

  /** Boss defeated: split gold by damage share, grant guild EXP + top Gem. */
  private resolveGuildRaid(guildId: string, raid: { bossName: string; maxHp: number; hp: number; contributors: Map<string, number> }): void {
    this.guildRaids.delete(guildId);
    this.guildRaidCooldownUntil.set(guildId, Date.now() + GUILD_RAID_COOLDOWN_MS);
    const guild = guildStore.get(guildId);
    const totalDamage = [...raid.contributors.values()].reduce((a, b) => a + b, 0) || 1;
    const goldPool = Math.round(raid.maxHp * GUILD_RAID_GOLD_FACTOR);
    let topName = "";
    let topDmg = -1;
    for (const [name, dmg] of raid.contributors) {
      if (dmg > topDmg) { topDmg = dmg; topName = name; }
      const share = Math.round((dmg / totalDamage) * goldPool);
      const member = [...this.players.values()].find((p) => p.accountName === name);
      if (member && share > 0) {
        member.stats.gold += share;
        this.sockets.get(member.id)?.emit("player", member);
        this.sockets.get(member.id)?.emit("system", `🏆 Hạ ${raid.bossName}! Bạn nhận ${share.toLocaleString("vi-VN")} vàng (đóng góp ${dmg.toLocaleString("vi-VN")} sát thương).`);
        this.unlockAchievement(member, "raid-slayer");
        this.markDirty(member);
      }
    }
    // Top contributor Gem bonus.
    const top = [...this.players.values()].find((p) => p.accountName === topName);
    if (top) {
      top.gems = (top.gems ?? 0) + GUILD_RAID_TOP_GEM;
      this.sockets.get(top.id)?.emit("player", top);
      this.sockets.get(top.id)?.emit("system", `🥇 Bạn gây nhiều sát thương nhất — thưởng thêm ${GUILD_RAID_TOP_GEM} 💎!`);
      this.markDirty(top);
    }
    // Guild EXP reward + server-wide announcement (living-world flavor).
    if (guild) {
      this.broadcastGuildSystem(guild, `🎉 Guild đã hạ ${raid.bossName}!`);
      this.io.emit("system", `🌍 Guild [${guild.tag}] ${guild.name} vừa hạ gục ${raid.bossName}!`);
      this.addGuildExp(guild, Math.round(raid.maxHp * GUILD_RAID_EXP_FACTOR));
    }
    this.broadcastGuildRaid(guildId);
  }

  private broadcastGuildSystem(guild: GuildRecord, message: string): void {
    for (const p of this.players.values()) {
      if (p.guildId === guild.id) this.sockets.get(p.id)?.emit("system", `🏰 [${guild.tag}] ${message}`);
    }
  }

  /**
   * Remove a member from a guild, handling leadership succession and
   * disband-on-empty. `reason` controls the system messages.
   */
  private removeFromGuild(accountName: string, guildId: string, reason: "leave" | "kick", actorName?: string): void {
    const guild = guildStore.get(guildId);
    if (!guild) return;
    const member = guild.members.find((m) => m.accountName === accountName);
    if (!member) return;
    guild.members = guild.members.filter((m) => m.accountName !== accountName);

    // Clear runtime state on the online player, if any.
    const live = [...this.players.values()].find((p) => p.accountName === accountName);
    if (live) {
      live.guildId = undefined;
      live.guildTag = undefined;
      this.sockets.get(live.id)?.emit("player", live);
      this.sockets.get(live.id)?.emit("guildUpdate", null);
      this.sockets.get(live.id)?.emit(
        "system",
        reason === "kick" ? `Bạn đã bị ${actorName ?? "guild"} trục xuất khỏi [${guild.tag}] ${guild.name}.` : `Bạn đã rời [${guild.tag}] ${guild.name}.`
      );
      this.markDirty(live);
    }

    if (guild.members.length === 0) {
      guildStore.remove(guild.id);
      this.io.emit("system", `🏰 Guild [${guild.tag}] ${guild.name} đã giải tán.`);
      return;
    }

    // Leadership succession: oldest officer, else oldest member.
    if (member.rank === "leader") {
      const next =
        guild.members.filter((m) => m.rank === "officer").sort((a, b) => a.joinedAt - b.joinedAt)[0] ??
        guild.members.slice().sort((a, b) => a.joinedAt - b.joinedAt)[0];
      next.rank = "leader";
      this.broadcastGuildSystem(guild, `${next.accountName} trở thành Hội Trưởng mới 👑`);
    }
    guildStore.markDirty();
    this.broadcastGuildSystem(
      guild,
      reason === "kick" ? `${accountName} đã bị trục xuất khỏi guild.` : `${accountName} đã rời guild.`
    );
    this.emitGuildUpdate(guild.id);
  }

  private grantBattlePassExp(player: PlayerState, amount: number): void {
    if (amount <= 0) return;
    const maxLevel = BATTLE_PASS_TIERS.length;
    player.battlePassExp = (player.battlePassExp ?? 0) + amount;
    let level = player.battlePassLevel ?? 0;
    while (level < maxLevel && (player.battlePassExp ?? 0) >= BATTLE_PASS_EXP_PER_TIER) {
      player.battlePassExp! -= BATTLE_PASS_EXP_PER_TIER;
      level += 1;
    }
    if (level >= maxLevel) {
      player.battlePassExp = 0; // cap
    }
    if (level !== player.battlePassLevel) {
      player.battlePassLevel = level;
      this.sockets.get(player.id)?.emit("system", `🎟 Battle Pass cấp ${level} — vào tab Battle Pass nhận thưởng!`);
    }
  }

  // Set bonus: tiered HP/ATK/DEF for wearing multiple items of same theme.
  //   2 same theme -> +30 maxHp
  //   3 same theme -> +60 maxHp, +4 attack
  //   4 same theme -> +120 maxHp, +8 attack, +5 defense
  private recomputeSetBonus(player: PlayerState): void {
    const oldAtk = player.setBonusAttack ?? 0;
    const oldDef = player.setBonusDefense ?? 0;
    const oldHp = player.setBonusMaxHp ?? 0;
    player.stats.attack -= oldAtk;
    player.stats.defense -= oldDef;
    player.stats.maxHp = Math.max(1, player.stats.maxHp - oldHp);

    const counts = new Map<string, number>();
    for (const item of Object.values(player.inventory.equipped)) {
      if (!item || !item.themeId) continue;
      counts.set(item.themeId, (counts.get(item.themeId) ?? 0) + 1);
    }
    let atk = 0, def = 0, hp = 0;
    for (const count of counts.values()) {
      if (count >= 4) { hp += 120; atk += 8; def += 5; }
      else if (count >= 3) { hp += 60; atk += 4; }
      else if (count >= 2) { hp += 30; }
    }
    player.setBonusAttack = atk;
    player.setBonusDefense = def;
    player.setBonusMaxHp = hp;
    player.stats.attack += atk;
    player.stats.defense += def;
    player.stats.maxHp += hp;
    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp);
  }

  // Apply the active pet's buff with subtract-old/add-new bookkeeping. The
  // tracked petBonus* fields are persisted, so this is only invoked when the
  // active pet actually changes (never on login) — no double counting.
  private recomputePetBonus(player: PlayerState): void {
    player.stats.attack -= player.petBonusAttack ?? 0;
    player.stats.defense -= player.petBonusDefense ?? 0;
    player.stats.maxHp = Math.max(1, player.stats.maxHp - (player.petBonusMaxHp ?? 0));

    const pet = getPet(player.activePet);
    // Scale the buff by the active pet's current level (Sprint 65).
    const scaled = pet ? petBuffAtLevel(pet.buff, petLevelForXp((player.petXp ?? {})[pet.id] ?? 0)) : undefined;
    const atk = scaled?.attack ?? 0;
    const def = scaled?.defense ?? 0;
    const hp = scaled?.maxHp ?? 0;
    player.petBonusAttack = atk;
    player.petBonusDefense = def;
    player.petBonusMaxHp = hp;
    player.stats.attack += atk;
    player.stats.defense += def;
    player.stats.maxHp += hp;
    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp);
  }

  /**
   * Add XP to the player's ACTIVE pet, re-scaling its buff on level-up.
   * Returns false (with a system message) if no pet is equipped.
   */
  private grantPetXp(player: PlayerState, xp: number): boolean {
    const pet = getPet(player.activePet);
    if (!pet) {
      this.sockets.get(player.id)?.emit("system", "Hãy trang bị một linh thú trước (bảng Linh Thú — phím P).");
      return false;
    }
    const map = player.petXp ?? {};
    const before = petLevelForXp(map[pet.id] ?? 0);
    map[pet.id] = (map[pet.id] ?? 0) + xp;
    player.petXp = map;
    const after = petLevelForXp(map[pet.id]);
    // Re-scale the active buff (subtract-old/add-new keeps stats correct).
    this.recomputePetBonus(player);
    this.sockets.get(player.id)?.emit(
      "system",
      after > before ? `🐾 ${pet.name} lên cấp ${after}! Chỉ số buff tăng.` : `🐾 ${pet.name} +${xp} XP.`
    );
    if (after >= 5) this.unlockAchievement(player, "beast-master");
    return true;
  }

  private snapshot(): WorldSnapshot {
    return {
      serverTime: Date.now(),
      players: [...this.players.values()],
      monsters: this.monsters,
      groundItems: [...this.groundItems.values()]
    };
  }

  private broadcastSnapshot(): void {
    this.io.emit("snapshot", this.snapshot());
  }

  private emitFloating(entityId: string, position: { x: number; y: number }, amount: number, kind: FloatingTextEvent["kind"], text?: string): void {
    this.io.emit("floatingText", {
      id: `${Date.now()}-${Math.random()}`,
      entityId,
      position,
      amount,
      kind,
      text
    });
  }
}

// Map monster level -> biomes the species prefers. Pick from the matched
// biome pool; fall back to nearest walkable tile if the pool is empty.
function biomeBucketForLevel(level: number, type?: string): TileId[] {
  // Strong biome preference for the new species, falling back to level band.
  if (type === "desertScarab" || type === "sandStalker") return [TileId.Sand];
  if (type === "bogWitch" || type === "bogLurker") return [TileId.Swamp];
  if (type === "tundraYeti" || type === "frostWolfAlpha") return [TileId.Snow];
  if (type === "crystalLich" || type === "crystalWatcher") return [TileId.DungeonFloor];
  if (level <= 2) return [TileId.Grass, TileId.Forest];
  if (level <= 4) return [TileId.Forest, TileId.Swamp, TileId.Sand];
  if (level <= 6) return [TileId.Swamp, TileId.Snow, TileId.Sand, TileId.Deep];
  if (level <= 8) return [TileId.Deep, TileId.DungeonFloor];
  return [TileId.DungeonFloor, TileId.Deep];
}

function collectTilesByBiome(map: WorldMap): Map<TileId, { x: number; y: number }[]> {
  const out = new Map<TileId, { x: number; y: number }[]>();
  for (let y = 6; y < map.height - 6; y += 1) {
    for (let x = 6; x < map.width - 6; x += 1) {
      const t = map.tiles[y][x];
      if (!isWalkableTile(t)) continue;
      if (t === TileId.TownStone || t === TileId.Road) continue;
      // keep a buffer around the town spawn so low-level mobs don't camp it
      if (x < 16 && y < 16) continue;
      const arr = out.get(t);
      if (!arr) out.set(t, [{ x, y }]);
      else arr.push({ x, y });
    }
  }
  return out;
}

function createMonsterSpawns(map: WorldMap): MonsterState[] {
  // Denser spawns: more copies per species, more variety per biome.
  // Low-level mobs are abundant (8 copies) for new players, high-level
  // mobs are rare (3 copies) so end-game zones stay challenging.
  const counts: Record<string, number> = {
    forestSlime: 8,
    wildBoar: 7,
    caveBat: 6,
    goblinScout: 7,
    direWolf: 6,
    mossCrawler: 5,
    stoneImp: 6,
    emberSprite: 5,
    cursedTreant: 5,
    ashWraith: 5,
    frostRevenant: 4,
    crystalGolem: 4,
    bloodHarpy: 4,
    ancientDrake: 3,
    voidKnight: 3,
    elderHydra: 3,
    // Biome-specific additions
    desertScarab: 6,
    bogWitch: 5,
    tundraYeti: 4,
    crystalLich: 4,
    sandStalker: 6,
    frostWolfAlpha: 4,
    bogLurker: 5,
    crystalWatcher: 4
  };
  const species: string[] = [];
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i += 1) species.push(type);
  }

  const pools = collectTilesByBiome(map);
  // Deterministic PRNG so the same seed -> same monster placements.
  let rngState = (map.seed ^ 0x9e3779b9) >>> 0;
  const rng = () => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const monsters: MonsterState[] = species.map((type, index) => {
    const definition = getMonsterDefinition(type);
    const candidates = biomeBucketForLevel(definition.level, type);
    let pick: { x: number; y: number } | undefined;
    for (const biome of candidates) {
      const pool = pools.get(biome);
      if (!pool || !pool.length) continue;
      const i = Math.floor(rng() * pool.length);
      [pick] = pool.splice(i, 1);
      break;
    }
    // Last-resort fallback: any non-empty pool.
    if (!pick) {
      for (const pool of pools.values()) {
        if (!pool.length) continue;
        const i = Math.floor(rng() * pool.length);
        [pick] = pool.splice(i, 1);
        break;
      }
    }
    const tx = pick?.x ?? 18;
    const ty = pick?.y ?? 14;
    const elite = rollElite();
    const maxHp = monsterMaxHp(definition, elite);
    return {
      id: `monster-${index}`,
      type,
      name: definition.name,
      elite,
      boss: false,
      level: definition.level,
      position: { x: tx * TILE_SIZE, y: ty * TILE_SIZE },
      spawn: { x: tx * TILE_SIZE, y: ty * TILE_SIZE },
      velocity: { x: 0, y: 0 },
      maxHp,
      hp: maxHp,
      attack: monsterAttack(definition, elite),
      defense: monsterDefense(definition, elite),
      aggroRadius: 135 + definition.level * 8,
      leashRadius: 220 + definition.level * 10,
      respawnDurationMs: normalRespawnDurationMs(definition.level),
      lastAttackAt: 0
    };
  });
  monsters.push(createWorldBoss(map));
  for (const dungeonBoss of createDungeonMiniBosses(map)) {
    monsters.push(dungeonBoss);
  }
  return monsters;
}

// One mini-boss per dungeon entrance. They use existing high-level species
// re-skinned as "Khắc Tinh" (Nemesis) and drop epic loot guaranteed.
function createDungeonMiniBosses(map: WorldMap): MonsterState[] {
  const bossTypes = ["voidKnight", "ancientDrake", "elderHydra"] as const;
  const out: MonsterState[] = [];
  for (let i = 0; i < map.landmarks.dungeons.length && i < bossTypes.length; i += 1) {
    const dungeon = map.landmarks.dungeons[i];
    const type = bossTypes[i];
    const definition = getMonsterDefinition(type);
    // Mini-boss is 3x HP, 1.6x stats of base species.
    const baseMaxHp = monsterMaxHp(definition);
    const maxHp = Math.round(baseMaxHp * 3);
    out.push({
      id: `dungeon-boss-${i}`,
      type,
      name: `Khắc Tinh ${definition.name}`,
      elite: false,
      boss: true,
      level: definition.level + 1,
      position: { x: dungeon.x * TILE_SIZE, y: dungeon.y * TILE_SIZE },
      spawn: { x: dungeon.x * TILE_SIZE, y: dungeon.y * TILE_SIZE },
      velocity: { x: 0, y: 0 },
      maxHp,
      hp: maxHp,
      attack: Math.round(monsterAttack(definition) * 1.6),
      defense: Math.round(monsterDefense(definition) * 1.6),
      aggroRadius: 200,
      leashRadius: 320,
      respawnDurationMs: 90 * 1000,
      lastAttackAt: 0
    });
  }
  return out;
}

function rerollMonsterRank(monster: MonsterState): void {
  const definition = getMonsterDefinition(monster.type);
  monster.elite = rollElite();
  monster.maxHp = monsterMaxHp(definition, monster.elite);
  monster.hp = monster.maxHp;
  monster.attack = monsterAttack(definition, monster.elite);
  monster.defense = monsterDefense(definition, monster.elite);
}

function createWorldBoss(map?: WorldMap): MonsterState {
  const definition = getMonsterDefinition("eternalWarden");
  const maxHp = monsterMaxHp(definition);
  // Place the boss next to the first dungeon entrance when a world map is
  // provided. Falls back to the old hardcoded coords for safety.
  const spawnTile = map?.landmarks.dungeons[0] ?? { x: 45, y: 24 };
  return {
    id: "world-boss-eternal-warden",
    type: definition.type,
    name: definition.name,
    elite: false,
    boss: true,
    level: definition.level,
    position: { x: spawnTile.x * TILE_SIZE, y: spawnTile.y * TILE_SIZE },
    spawn: { x: spawnTile.x * TILE_SIZE, y: spawnTile.y * TILE_SIZE },
    velocity: { x: 0, y: 0 },
    maxHp,
    hp: 0,
    attack: monsterAttack(definition),
    defense: monsterDefense(definition),
    aggroRadius: 220,
    leashRadius: 280,
    respawnsAt: Date.now() + WORLD_BOSS_RESPAWN_MS,
    respawnDurationMs: WORLD_BOSS_RESPAWN_MS,
    lastAttackAt: 0
  };
}

function resetBoss(monster: MonsterState): void {
  const definition = getMonsterDefinition(monster.type);
  monster.elite = false;
  monster.maxHp = monsterMaxHp(definition);
  monster.hp = monster.maxHp;
  monster.attack = monsterAttack(definition);
  monster.defense = monsterDefense(definition);
}

function normalRespawnDurationMs(level: number): number {
  return 6500 + level * 900;
}

function rollElite(): boolean {
  return Math.random() < ELITE_CHANCE;
}

function createSkillCooldowns(): Record<SkillId, number> {
  return {
    powerStrike: 0,
    cleave: 0,
    swiftStrike: 0,
    heal: 0,
    piercingStrike: 0,
    whirlwind: 0,
    swiftBlade: 0,
    greaterHeal: 0,
    lifedrain: 0,
    flameBurst: 0,
    thunderStrike: 0,
    icicleStorm: 0,
    shadowAssault: 0,
    healingWave: 0,
    divineLight: 0,
    voidNova: 0
  };
}

function sanitizeEquippedSkills(input: Array<SkillId | null> | undefined, learned: SkillId[]): Array<SkillId | null> {
  const learnedSet = new Set(learned);
  const seen = new Set<SkillId>();
  const hasSavedLoadout = Array.isArray(input) && input.length > 0;
  const result: Array<SkillId | null> = [];
  if (Array.isArray(input)) {
    for (const id of input.slice(0, SKILL_LOADOUT_SIZE)) {
      if (isSkillId(id) && learnedSet.has(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      } else {
        result.push(null);
      }
    }
  }
  while (result.length < SKILL_LOADOUT_SIZE) result.push(null);
  if (hasSavedLoadout) return result;

  for (const id of DEFAULT_EQUIPPED_SKILLS) {
    if (learnedSet.has(id) && !seen.has(id)) {
      const emptySlot = result.indexOf(null);
      if (emptySlot < 0) break;
      seen.add(id);
      result[emptySlot] = id;
    }
  }
  // Fill remaining slots with any learned skill so player always has options.
  for (const id of learned) {
    if (!seen.has(id)) {
      const emptySlot = result.indexOf(null);
      if (emptySlot < 0) break;
      seen.add(id);
      result[emptySlot] = id;
    }
  }
  return result;
}

function sanitizeLearnedSkills(input: SkillId[] | undefined): SkillId[] {
  const seen = new Set<SkillId>();
  const result: SkillId[] = [];
  for (const id of DEFAULT_LEARNED_SKILLS) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  if (Array.isArray(input)) {
    for (const id of input) {
      if (isSkillId(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  return result;
}

function skillLabel(id: SkillId): string {
  const labels: Record<SkillId, string> = {
    powerStrike: "Power",
    cleave: "Cleave",
    swiftStrike: "Swift",
    heal: "Heal",
    piercingStrike: "Pierce",
    whirlwind: "Whirl",
    swiftBlade: "Swift Blade",
    greaterHeal: "Great Heal",
    lifedrain: "Drain",
    flameBurst: "Flame",
    thunderStrike: "Thunder",
    icicleStorm: "Icicle",
    shadowAssault: "Shadow",
    healingWave: "Wave",
    divineLight: "Divine",
    voidNova: "Void Nova"
  };
  return labels[id];
}

function questById(questId: string): QuestTemplate | undefined {
  return QUEST_TEMPLATES.find((quest) => quest.id === questId);
}

function initialQuestProgress(quest: QuestTemplate, player: PlayerState): number {
  if (quest.objective.kind === "reachLevel") return Math.min(quest.required, player.stats.level);
  return 0;
}

function isQuestComplete(entry: ActiveQuestState, quest: QuestTemplate): boolean {
  return entry.progress >= quest.required;
}

function questListFor(player: PlayerState, active: ActiveQuestState[]): QuestListPayload {
  const activeIds = new Set(active.map((entry) => entry.questId));
  const dailyAllowed = new Set(player.dailyQuestIds ?? []);
  return {
    available: QUEST_TEMPLATES
      .filter((quest) => {
        if (activeIds.has(quest.id)) return false;
        // Daily quests are only browsable if they're the player's current roll.
        if (quest.category === "daily" && !dailyAllowed.has(quest.id)) return false;
        // Tutorial quests are only browsable if not yet completed; once given
        // they live in active until claimed.
        if (quest.category === "tutorial" && player.tutorialGiven) return false;
        return true;
      })
      .map((quest) => questView(quest, { questId: quest.id, progress: initialQuestProgress(quest, player) })),
    active: active
      .map((entry) => {
        const quest = questById(entry.questId);
        return quest ? questView(quest, entry) : undefined;
      })
      .filter((quest): quest is QuestView => Boolean(quest))
  };
}

function questView(quest: QuestTemplate, entry: ActiveQuestState): QuestView {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    progress: Math.min(quest.required, entry.progress),
    required: quest.required,
    completed: isQuestComplete(entry, quest),
    rewardGold: quest.rewardGold,
    rewardExp: quest.rewardExp,
    category: quest.category
  };
}

function sanitizeName(name: string): string {
  const clean = name.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 18);
  return clean || process.env.ACCOUNT_NAME || "hero";
}

function normalizeEmail(email: string): string | undefined {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return undefined;
  return clean.slice(0, 255);
}

function facingFromAxis(axis: { x: number; y: number }, fallback: Direction): Direction {
  if (Math.abs(axis.x) > Math.abs(axis.y)) return axis.x > 0 ? "right" : "left";
  if (axis.y !== 0) return axis.y > 0 ? "down" : "up";
  return fallback;
}

function velocityToward(from: { x: number; y: number }, to: { x: number; y: number }, speed: number): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1) return { x: 0, y: 0 };
  return { x: (dx / len) * speed, y: (dy / len) * speed };
}

function isAllocatableStat(value: unknown): value is AllocatableStat {
  return value === "attack" || value === "defense" || value === "maxHp";
}

function cloneShopItem(offer: ShopItem): Item {
  const base = {
    id: crypto.randomUUID(),
    name: offer.name,
    rarity: offer.rarity,
    value: offer.value
  };
  if (offer.kind === "consumable") return { ...base, kind: "consumable", heal: offer.heal };
  if (offer.kind === "equipment") return { ...base, kind: "equipment", slot: offer.slot, stats: { ...offer.stats } };
  // material — shop does not currently sell materials, but keep exhaustive.
  return { ...base, kind: "material", materialId: offer.materialId };
}

function addItemStats(player: PlayerState, item: EquipmentItem): void {
  player.stats.attack += item.stats.attack ?? 0;
  player.stats.defense += item.stats.defense ?? 0;
  player.stats.maxHp += item.stats.maxHp ?? 0;
  player.stats.hp = Math.min(player.stats.hp + (item.stats.maxHp ?? 0), player.stats.maxHp);
}

function removeItemStats(player: PlayerState, item: EquipmentItem): void {
  player.stats.attack -= item.stats.attack ?? 0;
  player.stats.defense -= item.stats.defense ?? 0;
  player.stats.maxHp = Math.max(1, player.stats.maxHp - (item.stats.maxHp ?? 0));
  player.stats.hp = Math.min(player.stats.hp, player.stats.maxHp);
}

// Lowest slowMultiplier from active freeze effects (smaller = slower).
// Returns 1 when no freeze is active.
function freezeSlowFor(monster: MonsterState): number {
  if (!monster.activeEffects) return 1;
  let mul = 1;
  for (const e of monster.activeEffects) {
    if (e.kind === "freeze" && e.slowMultiplier !== undefined && e.slowMultiplier < mul) {
      mul = e.slowMultiplier;
    }
  }
  return mul;
}

function isInTown(position: { x: number; y: number }): boolean {
  return position.x < 11 * TILE_SIZE && position.y < 11 * TILE_SIZE;
}

// Sum of movement speed bonuses (percentage) across all equipped items.
function equipmentSpeedBonusPct(player: PlayerState): number {
  let total = 0;
  for (const item of Object.values(player.inventory.equipped)) {
    if (!item) continue;
    if (item.stats?.speed) total += item.stats.speed;
  }
  return total;
}

function isInArena(position: { x: number; y: number }): boolean {
  const tx = Math.floor(position.x / TILE_SIZE);
  const ty = Math.floor(position.y / TILE_SIZE);
  return tx >= ARENA_TILE_BOX.x0 && tx <= ARENA_TILE_BOX.x1 && ty >= ARENA_TILE_BOX.y0 && ty <= ARENA_TILE_BOX.y1;
}

function goldForMonster(monster: MonsterState): number {
  const definition = getMonsterDefinition(monster.type);
  const base = 6 + monster.level * 6;
  const toughness = definition.hpMultiplier + definition.attackMultiplier + definition.defenseMultiplier;
  const gold = Math.max(3, Math.floor(base * toughness * 0.55 + Math.random() * (monster.level * 8 + 8)));
  return Math.floor(gold * rewardMultiplier(monster));
}

function sellValue(value: number): number {
  return Math.max(1, Math.floor(value * SELL_VALUE_RATE));
}

function rewardMultiplier(monster: MonsterState): number {
  if (monster.boss) return WORLD_BOSS_REWARD_MULTIPLIER;
  return monster.elite ? ELITE_REWARD_MULTIPLIER : 1;
}

function isBagFull(player: PlayerState): boolean {
  return player.inventory.items.length >= bagCapacity(player.bagBonus);
}

function scatterAround(position: { x: number; y: number }): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = 18 + Math.random() * 18;
  return clampToWorld({
    x: position.x + Math.cos(angle) * radius,
    y: position.y + Math.sin(angle) * radius
  });
}
