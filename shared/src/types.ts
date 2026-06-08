import type { GuildChatPayload, GuildInvitePayload, GuildLeaderboardRow, GuildView } from "./guild.js";

export type Direction = "up" | "down" | "left" | "right";

export type Rarity = "common" | "rare" | "epic";

export type EquipmentSlot = "weapon" | "helmet" | "armor" | "boots" | "ring";
export type ItemKind = "equipment" | "consumable" | "material";
export type MaterialId =
  | "slimeCore"
  | "wolfFang"
  | "goblinMark"
  | "emberHeart"
  | "cursedBark"
  | "frostShard"
  | "crystalShard"
  | "voidAsh"
  | "wardenHeart";
export type SkillId =
  | "powerStrike"
  | "cleave"
  | "swiftStrike"
  | "heal"
  | "piercingStrike"
  | "whirlwind"
  | "swiftBlade"
  | "greaterHeal"
  | "lifedrain"
  | "flameBurst"
  | "thunderStrike"
  | "icicleStorm"
  | "shadowAssault"
  | "healingWave"
  | "divineLight"
  | "voidNova";
export type AfkZone = "greenwood" | "midlands" | "deeplands";
export type AllocatableStat = "attack" | "defense" | "maxHp";

export interface Achievement {
  id: string;
  title: string;
  description: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Stats {
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  level: number;
  gold: number;
  maxStamina?: number;
  stamina?: number;
}

export interface ItemStats {
  attack?: number;
  defense?: number;
  maxHp?: number;
  // Movement speed bonus as a percentage (e.g. 25 = +25% speed).
  speed?: number;
}

export interface BaseItem {
  id: string;
  name: string;
  rarity: Rarity;
  kind: ItemKind;
  value: number;
}

export interface EquipmentItem extends BaseItem {
  kind: "equipment";
  slot: EquipmentSlot;
  stats: ItemStats;
  /** How many times this item has been enchanted (re-rolled). */
  enchantCount?: number;
  /** Theme/set the item belongs to — when 2+ items of the same theme are
   *  equipped, the player gets a set bonus. */
  themeId?: string;
}

export interface ConsumableItem extends BaseItem {
  kind: "consumable";
  heal: number;
  /** Special use: teleport player to town spawn. */
  recall?: boolean;
}

export interface MaterialItem extends BaseItem {
  kind: "material";
  materialId: MaterialId;
}

export type Item = EquipmentItem | ConsumableItem | MaterialItem;

// ── Marketplace (Sprint 58) ─────────────────────────────────────────────
/** An active listing: the item is held in escrow here, off the seller's bag. */
export interface MarketListing {
  id: string;
  sellerName: string;
  item: Item;
  price: number;
  listedAt: number;
  /** Timestamp (ms) the Gem-paid "featured" pin expires (Sprint 59). */
  featuredUntil?: number;
}

/** Listing as shown to a client, flagged if it belongs to the viewer. */
export interface MarketListingView extends MarketListing {
  mine: boolean;
  net: number;
  tax: number;
  featured: boolean;
}

/** Gold owed to an offline seller from sales, collected on next login. */
export interface MarketPendingProceeds {
  accountName: string;
  gold: number;
  sales: Array<{ itemName: string; net: number; soldAt: number }>;
}

export interface InventoryState {
  items: Item[];
  equipped: Partial<Record<EquipmentSlot, EquipmentItem>>;
}

export interface PlayerState {
  id: string;
  email: string;
  accountName: string;
  position: Vec2;
  velocity: Vec2;
  facing: Direction;
  stats: Stats;
  unspentPoints: number;
  inventory: InventoryState;
  afkZone: AfkZone;
  achievements: string[];
  lastAttackAt: number;
  skillCooldowns: Record<SkillId, number>;
  equippedSkills: Array<SkillId | null>;
  learnedSkills: SkillId[];
  targetId?: string;
  pvpKills?: number;
  pvpDeaths?: number;
  inArena?: boolean;
  // Class assignment. Undefined means the player has not yet picked one.
  playerClass?: "warrior" | "mage" | "ranger";
  // Quest progression metadata
  dailyQuestIds?: string[];
  dailyResetAt?: number;
  tutorialGiven?: boolean;
  // Talent system — 1 point per level, spendable on skill ranks (0-3 each).
  talentPoints?: number;
  skillRanks?: Partial<Record<SkillId, number>>;
  // Lifetime counters for achievement progression.
  totalKills?: number;
  chestsOpened?: number;
  itemsCrafted?: number;
  // Currently applied set bonus stats (subtracted before each equip change
  // and re-added after, so the player's stat sheet always reflects the
  // active set tier without double-counting).
  setBonusAttack?: number;
  setBonusDefense?: number;
  setBonusMaxHp?: number;
  // Premium currency for cosmetic shop (separate from gold).
  gems?: number;
  // Cosmetics the player has unlocked.
  cosmetics?: string[];
  // Active cosmetic skin id (overrides default sprite tint).
  activeCosmeticSkin?: string;
  // Last daily login reward claim timestamp (server ms).
  lastDailyClaimAt?: number;
  // Daily login streak calendar (Sprint 61): consecutive-day count + last
  // claim date (YYYY-MM-DD UTC).
  loginStreak?: number;
  streakLastClaimDate?: string;
  // Active equippable title id (Sprint 62) — shown next to the name. Derived
  // titles are earned via stats; only the chosen one is persisted.
  activeTitle?: string;
  // Pets (Sprint 63): owned pet ids + the active companion + its applied buff
  // (persisted so relogin doesn't double-count the bonus baked into stats).
  ownedPets?: string[];
  activePet?: string;
  petBonusAttack?: number;
  petBonusDefense?: number;
  petBonusMaxHp?: number;
  // XP per owned pet id (Sprint 65) → drives pet level + buff scaling.
  petXp?: Record<string, number>;
  // Battle pass progression for the current season.
  battlePassExp?: number;
  battlePassLevel?: number;
  battlePassPremium?: boolean;
  battlePassClaimedFree?: number[];
  battlePassClaimedPremium?: number[];
  battlePassSeason?: number;
  titles?: string[];
  friends?: string[];
  /** Timestamp (ms) when VIP expires. Past this the player is no longer VIP. */
  vipUntil?: number;
  /** Last day (YYYY-MM-DD UTC) the VIP daily gem was claimed. */
  vipLastDailyDate?: string;
  // Up to 3 saved skill loadouts, each an array of 4 skill ids.
  skillLoadouts?: Array<SkillId[]>;
  // Guild membership (runtime; the authoritative record lives in the guild
  // store keyed by accountName). Tag rides the snapshot so every client can
  // render [TAG] next to names without needing the guild registry.
  guildId?: string;
  guildTag?: string;
}

// In-tile coordinates of the PvP arena rectangle inside town (x0,y0,x1,y1
// inclusive). Players inside are PvP-enabled; outside are PvE-safe.
export const ARENA_TILE_BOX = { x0: 1, y0: 1, x1: 5, y1: 5 } as const;

export interface ArenaLeaderRow {
  playerId: string;
  accountName: string;
  kills: number;
  deaths: number;
}

export interface LeaderboardRow {
  playerId: string;
  accountName: string;
  level: number;
  gold: number;
  pvpKills: number;
}

export interface LeaderboardPayload {
  byLevel: LeaderboardRow[];
  byGold: LeaderboardRow[];
  byKills: LeaderboardRow[];
}

export interface MonsterStatusEffect {
  kind: "burn" | "bleed" | "freeze";
  endsAt: number;
  // For DOT: damage per second.
  tickDamage?: number;
  lastTickAt?: number;
  // For freeze: movement speed multiplier.
  slowMultiplier?: number;
}

export interface MonsterState {
  id: string;
  type: string;
  name: string;
  elite: boolean;
  boss: boolean;
  position: Vec2;
  velocity: Vec2;
  spawn: Vec2;
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  aggroRadius: number;
  leashRadius: number;
  targetPlayerId?: string;
  respawnsAt?: number;
  respawnDurationMs: number;
  lastAttackAt: number;
  activeEffects?: MonsterStatusEffect[];
}

export interface FloatingTextEvent {
  id: string;
  entityId: string;
  position: Vec2;
  amount: number;
  kind: "damage" | "heal" | "exp" | "level" | "loot";
  text?: string;
}

export interface LootEvent {
  playerId: string;
  gold: number;
  item?: Item;
}

export interface OfflineRewardsEvent {
  elapsedMs: number;
  exp: number;
  gold: number;
  cappedAtMax: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  accountName: string;
  message: string;
  sentAt: number;
}

export type QuestCategory = "tutorial" | "story" | "daily";

export interface QuestView {
  id: string;
  title: string;
  description: string;
  progress: number;
  required: number;
  completed: boolean;
  rewardGold: number;
  rewardExp: number;
  category?: QuestCategory;
}

export interface QuestListPayload {
  available: QuestView[];
  active: QuestView[];
}

export interface PartyMemberView {
  id: string;
  accountName: string;
  level: number;
  hp: number;
  maxHp: number;
  isLeader: boolean;
}

export interface PartyView {
  id: string;
  leaderId: string;
  members: PartyMemberView[];
}

export interface PartyInvite {
  partyId: string;
  fromName: string;
}

export type ShopItem = Item & { shopId: string };

export interface GroundItem {
  id: string;
  item: Item;
  position: Vec2;
  droppedBy: string;
  createdAt: number;
}

export interface WorldSnapshot {
  serverTime: number;
  players: PlayerState[];
  monsters: MonsterState[];
  groundItems: GroundItem[];
}

// Time-of-day broadcast at low frequency. Phase strings give the client
// human-readable labels without recomputing thresholds.
export type DayPhase = "dawn" | "day" | "dusk" | "night";
export interface WorldTime {
  serverTime: number;
  // 0..1 fraction through the in-game day
  timeOfDay: number;
  phase: DayPhase;
}

// Lightweight payload for the init handshake. We only send the tile grid;
// the client derives walkability via BIOME_INFO so we don't ship a full
// boolean array.
export interface WorldMapPayload {
  width: number;
  height: number;
  seed: number;
  tiles: number[][];
  landmarks: {
    town: Vec2;
    dungeons: Vec2[];
  };
}

export interface ClientInput {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  moveTarget?: Vec2;
  sprinting?: boolean;
}

export interface LoginPayload {
  email?: string;
  accountName?: string;
  password?: string;
  token?: string;
}

export interface EquipItemPayload {
  itemId: string;
}

export interface TargetMonsterPayload {
  monsterId?: string;
}

export interface TargetPlayerPayload {
  playerId?: string;
}

export interface ChatPayload {
  message: string;
}

export interface ServerToClientEvents {
  init: (data: { selfId: string; snapshot: WorldSnapshot; worldMap: WorldMapPayload }) => void;
  session: (payload: { token: string }) => void;
  snapshot: (snapshot: WorldSnapshot) => void;
  player: (player: PlayerState) => void;
  floatingText: (event: FloatingTextEvent) => void;
  loot: (event: LootEvent) => void;
  offlineRewards: (event: OfflineRewardsEvent) => void;
  achievementUnlocked: (payload: Achievement) => void;
  announce: (payload: { accountName: string; itemName: string; rarity: Rarity }) => void;
  bossAnnounce: (payload: { kind: "spawn" | "defeat"; bossName: string; accountName?: string }) => void;
  questList: (payload: QuestListPayload) => void;
  partyUpdate: (payload: PartyView | null) => void;
  partyInvite: (payload: PartyInvite) => void;
  chatHistory: (messages: ChatMessage[]) => void;
  chatMessage: (message: ChatMessage) => void;
  shopStock: (items: ShopItem[]) => void;
  system: (message: string) => void;
  skillCast: (event: { casterId: string; skillId: SkillId; position: Vec2; targetPosition?: Vec2 }) => void;
  monsterProjectile: (event: { sourceId: string; sourcePosition: Vec2; targetPosition: Vec2; color: number }) => void;
  arenaLeaderboard: (rows: ArenaLeaderRow[]) => void;
  arenaKill: (event: { killerName: string; victimName: string }) => void;
  worldTime: (payload: WorldTime) => void;
  leaderboard: (payload: LeaderboardPayload) => void;
  friendList: (payload: { name: string; online: boolean }[]) => void;
  privateMessageReceived: (payload: { from: string; message: string; sentAt: number }) => void;
  guildUpdate: (payload: GuildView | null) => void;
  guildInvite: (payload: GuildInvitePayload) => void;
  guildChatMessage: (payload: GuildChatPayload) => void;
  guildLeaderboard: (payload: GuildLeaderboardRow[]) => void;
  marketUpdate: (payload: MarketListingView[]) => void;
  titlesUpdate: (payload: { earned: string[]; active?: string }) => void;
}

export interface ClientToServerEvents {
  login: (payload: LoginPayload) => void;
  input: (input: ClientInput) => void;
  setAfkZone: (payload: { zone: AfkZone }) => void;
  setAutoRetarget: (payload: { enabled: boolean }) => void;
  allocateStat: (payload: { stat: AllocatableStat }) => void;
  acceptQuest: (payload: { questId: string }) => void;
  claimQuest: (payload: { questId: string }) => void;
  inviteParty: (payload: { playerId: string }) => void;
  acceptParty: (payload: { partyId: string }) => void;
  leaveParty: () => void;
  equipItem: (payload: EquipItemPayload) => void;
  unequipItem: (payload: { slot: EquipmentSlot }) => void;
  targetMonster: (payload: TargetMonsterPayload) => void;
  targetPlayer: (payload: TargetPlayerPayload) => void;
  buyShopItem: (payload: { shopId: string }) => void;
  useSkill: (payload: { skillId: SkillId }) => void;
  equipSkill: (payload: { slot: number; skillId: SkillId }) => void;
  learnSkill: (payload: { skillId: SkillId }) => void;
  useItem: (payload: { itemId: string }) => void;
  sellItem: (payload: { itemId: string }) => void;
  sellJunk: () => void;
  craftRecipe: (payload: { recipeId: string }) => void;
  arenaLeaderboardRequest: () => void;
  selectClass: (payload: { playerClass: "warrior" | "mage" | "ranger" }) => void;
  upgradeSkill: (payload: { skillId: SkillId }) => void;
  leaderboardRequest: () => void;
  rerollDailyQuests: () => void;
  enchantItem: (payload: { itemId: string }) => void;
  saveLoadout: (payload: { slot: number }) => void;
  loadLoadout: (payload: { slot: number }) => void;
  buyCosmetic: (payload: { cosmeticId: string }) => void;
  equipCosmetic: (payload: { cosmeticId: string | null }) => void;
  claimDailyReward: () => void;
  claimLoginStreak: () => void;
  requestTitles: () => void;
  setActiveTitle: (payload: { titleId: string | null }) => void;
  buyPet: (payload: { petId: string }) => void;
  equipPet: (payload: { petId: string | null }) => void;
  feedPet: () => void;
  petTreat: () => void;
  buyBattlePassPremium: () => void;
  claimBattlePassTier: (payload: { tier: number; track: "free" | "premium" }) => void;
  addFriend: (payload: { name: string }) => void;
  removeFriend: (payload: { name: string }) => void;
  privateMessage: (payload: { to: string; message: string }) => void;
  buyVip: (payload: { days: number }) => void;
  claimVipDaily: () => void;
  createGuild: (payload: { name: string; tag: string }) => void;
  guildInvitePlayer: (payload: { name: string }) => void;
  acceptGuildInvite: (payload: { guildId: string }) => void;
  leaveGuild: () => void;
  kickGuildMember: (payload: { accountName: string }) => void;
  promoteGuildMember: (payload: { accountName: string }) => void;
  setGuildMotd: (payload: { motd: string }) => void;
  guildChat: (payload: { message: string }) => void;
  donateGuild: (payload: { amount: number }) => void;
  buyGuildBoost: () => void;
  requestGuildLeaderboard: () => void;
  requestMarket: () => void;
  listMarketItem: (payload: { itemId: string; price: number }) => void;
  buyMarketItem: (payload: { listingId: string }) => void;
  cancelMarketListing: (payload: { listingId: string }) => void;
  featureMarketListing: (payload: { listingId: string }) => void;
  dropItem: (payload: { itemId: string }) => void;
  pickupGroundItem: (payload: { groundItemId: string }) => void;
  chatMessage: (payload: ChatPayload) => void;
}
