import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type pg from "pg";
import { DEFAULT_AFK_ZONE, SKILL_LOADOUT_SIZE, baseStatsForLevel, isAfkZone, isPlayerClass, isSkillId } from "@mmorpg/shared";
import type { AfkZone, EquipmentItem, InventoryState, Item, PlayerClass, PlayerState, SkillId, Stats, Vec2 } from "@mmorpg/shared";

interface SavedPlayer {
  accountName: string;
  email: string;
  stats: Stats;
  unspentPoints: number;
  inventory: InventoryState;
  afkZone: AfkZone;
  achievements: string[];
  equippedSkills?: Array<SkillId | null>;
  learnedSkills?: SkillId[];
  lastSeenAt?: number;
  position?: Vec2;
  playerClass?: PlayerClass;
  dailyQuestIds?: string[];
  dailyResetAt?: number;
  tutorialGiven?: boolean;
  talentPoints?: number;
  skillRanks?: Partial<Record<SkillId, number>>;
}

const memorySaves = new Map<string, SavedPlayer>();
const memoryAuth = new Map<string, string>();

export class PlayerRepository {
  constructor(private readonly pool?: pg.Pool) {}

  async verifyOrCreateAuth(email: string, accountName: string, password: string): Promise<{ ok: boolean }> {
    if (!this.pool) {
      const existing = memoryAuth.get(email);
      if (existing) return { ok: verifyPassword(password, existing) };
      memoryAuth.set(email, hashPassword(password));
      return { ok: true };
    }

    try {
      const client = await this.pool.connect();
      try {
        const account = await client.query<{ id: string; password_hash: string | null }>(
          "SELECT id, password_hash FROM accounts WHERE email = $1",
          [email]
        );
        if (account.rows[0]) {
          const stored = account.rows[0].password_hash;
          if (stored) return { ok: verifyPassword(password, stored) };
          await client.query("UPDATE accounts SET password_hash = $2, updated_at = now() WHERE id = $1", [account.rows[0].id, hashPassword(password)]);
          return { ok: true };
        }
        await client.query(
          `INSERT INTO accounts (username, email, password_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, username = EXCLUDED.username, updated_at = now()`,
          [accountName, email, hashPassword(password)]
        );
        return { ok: true };
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn("PostgreSQL auth failed. Falling back to memory auth.", error);
      const existing = memoryAuth.get(email);
      if (existing) return { ok: verifyPassword(password, existing) };
      memoryAuth.set(email, hashPassword(password));
      return { ok: true };
    }
  }

  async load(email: string, accountName: string): Promise<SavedPlayer> {
    if (!this.pool) return this.loadMemory(email, accountName);

    try {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const account = await client.query<{ id: string }>(
          `INSERT INTO accounts (username, email)
           VALUES ($1, $2)
           ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, updated_at = now()
           RETURNING id`,
          [accountName, email]
        );
        const accountId = account.rows[0].id;
        const character = await client.query(
          `INSERT INTO characters (account_id)
           VALUES ($1)
           ON CONFLICT (account_id) DO NOTHING
           RETURNING id`,
          [accountId]
        );
        const characterId = character.rows[0]?.id ?? (await client.query<{ id: string }>(
          "SELECT id FROM characters WHERE account_id = $1",
          [accountId]
        )).rows[0].id;

        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS map_id varchar(64) NOT NULL DEFAULT 'greenwood'");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_seen_at timestamptz");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS unspent_points integer NOT NULL DEFAULT 0");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS achievements jsonb NOT NULL DEFAULT '[]'::jsonb");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_skills jsonb NOT NULL DEFAULT '[]'::jsonb");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS learned_skills jsonb NOT NULL DEFAULT '[]'::jsonb");
        const statsRow = await client.query<Stats & { unspentPoints: number | null; posX: number | null; posY: number | null; afkZone: string | null; achievements: unknown; equippedSkills: unknown; learnedSkills: unknown; lastSeenAt: Date | string | number | null }>(
          `SELECT level, exp, hp, max_hp AS "maxHp", attack, defense, gold,
                  unspent_points AS "unspentPoints",
                  position_x AS "posX", position_y AS "posY", map_id AS "afkZone",
                  achievements,
                  equipped_skills AS "equippedSkills",
                  learned_skills AS "learnedSkills",
                  last_seen_at AS "lastSeenAt"
           FROM characters WHERE id = $1`,
          [characterId]
        );
        const items = await client.query(
          `SELECT id, name, rarity, kind, slot, stats, heal, value, equipped
           FROM inventory_items WHERE character_id = $1
           ORDER BY created_at ASC`,
          [characterId]
        );
        await client.query("COMMIT");

