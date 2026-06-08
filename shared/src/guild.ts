// Guild system catalog + helpers (Sprint 56).
//
// Guilds are persistent named groups with a short uppercase tag rendered
// next to member names. Membership is keyed by accountName (stable across
// sessions) rather than socket id.

export const GUILD_CREATE_COST_GOLD = 5000;
/** Base member cap at guild level 1. Grows +1 per guild level (see tiers). */
export const GUILD_MAX_MEMBERS = 20;
export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 20;
export const GUILD_TAG_MIN = 2;
export const GUILD_TAG_MAX = 4;
export const GUILD_MOTD_MAX = 100;
export const GUILD_INVITE_TTL_MS = 60 * 1000;

// ── Guild progression (Sprint 57) ──────────────────────────────────────
// Members donate gold → guild EXP. Each guild level grants a passive
// EXP/gold bonus to every member + a higher member cap. On top of that a
// leader/officer can buy a time-limited Gem boost for an extra EXP bump.
export const GUILD_MAX_LEVEL = 10;
export const GUILD_DONATE_MIN = 100;
/** 1 gold donated == 1 guild EXP. */
export const GUILD_GOLD_PER_EXP = 1;

export const GUILD_BOOST_GEM_COST = 200;
export const GUILD_BOOST_DURATION_MS = 48 * 60 * 60 * 1000;
/** Extra guild-wide EXP multiplier bonus while the Gem boost is active. */
export const GUILD_BOOST_EXP_BONUS = 0.1;

export interface GuildLevelTier {
  level: number;
  /** Cumulative guild EXP needed to REACH this level. */
  expRequired: number;
  /** Passive EXP bonus for all members at this level (e.g. 0.06 = +6%). */
  expBonus: number;
  /** Passive gold bonus for all members at this level. */
  goldBonus: number;
  /** Member capacity at this level. */
  maxMembers: number;
}

// +2% EXP and +2% gold per level above 1; +1 member slot per level.
export const GUILD_LEVELS: GuildLevelTier[] = [
  { level: 1, expRequired: 0, expBonus: 0.0, goldBonus: 0.0, maxMembers: 20 },
  { level: 2, expRequired: 10_000, expBonus: 0.02, goldBonus: 0.02, maxMembers: 21 },
  { level: 3, expRequired: 25_000, expBonus: 0.04, goldBonus: 0.04, maxMembers: 22 },
  { level: 4, expRequired: 50_000, expBonus: 0.06, goldBonus: 0.06, maxMembers: 23 },
  { level: 5, expRequired: 90_000, expBonus: 0.08, goldBonus: 0.08, maxMembers: 24 },
  { level: 6, expRequired: 150_000, expBonus: 0.1, goldBonus: 0.1, maxMembers: 25 },
  { level: 7, expRequired: 240_000, expBonus: 0.12, goldBonus: 0.12, maxMembers: 26 },
  { level: 8, expRequired: 370_000, expBonus: 0.14, goldBonus: 0.14, maxMembers: 27 },
  { level: 9, expRequired: 550_000, expBonus: 0.16, goldBonus: 0.16, maxMembers: 28 },
  { level: 10, expRequired: 800_000, expBonus: 0.18, goldBonus: 0.18, maxMembers: 30 }
];

/** Highest tier whose expRequired is satisfied by `exp`. */
export function guildLevelForExp(exp: number): number {
  let level = 1;
  for (const tier of GUILD_LEVELS) {
    if (exp >= tier.expRequired) level = tier.level;
    else break;
  }
  return level;
}

export function guildTier(level: number): GuildLevelTier {
  return GUILD_LEVELS[Math.max(0, Math.min(GUILD_LEVELS.length - 1, level - 1))];
}

export function guildMaxMembers(level: number): number {
  return guildTier(level).maxMembers;
}

/** Progress within the current level toward the next, for a progress bar. */
export function guildExpProgress(exp: number): { level: number; into: number; span: number; atMax: boolean } {
  const level = guildLevelForExp(exp);
  const current = guildTier(level);
  if (level >= GUILD_MAX_LEVEL) {
    return { level, into: 1, span: 1, atMax: true };
  }
  const next = guildTier(level + 1);
  return { level, into: exp - current.expRequired, span: next.expRequired - current.expRequired, atMax: false };
}

export function isGuildBoostActive(boostUntil: number | undefined, now: number = Date.now()): boolean {
  return typeof boostUntil === "number" && boostUntil > now;
}

