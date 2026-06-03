import type { Server, Socket } from "socket.io";
import {
  ARENA_TILE_BOX,
  BASE_MAX_STAMINA,
  BIOME_INFO,
  CLASS_CATALOG,
  DEFAULT_AFK_ZONE,
  DEFAULT_EQUIPPED_SKILLS,
  DEFAULT_LEARNED_SKILLS,
  INVENTORY_CAPACITY,
  SKILL_MAX_RANK,
  SPRINT_DRAIN_PER_SECOND,
  SPRINT_MIN_STAMINA_TO_START,
  SPRINT_MULTIPLIER,
  SPRINT_REGEN_PER_SECOND,
  TALENT_POINTS_PER_LEVEL,
  dayPhaseAt,
  skillRankMultiplier,
  timeOfDay,
  MATERIAL_CATALOG,
  RECIPES,
  classCanLearnSkill,
  getRecipe,
  isPlayerClass,
  materialDropForMonster,
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
  FloatingTextEvent,
  GroundItem,
  Item,
  MaterialId,
  MaterialItem,
  MonsterState,
  PlayerState,
  ChatMessage,
  PartyView,
  QuestListPayload,
  QuestView,
  ShopItem,
  ServerToClientEvents,
  SkillId,
  Vec2,
  WorldMap,
  WorldMapPayload,
  WorldSnapshot
} from "@mmorpg/shared";
import type { PlayerRepository } from "../db/PlayerRepository.js";

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
  | { kind: "collectGold"; amount: number };

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
        skillLoadouts: saved.skillLoadouts ?? [[], [], []]
      };
      player.equippedSkills = sanitizeEquippedSkills(saved.equippedSkills, player.learnedSkills);
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
      socket.emit("system", `Chào mừng trở lại, ${resolvedName}.`);
    });

    socket.on("input", (input) => {
      if (this.players.has(socket.id)) this.inputs.set(socket.id, input);
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
      const [item] = player.inventory.items.splice(itemIndex, 1);
      const gold = sellValue(item.value);
      player.stats.gold += gold;
      socket.emit("player", player);
      socket.emit("system", `Đã bán ${item.name} được ${gold} vàng.`);
      this.emitFloating(player.id, player.position, gold, "loot", `+${gold} gold`);
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

    socket.on("enchantItem", ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      if (!isInTown(player.position)) {
        socket.emit("system", "Cần về thị trấn để tinh luyện.");
        return;
      }
      this.enchantItem(player, itemId);
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
      this.players.delete(socket.id);
      this.sockets.delete(socket.id);
      this.inputs.delete(socket.id);
      this.chatCooldowns.delete(socket.id);
      this.lastTownHealTextAt.delete(socket.id);
      this.autoRetarget.delete(socket.id);
      this.activeQuests.delete(socket.id);
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
      const speedBonusPct = equipmentSpeedBonusPct(player);
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
    const result = grantExp(player.stats, exp);
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

  private unlockAchievement(player: PlayerState, achievementId: string): boolean {
    if (player.achievements.includes(achievementId)) return false;
    const achievement = achievementById(achievementId);
    if (!achievement) return false;
    player.achievements.push(achievement.id);
    this.sockets.get(player.id)?.emit("achievementUnlocked", achievement);
    this.markDirty(player);
    return true;
  }

  private damageMonster(player: PlayerState, monster: MonsterState, attackMultiplier: number, now: number, label?: string): void {
    const result = rollDamage(player.stats.attack * attackMultiplier, monster.defense, player.stats.level - monster.level);
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
    const gold = goldForMonster(monster);
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
      if (isBagFull(player)) {
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
    this.sockets.get(player.id)?.emit("player", player);
    this.sockets.get(player.id)?.emit("system", `Đã tinh luyện ${item.name} (lần ${item.enchantCount}).`);
    this.emitFloating(player.id, player.position, 0, "loot", `+Tinh luyện`);
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
      attacker.pvpKills = (attacker.pvpKills ?? 0) + 1;
      target.pvpDeaths = (target.pvpDeaths ?? 0) + 1;
      this.unlockAchievement(attacker, "pvp-victor");
      if ((attacker.pvpKills ?? 0) >= 10) this.unlockAchievement(attacker, "pvp-champion");
      this.sockets.get(target.id)?.emit("system", `Bạn đã bị ${attacker.accountName} hạ tại Đấu Trường.`);
      this.sockets.get(attacker.id)?.emit("system", `Bạn đã hạ ${target.accountName} tại Đấu Trường! (Kills: ${attacker.pvpKills})`);
      this.io.emit("arenaKill", { killerName: attacker.accountName, victimName: target.accountName });
      this.markDirty(target);
      this.markDirty(attacker);
    }

    this.sockets.get(target.id)?.emit("player", target);
    this.sockets.get(attacker.id)?.emit("player", attacker);
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
  if (type === "desertScarab") return [TileId.Sand];
  if (type === "bogWitch") return [TileId.Swamp];
  if (type === "tundraYeti") return [TileId.Snow];
  if (type === "crystalLich") return [TileId.DungeonFloor];
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
    crystalLich: 4
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
  return player.inventory.items.length >= INVENTORY_CAPACITY;
}

function scatterAround(position: { x: number; y: number }): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const radius = 18 + Math.random() * 18;
  return clampToWorld({
    x: position.x + Math.cos(angle) * radius,
    y: position.y + Math.sin(angle) * radius
  });
}