        const characterRow = statsRow.rows[0];
        return {
          accountName,
          email,
          stats: normalizeStats(characterRow),
          unspentPoints: Math.max(0, characterRow?.unspentPoints ?? 0),
          afkZone: normalizeAfkZone(characterRow?.afkZone),
          achievements: normalizeAchievements(characterRow?.achievements),
          equippedSkills: normalizeEquippedSkills(characterRow?.equippedSkills),
          learnedSkills: normalizeSkillList(characterRow?.learnedSkills),
          lastSeenAt: normalizeLastSeenAt(characterRow?.lastSeenAt),
          position: characterRow && characterRow.posX != null && characterRow.posY != null
            ? { x: characterRow.posX, y: characterRow.posY }
            : undefined,
          inventory: {
            items: items.rows.filter((item) => !item.equipped).map(normalizeItem),
            equipped: Object.fromEntries(items.rows
              .filter((item) => item.equipped && normalizeItem(item).kind === "equipment")
              .map((item) => {
                const normalized = normalizeItem(item) as EquipmentItem;
                return [normalized.slot, normalized];
              }))
          }
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn("PostgreSQL load failed. Falling back to memory save.", error);
      return this.loadMemory(email, accountName);
    }
  }

  async save(player: PlayerState): Promise<void> {
    const saved: SavedPlayer = {
      accountName: player.accountName,
      email: player.email,
      stats: player.stats,
      unspentPoints: player.unspentPoints,
      inventory: player.inventory,
      afkZone: player.afkZone,
      achievements: [...player.achievements],
      equippedSkills: [...player.equippedSkills],
      learnedSkills: [...player.learnedSkills],
      lastSeenAt: Date.now(),
      position: { x: player.position.x, y: player.position.y },
      playerClass: player.playerClass,
      dailyQuestIds: player.dailyQuestIds ? [...player.dailyQuestIds] : undefined,
      dailyResetAt: player.dailyResetAt,
      tutorialGiven: player.tutorialGiven,
      talentPoints: player.talentPoints,
      skillRanks: player.skillRanks ? { ...player.skillRanks } : undefined
    };
    memorySaves.set(player.email, saved);

    if (!this.pool) return;

    try {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const account = await client.query<{ id: string }>("SELECT id FROM accounts WHERE email = $1", [player.email]);
        if (!account.rows[0]) return;
        const character = await client.query<{ id: string }>("SELECT id FROM characters WHERE account_id = $1", [account.rows[0].id]);
        if (!character.rows[0]) return;
        const characterId = character.rows[0].id;

        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS map_id varchar(64) NOT NULL DEFAULT 'greenwood'");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_seen_at timestamptz");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS unspent_points integer NOT NULL DEFAULT 0");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS achievements jsonb NOT NULL DEFAULT '[]'::jsonb");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipped_skills jsonb NOT NULL DEFAULT '[]'::jsonb");
        await client.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS learned_skills jsonb NOT NULL DEFAULT '[]'::jsonb");
        await client.query(
          `UPDATE characters
           SET level = $2, exp = $3, hp = $4, max_hp = $5, attack = $6, defense = $7, gold = $8,
               position_x = $9, position_y = $10, map_id = $11, unspent_points = $12,
               achievements = $13::jsonb, equipped_skills = $14::jsonb,
               learned_skills = $15::jsonb, last_seen_at = now(), updated_at = now()
           WHERE id = $1`,
          [
            characterId,
            player.stats.level,
            player.stats.exp,
            player.stats.hp,
            player.stats.maxHp,
            player.stats.attack,
            player.stats.defense,
            player.stats.gold,
            Math.round(player.position.x),
            Math.round(player.position.y),
            player.afkZone,
            player.unspentPoints,
            JSON.stringify(player.achievements),
            JSON.stringify(player.equippedSkills),
            JSON.stringify(player.learnedSkills)
          ]
        );
        await client.query("DELETE FROM inventory_items WHERE character_id = $1", [characterId]);
        for (const item of player.inventory.items) {
          await insertItem(client, characterId, item, false);
        }
        for (const item of Object.values(player.inventory.equipped)) {
          if (item) await insertItem(client, characterId, item, true);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn("PostgreSQL save failed. Memory save is still updated.", error);
    }
  }

  private loadMemory(email: string, accountName: string): SavedPlayer {
    const saved = memorySaves.get(email);
    if (saved) {
      const cloned = structuredClone(saved);
      cloned.afkZone = normalizeAfkZone(cloned.afkZone);
      cloned.lastSeenAt = normalizeLastSeenAt(cloned.lastSeenAt);
      cloned.unspentPoints = Math.max(0, cloned.unspentPoints ?? 0);
      cloned.achievements = normalizeAchievements(cloned.achievements);
      return cloned;
    }
    return {
      accountName,
      email,
      stats: baseStatsForLevel(1),
      unspentPoints: 0,
      afkZone: DEFAULT_AFK_ZONE,
      achievements: [],
      inventory: { items: [], equipped: {} }
    };
  }
}

