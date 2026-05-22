import type { Server, Socket } from "socket.io";
import {
  CLEAVE_COOLDOWN_MS,
  CLEAVE_DAMAGE_MULTIPLIER,
  CLEAVE_RADIUS,
  INVENTORY_CAPACITY,
  MONSTER_ATTACK_COOLDOWN_MS,
  MONSTER_ATTACK_RANGE,
  MONSTER_SPEED,
  POWER_STRIKE_COOLDOWN_MS,
  POWER_STRIKE_DAMAGE_MULTIPLIER,
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
  PartyView,
  QuestListPayload,
  QuestView,
  ShopItem,
  ServerToClientEvents,
  SkillId,
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
const WORLD_BOSS_RESPAWN_MS = 4 * 60 * 1000;
const WORLD_BOSS_REWARD_MULTIPLIER = 8;
const MAX_ACTIVE_QUESTS = 3;
const PARTY_MAX_SIZE = 4;
const PARTY_INVITE_RANGE = 600;
const PARTY_SHARE_RANGE = 360;

interface Party {
  id: string;
  leaderId: string;
  memberIds: string[];
}

interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  required: number;
  rewardGold: number;
  rewardExp: number;
  objective: { kind: "killAny" } | { kind: "killLevel"; minLevel: number } | { kind: "reachLevel"; level: number };
}

