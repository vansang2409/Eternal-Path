// Filesystem persistence for guilds (Sprint 56).
//
// Kept separate from saves.json on purpose: PlayerRepository's payload is
// per-player and load-order sensitive (see memoryAuth TDZ note); guilds are
// a cross-player registry, so they get their own small JSON file with the
// same debounced-flush pattern.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { GuildRecord } from "@mmorpg/shared";

const GUILD_SAVE_PATH = process.env.GUILD_SAVE_PATH || "data/guilds.json";
const FLUSH_INTERVAL_MS = 30 * 1000;

const guilds = new Map<string, GuildRecord>();
let dirty = false;
let timer: NodeJS.Timeout | undefined;

function loadFromDisk(): void {
  try {
    if (!existsSync(GUILD_SAVE_PATH)) return;
    const raw = readFileSync(GUILD_SAVE_PATH, "utf8");
    const json = JSON.parse(raw) as { guilds: GuildRecord[] };
    if (Array.isArray(json.guilds)) {
      for (const g of json.guilds) {
        if (g && typeof g.id === "string" && Array.isArray(g.members)) guilds.set(g.id, g);
      }
    }
    console.log(`[guild-store] Loaded ${guilds.size} guilds from ${GUILD_SAVE_PATH}`);
  } catch (err) {
    console.warn(`[guild-store] Failed to load ${GUILD_SAVE_PATH}:`, err);
  }
}

function flushToDisk(): void {
  if (!dirty) return;
  try {
    const dir = dirname(GUILD_SAVE_PATH);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(GUILD_SAVE_PATH, JSON.stringify({ guilds: [...guilds.values()] }), "utf8");
    dirty = false;
  } catch (err) {
    console.warn(`[guild-store] Failed to write ${GUILD_SAVE_PATH}:`, err);
  }
}

loadFromDisk();
if (!timer) {
  timer = setInterval(flushToDisk, FLUSH_INTERVAL_MS);
  timer.unref?.();
}
process.on("beforeExit", flushToDisk);

export const guildStore = {
  all(): GuildRecord[] {
    return [...guilds.values()];
  },
  get(id: string): GuildRecord | undefined {
    return guilds.get(id);
  },
  /** Find the guild containing accountName, if any. */
  findByMember(accountName: string): GuildRecord | undefined {
    for (const g of guilds.values()) {
      if (g.members.some((m) => m.accountName === accountName)) return g;
    }
    return undefined;
  },
  findByNameOrTag(name: string, tag: string): GuildRecord | undefined {
    const lowerName = name.toLowerCase();
    const upperTag = tag.toUpperCase();
    for (const g of guilds.values()) {
      if (g.name.toLowerCase() === lowerName || g.tag === upperTag) return g;
    }
    return undefined;
  },
  upsert(guild: GuildRecord): void {
    guilds.set(guild.id, guild);
    dirty = true;
  },
  remove(id: string): void {
    guilds.delete(id);
    dirty = true;
  },
  /** Mark store dirty after in-place mutation of a record. */
  markDirty(): void {
    dirty = true;
  },
  flushNow(): void {
    flushToDisk();
  }
};