export type GuildRank = "leader" | "officer" | "member";

export interface GuildMemberRecord {
  accountName: string;
  rank: GuildRank;
  joinedAt: number;
  /** Lifetime gold this member has donated to the guild. */
  contribution?: number;
}

/** Persistent guild record (stored in data/guilds.json). */
export interface GuildRecord {
  id: string;
  name: string;
  tag: string;
  motd: string;
  createdAt: number;
  members: GuildMemberRecord[];
  /** Total guild EXP accrued from donations (Sprint 57). */
  exp?: number;
  /** Cached guild level (derived from exp; stored for convenience). */
  level?: number;
  /** Timestamp (ms) the Gem-purchased EXP boost expires. */
  boostUntil?: number;
}

/** Per-member view sent to clients (adds live presence info). */
export interface GuildMemberView {
  accountName: string;
  rank: GuildRank;
  level: number;
  online: boolean;
  playerClass?: "warrior" | "mage" | "ranger";
  contribution: number;
}

/** Full guild view for the guild modal. */
export interface GuildView {
  id: string;
  name: string;
  tag: string;
  motd: string;
  createdAt: number;
  members: GuildMemberView[];
  maxMembers: number;
  // Progression (Sprint 57).
  exp: number;
  level: number;
  expInto: number;
  expSpan: number;
  atMaxLevel: boolean;
  expBonus: number;
  goldBonus: number;
  boostUntil?: number;
  boostActive: boolean;
}

export interface GuildInvitePayload {
  guildId: string;
  guildName: string;
  tag: string;
  from: string;
}

export interface GuildChatPayload {
  from: string;
  tag: string;
  message: string;
  sentAt: number;
}

// ── Guild Raid Boss (Sprint 66) ─────────────────────────────────────────
// A co-op boss summoned by a leader/officer; guild members damage a shared
// HP pool. On defeat, gold is split by damage share, the guild gains EXP, and
// the top contributor gets a Gem bonus. Raids are ephemeral (in-memory).
export const GUILD_RAID_BASE_HP = 30_000;
export const GUILD_RAID_HP_PER_LEVEL = 15_000;
export const GUILD_RAID_DURATION_MS = 5 * 60 * 1000;
export const GUILD_RAID_COOLDOWN_MS = 5 * 60 * 1000;
export const GUILD_RAID_ATTACK_COOLDOWN_MS = 1000;
/** Gold reward pool = maxHp * this, split by damage share. */
export const GUILD_RAID_GOLD_FACTOR = 0.15;
/** Guild EXP granted on defeat = maxHp * this. */
export const GUILD_RAID_EXP_FACTOR = 0.2;
/** Gem bonus to the top contributor on defeat. */
export const GUILD_RAID_TOP_GEM = 20;

export function guildRaidMaxHp(level: number): number {
  return GUILD_RAID_BASE_HP + Math.max(0, level - 1) * GUILD_RAID_HP_PER_LEVEL;
}

export interface GuildRaidContributor {
  accountName: string;
  damage: number;
}

export interface GuildRaidView {
  bossName: string;
  maxHp: number;
  hp: number;
  expiresAt: number;
  startedAt: number;
  contributors: GuildRaidContributor[];
}

/** A row in the global guild ranking (Sprint 60). */
export interface GuildLeaderboardRow {
  rank: number;
  guildId: string;
  name: string;
  tag: string;
  level: number;
  exp: number;
  memberCount: number;
  boostActive: boolean;
  mine: boolean;
}

const TAG_RE = /^[A-Za-z0-9]{2,4}$/;

export function sanitizeGuildTag(raw: unknown): string | undefined {
  const tag = String(raw ?? "").trim().toUpperCase();
  return TAG_RE.test(tag) ? tag : undefined;
}

export function sanitizeGuildName(raw: unknown): string | undefined {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < GUILD_NAME_MIN || name.length > GUILD_NAME_MAX) return undefined;
  return name;
}

export function guildRankLabel(rank: GuildRank): string {
  switch (rank) {
    case "leader": return "👑 Hội Trưởng";
    case "officer": return "⭐ Sĩ Quan";
    default: return "Thành Viên";
  }
}

/** Permission helper: who can invite/kick/set MOTD. */
export function canManageGuild(rank: GuildRank | undefined): boolean {
  return rank === "leader" || rank === "officer";
}