function normalizeAchievements(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string"))];
}

function normalizeEquippedSkills(value: unknown): Array<SkillId | null> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const seen = new Set<SkillId>();
  const result: Array<SkillId | null> = [];
  for (const id of value.slice(0, SKILL_LOADOUT_SIZE)) {
    if (isSkillId(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    } else {
      result.push(null);
    }
  }
  return result.some((id) => id !== null) ? result : undefined;
}

function normalizeSkillList(value: unknown): SkillId[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const result: SkillId[] = [];
  for (const id of value) {
    if (isSkillId(id) && !result.includes(id)) result.push(id);
  }
  return result.length > 0 ? result : undefined;
}

function normalizeAfkZone(value: unknown): AfkZone {
  return isAfkZone(value) ? value : DEFAULT_AFK_ZONE;
}

function normalizeLastSeenAt(value: unknown): number | undefined {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : undefined;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : undefined;
  }
  return undefined;
}

function normalizeStats(row: Partial<Stats> | undefined): Stats {
  const base = baseStatsForLevel(1);
  if (!row) return base;
  return {
    level: row.level ?? base.level,
    exp: row.exp ?? base.exp,
    maxHp: row.maxHp ?? base.maxHp,
    hp: row.hp ?? base.hp,
    attack: row.attack ?? base.attack,
    defense: row.defense ?? base.defense,
    gold: row.gold ?? 0
  };
}

function normalizeItem(row: any): Item {
  const kind = row.kind === "consumable" ? "consumable" : "equipment";
  if (kind === "consumable") {
    return {
      id: row.id,
      name: row.name,
      rarity: row.rarity,
      kind,
      heal: row.heal ?? row.stats?.heal ?? 0,
      value: row.value ?? estimateLegacyValue(row.stats)
    };
  }
  return {
    id: row.id,
    name: row.name,
    rarity: row.rarity,
    kind,
    slot: row.slot,
    stats: row.stats ?? {},
    value: row.value ?? estimateLegacyValue(row.stats)
  };
}

async function insertItem(client: pg.PoolClient, characterId: string, item: Item, equipped: boolean): Promise<void> {
  await client.query(
    `INSERT INTO inventory_items (id, character_id, name, rarity, kind, slot, stats, heal, value, equipped)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      item.id,
      characterId,
      item.name,
      item.rarity,
      item.kind,
      item.kind === "equipment" ? item.slot : null,
      item.kind === "equipment" ? item.stats : {},
      item.kind === "consumable" ? item.heal : null,
      item.value,
      equipped && item.kind === "equipment"
    ]
  );
}

function estimateLegacyValue(stats: any): number {
  return Math.max(10, Math.round((stats?.attack ?? 0) * 16 + (stats?.defense ?? 0) * 14 + (stats?.maxHp ?? 0) * 0.8));
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  return keyBuffer.length === derived.length && timingSafeEqual(keyBuffer, derived);
}
