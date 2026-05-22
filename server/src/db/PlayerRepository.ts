import type pg from "pg";
import { baseStatsForLevel } from "@mmorpg/shared";
import type { EquipmentItem, InventoryState, Item, PlayerState, Stats, Vec2 } from "@mmorpg/shared";

interface SavedPlayer {
  accountName: string;
  email: string;
  stats: Stats;
  inventory: InventoryState;
  position?: Vec2;
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

        const statsRow = await client.query<Stats & { posX: number | null; posY: number | null }>(
          `SELECT level, exp, hp, max_hp AS "maxHp", attack, defense, gold,
                  position_x AS "posX", position_y AS "posY"
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
      inventory: player.inventory,
      position: { x: player.position.x, y: player.position.y }
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
           SET level = $2, exp = $3, hp = $4, max_hp = $5, attack = $6, defense = $7, gold = $8,
               position_x = $9, position_y = $10, updated_at = now()
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
            Math.round(player.position.y)
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
