import type pg from "pg";
import { baseStatsForLevel } from "@mmorpg/shared";
import type { InventoryState, PlayerState, Stats } from "@mmorpg/shared";

interface SavedPlayer {
  accountName: string;
  email: string;
  stats: Stats;
  inventory: InventoryState;
}

const memorySaves = new Map<string, SavedPlayer>();

export class PlayerRepository {
  constructor(private readonly pool?: pg.Pool) {}

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

        const statsRow = await client.query<Stats>(
          `SELECT level, exp, hp, max_hp AS "maxHp", attack, defense, gold
           FROM characters WHERE id = $1`,
          [characterId]
        );
        const items = await client.query(
          `SELECT id, name, rarity, slot, stats, value, equipped
           FROM inventory_items WHERE character_id = $1
           ORDER BY created_at ASC`,
          [characterId]
        );
        await client.query("COMMIT");

        return {
          accountName,
          email,
          stats: normalizeStats(statsRow.rows[0]),
          inventory: {
            items: items.rows.filter((item) => !item.equipped).map(normalizeItem),
            equipped: Object.fromEntries(items.rows.filter((item) => item.equipped).map((item) => [item.slot, normalizeItem(item)]))
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
      inventory: player.inventory
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

        await client.query(
          `UPDATE characters
           SET level = $2, exp = $3, hp = $4, max_hp = $5, attack = $6, defense = $7, gold = $8, updated_at = now()
           WHERE id = $1`,
          [
            characterId,
            player.stats.level,
            player.stats.exp,
            player.stats.hp,
            player.stats.maxHp,
            player.stats.attack,
            player.stats.defense,
            player.stats.gold
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
    if (saved) return structuredClone(saved);
    return {
      accountName,
      email,
      stats: baseStatsForLevel(1),
      inventory: { items: [], equipped: {} }
    };
  }
}

function normalizeStats(row: Stats | undefined): Stats {
  return {
    ...baseStatsForLevel(1),
    ...row,
    gold: row?.gold ?? 0
  };
}

function normalizeItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    rarity: row.rarity,
    slot: row.slot,
    stats: row.stats,
    value: row.value ?? estimateLegacyValue(row.stats)
  };
}

async function insertItem(client: pg.PoolClient, characterId: string, item: any, equipped: boolean): Promise<void> {
  await client.query(
    `INSERT INTO inventory_items (id, character_id, name, rarity, slot, stats, value, equipped)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [item.id, characterId, item.name, item.rarity, item.slot, item.stats, item.value ?? estimateLegacyValue(item.stats), equipped]
  );
}

function estimateLegacyValue(stats: any): number {
  return Math.max(10, Math.round((stats?.attack ?? 0) * 16 + (stats?.defense ?? 0) * 14 + (stats?.maxHp ?? 0) * 0.8));
}
