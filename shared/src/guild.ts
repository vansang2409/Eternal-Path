// Guild system catalog + helpers (Sprint 56).
//
// Guilds are persistent named groups with a short uppercase tag rendered
// next to member names. Membership is keyed by accountName (stable across
// sessions) rather than socket id.

export const GUILD_CREATE_COST_GOLD = 5000;
export const GUILD_MAX_MEMBERS = 20;
export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 20;
export const GUILD_TAG_MIN = 2;
export const GUILD_TAG_MAX = 4;
export const GUILD_MOTD_MAX = 100;
export const GUILD_INVITE_TTL_MS = 60 * 1000;

export type GuildRank = "leader" | "officer" | "member";

export interface GuildMemberRecord {
  accountName: string;
  rank: GuildRank;
  joinedAt: number;
}

/** Persistent guild record (stored in data/guilds.json). */
export interface GuildRecord {
  id: string;
  name: string;
  tag: string;
  motd: string;
  createdAt: number;
  members: GuildMemberRecord[];
}

/** Per-member view sent to clients (adds live presence info). */
export interface GuildMemberView {
  accountName: string;
  rank: GuildRank;
  level: number;
  online: boolean;
  playerClass?: "warrior" | "mage" | "ranger";
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
