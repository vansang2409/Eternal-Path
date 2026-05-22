import type { Server, Socket } from "socket.io";
import {
  INVENTORY_CAPACITY,
  MONSTER_ATTACK_COOLDOWN_MS,
  MONSTER_ATTACK_RANGE,
  MONSTER_SPEED,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  PLAYER_SPEED,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clampToWorld,
  createLoot,
  createShopStock,
  distance,
  getMonsterDefinition,
  grantExp,
  monsterAttack,
  monsterDefense,
  monsterMaxHp,
  rollDamage
} from "@mmorpg/shared";
import type {
  ClientInput,
  ClientToServerEvents,
  Direction,
  EquipmentItem,
  FloatingTextEvent,
  GroundItem,
  Item,
  MonsterState,
  PlayerState,
  ChatMessage,
  ShopItem,
  ServerToClientEvents,
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
const SELL_VALUE_RATE = 0.6;
const AUTO_RETARGET_RANGE = 260;
const BAG_FULL_MESSAGE = "Túi đồ đã đầy.";
const ELITE_CHANCE = 0.15;
const ELITE_REWARD_MULTIPLIER = 2.5;

export class GameWorld {
  private readonly players = new Map<string, PlayerState>();
  private readonly sockets = new Map<string, GameSocket>();
  private readonly inputs = new Map<string, ClientInput>();
  private readonly chatMessages: ChatMessage[] = [];
  private readonly chatCooldowns = new Map<string, number>();
  private readonly lastTownHealTextAt = new Map<string, number>();
  private readonly autoRetarget = new Map<string, boolean>();
  private readonly shopStock: ShopItem[] = createShopStock();
  private readonly groundItems = new Map<string, GroundItem>();
  private readonly returningToSpawn = new Set<string>();
  private monsters: MonsterState[] = [];
  private tickTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;

  constructor(
    private readonly io: GameServerSocket,
    private readonly repository: PlayerRepository
  ) {
    this.monsters = createMonsterSpawns();
  }

  start(): void {
    this.tickTimer = setInterval(() => this.tick(1000 / TICK_RATE), 1000 / TICK_RATE);
    this.snapshotTimer = setInterval(() => this.broadcastSnapshot(), 1000 / SNAPSHOT_RATE);
  }

  connect(socket: GameSocket): void {
    socket.on("login", async ({ email, accountName }) => {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        socket.emit("system", "Vui lòng nhập email hợp lệ để vào game.");
        return;
      }
      const name = sanitizeName(accountName || normalizedEmail.split("@")[0]);
      const saved = await this.repository.load(normalizedEmail, name);
      const player: PlayerState = {
        id: socket.id,
        email: normalizedEmail,
        accountName: name,
        position: { ...townSpawn },
        velocity: { x: 0, y: 0 },
        facing: "down",
        stats: saved.stats,
        inventory: saved.inventory,
        lastAttackAt: 0
      };
      this.players.set(socket.id, player);
      this.sockets.set(socket.id, socket);
      socket.emit("init", { selfId: socket.id, snapshot: this.snapshot() });
      socket.emit("player", player);
      socket.emit("shopStock", this.shopStock);
      socket.emit("chatHistory", this.chatMessages);
      socket.emit("system", `Chào mừng trở lại, ${name}.`);
    });

    socket.on("input", (input) => {
      if (this.players.has(socket.id)) this.inputs.set(socket.id, input);
    });

    socket.on("setAutoRetarget", ({ enabled }) => {
      if (this.players.has(socket.id)) this.autoRetarget.set(socket.id, enabled);
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
      await this.repository.save(player);
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
      await this.repository.save(player);
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
      await this.repository.save(player);
    });

    socket.on("useItem", async ({ itemId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const itemIndex = player.inventory.items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return;
      const item = player.inventory.items[itemIndex];
      if (item.kind !== "consumable") return;
      const before = player.stats.hp;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + item.heal);
      const healed = player.stats.hp - before;
      player.inventory.items.splice(itemIndex, 1);
      socket.emit("player", player);
      if (healed > 0) this.emitFloating(player.id, player.position, healed, "heal", `+${healed} hp`);
      socket.emit("system", healed > 0 ? `Đã dùng ${item.name} hồi ${healed} máu.` : "Máu đã đầy.");
      await this.repository.save(player);
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
      await this.repository.save(player);
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
      await this.repository.save(player);
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
      await this.repository.save(player);
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
      player.inventory.items.push(groundItem.item);
      socket.emit("player", player);
      socket.emit("system", `Đã nhặt ${groundItem.item.name}.`);
      this.emitFloating(player.id, player.position, 0, "loot", groundItem.item.name);
      await this.repository.save(player);
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
      if (player) await this.repository.save(player);
      this.players.delete(socket.id);
      this.sockets.delete(socket.id);
      this.inputs.delete(socket.id);
      this.chatCooldowns.delete(socket.id);
      this.lastTownHealTextAt.delete(socket.id);
      this.autoRetarget.delete(socket.id);
    });
  }

  private tick(deltaMs: number): void {
    const now = Date.now();
    this.updatePlayers(deltaMs);
    this.updateTownHealing(deltaMs, now);
    this.updateMonsters(deltaMs, now);
    this.updateCombat(now);
    this.updateRespawns(now);
    this.cleanupGroundItems(now);
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
      const manualLength = Math.hypot(axis.x, axis.y);
      if (manualLength > 0) {
        player.velocity = { x: (axis.x / manualLength) * PLAYER_SPEED, y: (axis.y / manualLength) * PLAYER_SPEED };
      } else if (input.moveTarget) {
        const dx = input.moveTarget.x - player.position.x;
        const dy = input.moveTarget.y - player.position.y;
        const targetDistance = Math.hypot(dx, dy);
        if (targetDistance > 5) {
          player.velocity = { x: (dx / targetDistance) * PLAYER_SPEED, y: (dy / targetDistance) * PLAYER_SPEED };
        } else {
          player.velocity = { x: 0, y: 0 };
        }
      } else {
        player.velocity = { x: 0, y: 0 };
      }
      player.position = clampToWorld({
        x: player.position.x + player.velocity.x * dt,
        y: player.position.y + player.velocity.y * dt
      });
      player.facing = facingFromAxis(player.velocity, player.facing);
    }
  }

  private updateTownHealing(deltaMs: number, now: number): void {
    for (const player of this.players.values()) {
      if (!isInTown(player.position) || player.stats.hp >= player.stats.maxHp) continue;
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
        monster.velocity = distance(monster.position, target.position) > MONSTER_ATTACK_RANGE
          ? { x: (dx / len) * MONSTER_SPEED, y: (dy / len) * MONSTER_SPEED }
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
        monster.position = clampToWorld(next);
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
        const result = rollDamage(player.stats.attack, monsterTarget.defense, player.stats.level - monsterTarget.level);
        monsterTarget.hp = Math.max(0, monsterTarget.hp - result.damage);
        this.emitFloating(monsterTarget.id, monsterTarget.position, result.damage, "damage", result.crit ? `${result.damage} crit` : undefined);
        if (monsterTarget.hp <= 0) this.killMonster(player, monsterTarget, now);
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
      if (!player || distance(monster.position, player.position) > MONSTER_ATTACK_RANGE) continue;
      if (Date.now() - monster.lastAttackAt < MONSTER_ATTACK_COOLDOWN_MS) continue;

      monster.lastAttackAt = Date.now();
      const result = rollDamage(monster.attack, player.stats.defense, monster.level - player.stats.level);
      player.stats.hp = Math.max(0, player.stats.hp - result.damage);
      this.emitFloating(player.id, player.position, result.damage, "damage");
      if (player.stats.hp <= 0) {
        player.position = { ...townSpawn };
        player.stats.hp = Math.ceil(player.stats.maxHp * 0.65);
        this.sockets.get(player.id)?.emit("system", "Bạn đã bị hạ gục và được đưa về thị trấn.");
      }
      this.sockets.get(player.id)?.emit("player", player);
    }
  }

  private killMonster(player: PlayerState, monster: MonsterState, now: number): void {
    monster.respawnsAt = now + 6500 + monster.level * 900;
    monster.velocity = { x: 0, y: 0 };
    monster.targetPlayerId = undefined;
    this.returningToSpawn.delete(monster.id);

    const exp = Math.floor((28 + monster.level * 18) * (monster.elite ? ELITE_REWARD_MULTIPLIER : 1));
    const gold = goldForMonster(monster);
    const leveled = grantExp(player.stats, exp);
    player.stats = leveled.stats;
    player.stats.gold += gold;
    this.emitFloating(player.id, player.position, exp, "exp", `+${exp} exp`);
    this.emitFloating(player.id, player.position, gold, "loot", `+${gold} gold`);
    if (leveled.leveled) this.emitFloating(player.id, player.position, player.stats.level, "level", `Level ${player.stats.level}`);

    const lootItem = createLoot(monster.level, monster.type, monster.elite);
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
      }
    }
    this.sockets.get(player.id)?.emit("loot", { playerId: player.id, gold, item: collectedItem });
    this.tryAutoRetarget(player);

    this.sockets.get(player.id)?.emit("player", player);
    void this.repository.save(player);
  }

  private updateRespawns(now: number): void {
    for (const monster of this.monsters) {
      if (!monster.respawnsAt || monster.respawnsAt > now) continue;
      monster.hp = monster.maxHp;
      monster.position = { ...monster.spawn };
      monster.respawnsAt = undefined;
      this.returningToSpawn.delete(monster.id);
      rerollMonsterRank(monster);
    }
  }

  private cleanupGroundItems(now: number): void {
    for (const [id, groundItem] of this.groundItems) {
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
    if (!attacker.targetId || isInTown(attacker.position)) return undefined;
    const target = this.players.get(attacker.targetId);
    if (!target || target.id === attacker.id || isInTown(target.position)) return undefined;
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
      target.stats.hp = Math.ceil(target.stats.maxHp * 0.55);
      attacker.targetId = undefined;
      this.sockets.get(target.id)?.emit("system", `Bạn đã bị ${attacker.accountName} hạ gục và được đưa về thị trấn.`);
      this.sockets.get(attacker.id)?.emit("system", `Bạn đã hạ gục ${target.accountName}.`);
      void this.repository.save(target);
      void this.repository.save(attacker);
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

function createMonsterSpawns(): MonsterState[] {
  const spawns = [
    ["forestSlime", 16, 10],
    ["forestSlime", 18, 12],
    ["wildBoar", 21, 9],
    ["caveBat", 24, 11],
    ["goblinScout", 26, 13],
    ["goblinScout", 29, 15],
    ["direWolf", 34, 18],
    ["direWolf", 38, 20],
    ["mossCrawler", 31, 23],
    ["stoneImp", 22, 24],
    ["stoneImp", 27, 26],
    ["emberSprite", 18, 21],
    ["cursedTreant", 33, 27],
    ["cursedTreant", 39, 28],
    ["ashWraith", 43, 15],
    ["ashWraith", 44, 21],
    ["frostRevenant", 36, 10],
    ["crystalGolem", 15, 27],
    ["crystalGolem", 18, 29],
    ["bloodHarpy", 42, 10],
    ["ancientDrake", 42, 27],
    ["voidKnight", 30, 29],
    ["elderHydra", 45, 29]
  ] as const;

  return spawns.map(([type, tx, ty], index) => {
    const definition = getMonsterDefinition(type);
    const elite = rollElite();
    const maxHp = monsterMaxHp(definition, elite);
    return {
      id: `monster-${index}`,
      type,
      name: definition.name,
      elite,
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
      lastAttackAt: 0
    };
  });
}

function rerollMonsterRank(monster: MonsterState): void {
  const definition = getMonsterDefinition(monster.type);
  monster.elite = rollElite();
  monster.maxHp = monsterMaxHp(definition, monster.elite);
  monster.hp = monster.maxHp;
  monster.attack = monsterAttack(definition, monster.elite);
  monster.defense = monsterDefense(definition, monster.elite);
}

function rollElite(): boolean {
  return Math.random() < ELITE_CHANCE;
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

function cloneShopItem(offer: ShopItem): Item {
  const base = {
    id: crypto.randomUUID(),
    name: offer.name,
    rarity: offer.rarity,
    value: offer.value
  };
  return offer.kind === "consumable"
    ? { ...base, kind: "consumable", heal: offer.heal }
    : { ...base, kind: "equipment", slot: offer.slot, stats: { ...offer.stats } };
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

function isInTown(position: { x: number; y: number }): boolean {
  return position.x < 11 * TILE_SIZE && position.y < 11 * TILE_SIZE;
}

function goldForMonster(monster: MonsterState): number {
  const definition = getMonsterDefinition(monster.type);
  const base = 6 + monster.level * 6;
  const toughness = definition.hpMultiplier + definition.attackMultiplier + definition.defenseMultiplier;
  const gold = Math.max(3, Math.floor(base * toughness * 0.55 + Math.random() * (monster.level * 8 + 8)));
  return monster.elite ? Math.floor(gold * ELITE_REWARD_MULTIPLIER) : gold;
}

function sellValue(value: number): number {
  return Math.max(1, Math.floor(value * SELL_VALUE_RATE));
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