interface ActiveQuestState {
  questId: string;
  progress: number;
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: "cull-greenwood",
    title: "Cull Greenwood",
    description: "Defeat 5 monsters anywhere.",
    required: 5,
    rewardGold: 45,
    rewardExp: 90,
    objective: { kind: "killAny" }
  },
  {
    id: "prove-midlands",
    title: "Prove the Midlands",
    description: "Defeat 4 monsters level 4 or higher.",
    required: 4,
    rewardGold: 95,
    rewardExp: 180,
    objective: { kind: "killLevel", minLevel: 4 }
  },
  {
    id: "reach-level-five",
    title: "Reach Level 5",
    description: "Reach character level 5.",
    required: 5,
    rewardGold: 150,
    rewardExp: 260,
    objective: { kind: "reachLevel", level: 5 }
  }
];

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
        position: saved.position ? { ...saved.position } : { ...townSpawn },
        velocity: { x: 0, y: 0 },
        facing: "down",
        stats: saved.stats,
        inventory: saved.inventory,
        lastAttackAt: 0,
        skillCooldowns: createSkillCooldowns()
      };
      this.players.set(socket.id, player);
      this.sockets.set(socket.id, socket);
      this.activeQuests.set(socket.id, []);
      socket.emit("init", { selfId: socket.id, snapshot: this.snapshot() });
      socket.emit("player", player);
      this.emitQuestList(player);
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

    socket.on("acceptQuest", ({ questId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      const quest = questById(questId);
      if (!quest) return;
      const active = this.activeQuests.get(socket.id) ?? [];
      if (active.some((entry) => entry.questId === questId)) {
        socket.emit("system", "Quest already accepted.");
        return;
      }
      if (active.length >= MAX_ACTIVE_QUESTS) {
        socket.emit("system", "Quest log is full.");
        return;
      }
      active.push({ questId, progress: initialQuestProgress(quest, player) });
      this.activeQuests.set(socket.id, active);
      this.updateReachLevelQuests(player);
      this.emitQuestList(player);
    });

    socket.on("claimQuest", async ({ questId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      this.updateReachLevelQuests(player);
      const active = this.activeQuests.get(socket.id) ?? [];
      const index = active.findIndex((entry) => entry.questId === questId);
      const template = questById(questId);
      if (index < 0 || !template) return;
      if (!isQuestComplete(active[index], template)) {
        socket.emit("system", "Quest is not complete yet.");
        this.emitQuestList(player);
        return;
      }
      active.splice(index, 1);
      player.stats.gold += template.rewardGold;
      const leveled = grantExp(player.stats, template.rewardExp);
      player.stats = leveled.stats;
      this.emitFloating(player.id, player.position, template.rewardExp, "exp", `+${template.rewardExp} exp`);
      this.emitFloating(player.id, player.position, template.rewardGold, "loot", `+${template.rewardGold} gold`);
      if (leveled.leveled) this.emitFloating(player.id, player.position, player.stats.level, "level", `Level ${player.stats.level}`);
      this.updateReachLevelQuests(player);
      socket.emit("player", player);
      socket.emit("system", `Quest complete: ${template.title}.`);
      this.emitQuestList(player);
      await this.repository.save(player);
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
      for (const memberId of party.memberIds) {
        this.sockets.get(memberId)?.emit("system", `${player.accountName} đã vào tổ đội.`);
      }
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

    socket.on("useSkill", ({ skillId }) => {
      const player = this.players.get(socket.id);
      if (!player) return;
      this.useSkill(player, skillId, Date.now());
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

  private useSkill(player: PlayerState, skillId: SkillId, now: number): void {
    if (now < player.skillCooldowns[skillId]) {
      this.sockets.get(player.id)?.emit("system", "Kỹ năng đang hồi.");
      return;
    }

    if (skillId === "powerStrike") {
      const target = this.selectedLivingMonster(player);
      if (!target || distance(player.position, target.position) > PLAYER_ATTACK_RANGE) {
        this.sockets.get(player.id)?.emit("system", "Cần chọn quái trong tầm để dùng Power Strike.");
        return;
      }
      player.skillCooldowns.powerStrike = now + POWER_STRIKE_COOLDOWN_MS;
      this.damageMonster(player, target, POWER_STRIKE_DAMAGE_MULTIPLIER, now, "Power");
      this.sockets.get(player.id)?.emit("player", player);
      return;
    }

    const targets = this.monsters.filter((monster) => !monster.respawnsAt && monster.hp > 0 && distance(player.position, monster.position) <= CLEAVE_RADIUS);
    if (targets.length === 0) {
      this.sockets.get(player.id)?.emit("system", "Không có quái nào trong tầm Cleave.");
      return;
    }
    player.skillCooldowns.cleave = now + CLEAVE_COOLDOWN_MS;
    for (const monster of targets) this.damageMonster(player, monster, CLEAVE_DAMAGE_MULTIPLIER, now, "Cleave");
    this.sockets.get(player.id)?.emit("player", player);
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
      const leveled = grantExp(recipient.stats, exp);
      recipient.stats = leveled.stats;
      if (leveled.leveled) this.updateReachLevelQuests(recipient);
      this.emitFloating(recipient.id, recipient.position, exp, "exp", `+${exp} exp`);
      if (leveled.leveled) this.emitFloating(recipient.id, recipient.position, recipient.stats.level, "level", `Level ${recipient.stats.level}`);
      if (recipient.id !== player.id) {
        this.sockets.get(recipient.id)?.emit("player", recipient);
        void this.repository.save(recipient);
      }
    }
    this.updateQuestProgressForKill(player, monster);
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
      }
    }
    if (monster.boss) {
      this.io.emit("bossAnnounce", { kind: "defeat", bossName: monster.name, accountName: player.accountName });
    }
    this.sockets.get(player.id)?.emit("loot", { playerId: player.id, gold, item: collectedItem });
    this.tryAutoRetarget(player);
    this.emitQuestList(player);

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
      if (template.objective.kind === "killAny" || (template.objective.kind === "killLevel" && monster.level >= template.objective.minLevel)) {
        entry.progress = Math.min(template.required, entry.progress + 1);
      }
    }
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
    ["forestSlime", 15, 9],
    ["forestSlime", 17, 11],
    ["wildBoar", 19, 9],
    ["caveBat", 20, 13],
    ["goblinScout", 23, 14],
    ["goblinScout", 25, 16],
    ["direWolf", 29, 17],
    ["direWolf", 32, 18],
    ["mossCrawler", 30, 22],
    ["stoneImp", 34, 20],
    ["stoneImp", 36, 23],
    ["emberSprite", 28, 24],
    ["cursedTreant", 38, 24],
    ["cursedTreant", 40, 26],
    ["ashWraith", 43, 17],
    ["ashWraith", 45, 20],
    ["frostRevenant", 42, 14],
    ["crystalGolem", 38, 28],
    ["crystalGolem", 41, 29],
    ["bloodHarpy", 44, 12],
    ["ancientDrake", 43, 26],
    ["voidKnight", 35, 29],
    ["elderHydra", 45, 29]
  ] as const;

  const monsters: MonsterState[] = spawns.map(([type, tx, ty], index) => {
    const definition = getMonsterDefinition(type);
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
  monsters.push(createWorldBoss());
  return monsters;
}

function rerollMonsterRank(monster: MonsterState): void {
  const definition = getMonsterDefinition(monster.type);
  monster.elite = rollElite();
  monster.maxHp = monsterMaxHp(definition, monster.elite);
  monster.hp = monster.maxHp;
  monster.attack = monsterAttack(definition, monster.elite);
  monster.defense = monsterDefense(definition, monster.elite);
}

function createWorldBoss(): MonsterState {
  const definition = getMonsterDefinition("eternalWarden");
  const maxHp = monsterMaxHp(definition);
  return {
    id: "world-boss-eternal-warden",
    type: definition.type,
    name: definition.name,
    elite: false,
    boss: true,
    level: definition.level,
    position: { x: 45 * TILE_SIZE, y: 24 * TILE_SIZE },
    spawn: { x: 45 * TILE_SIZE, y: 24 * TILE_SIZE },
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
    cleave: 0
  };
}

function questById(questId: string): QuestTemplate | undefined {
  return QUEST_TEMPLATES.find((quest) => quest.id === questId);
}

function initialQuestProgress(quest: QuestTemplate, player: PlayerState): number {
  return quest.objective.kind === "reachLevel" ? Math.min(quest.required, player.stats.level) : 0;
}

function isQuestComplete(entry: ActiveQuestState, quest: QuestTemplate): boolean {
  return entry.progress >= quest.required;
}

function questListFor(player: PlayerState, active: ActiveQuestState[]): QuestListPayload {
  const activeIds = new Set(active.map((entry) => entry.questId));
  return {
    available: QUEST_TEMPLATES
      .filter((quest) => !activeIds.has(quest.id))
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
    rewardExp: quest.rewardExp
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
