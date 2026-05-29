import Phaser from "phaser";
import {
  PLAYER_SPEED,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clampToWorld,
  getMonsterDefinition
} from "@mmorpg/shared";
import type { ClientInput, Direction, GroundItem, MonsterState, PlayerState, Vec2, WorldSnapshot } from "@mmorpg/shared";
import { createSocket, type GameSocket } from "../net/socket";
import { Hud } from "../ui/hud";
import { createPixelArt } from "./assets";
import { t, translateMonsterName } from "../i18n";
import { soundManager } from "../sound";

const INTERPOLATION_DELAY_MS = 100;
const MAX_SNAPSHOT_BUFFER = 8;
const LOCAL_SNAP_DISTANCE = 64;
const LOCAL_RECONCILE_ALPHA = 0.16;

export class GameScene extends Phaser.Scene {
  private socket!: GameSocket;
  private hud!: Hud;
  private selfId = "";
  private cursors!: Record<"F" | "Q" | "W" | "E" | "R", Phaser.Input.Keyboard.Key>;
  private seq = 0;
  private players = new Map<string, Phaser.GameObjects.Sprite>();
  private names = new Map<string, Phaser.GameObjects.Text>();
  private playerBars = new Map<string, Phaser.GameObjects.Graphics>();
  private playerEquipment = new Map<string, Phaser.GameObjects.Graphics>();
  private monsters = new Map<string, Phaser.GameObjects.Sprite>();
  private monsterBars = new Map<string, Phaser.GameObjects.Graphics>();
  private monsterLabels = new Map<string, Phaser.GameObjects.Text>();
  private groundItems = new Map<string, Phaser.GameObjects.Sprite>();
  private groundItemLabels = new Map<string, Phaser.GameObjects.Text>();
  private moveTarget?: Phaser.Math.Vector2;
  private moveMarker?: Phaser.GameObjects.Graphics;
  private selfPlayer?: PlayerState;
  private partyMemberIds = new Set<string>();
  private snapshotBuffer: WorldSnapshot[] = [];
  private serverClockOffset = 0;
  private predictedSelfPosition?: Vec2;
  private predictedSelfFacing: Direction = "down";
  private authoritativeSelfPosition?: Vec2;
  private loggedIn = false;
  private formCaptureHandlers: Array<{ type: string; handler: EventListener }> = [];

  preload(): void {}

  create(): void {
    createPixelArt(this);
    this.createMap();

    this.hud = new Hud(
      (itemId) => this.socket.emit("equipItem", { itemId }),
      (slot) => this.socket.emit("unequipItem", { slot }),
      (message) => this.socket.emit("chatMessage", { message }),
      (shopId) => this.socket.emit("buyShopItem", { shopId }),
      (itemId) => this.socket.emit("sellItem", { itemId }),
      (itemId) => this.socket.emit("dropItem", { itemId }),
      (itemId) => this.socket.emit("useItem", { itemId }),
      () => this.socket.emit("sellJunk"),
      (skillId) => {
        soundManager.markUserGesture();
        soundManager.play("skill");
        this.socket.emit("useSkill", { skillId });
      },
      (slot, skillId) => this.socket.emit("equipSkill", { slot, skillId }),
      (skillId) => this.socket.emit("learnSkill", { skillId }),
      (questId) => this.socket.emit("acceptQuest", { questId }),
      (questId) => this.socket.emit("claimQuest", { questId }),
      (enabled) => this.socket.emit("setAutoRetarget", { enabled }),
      (zone) => this.socket.emit("setAfkZone", { zone }),
      (stat) => this.socket.emit("allocateStat", { stat }),
      () => this.inviteCurrentTarget(),
      (partyId) => this.socket.emit("acceptParty", { partyId }),
      () => this.socket.emit("leaveParty"),
      () => soundManager.toggleMuted(),
      () => soundManager.isMuted()
    );
    this.socket = createSocket();
    this.registerSocketEvents();

    this.cursors = this.input.keyboard!.addKeys("F,Q,W,E,R") as Record<"F" | "Q" | "W" | "E" | "R", Phaser.Input.Keyboard.Key>;
    this.setupLoginForm();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.applyPixelPerfectZoom();
    this.scale.on("resize", () => this.applyPixelPerfectZoom());
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      if (!pointer.rightButtonDown() || objects.length > 0) return;
      this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      this.drawMoveMarker();
    });
  }


  update(time: number, delta: number): void {
    if (!this.socket?.connected || !this.loggedIn) return;
    if (isEditableFocused() || this.hud.isOfflineRewardsOpen()) {
      const input = this.neutralInput();
      this.clearMoveTarget();
      this.socket.emit("input", input);
      this.predictLocalPlayer(input, delta);
      this.renderBufferedWorld(time);
      return;
    }
    const input: ClientInput = {
      seq: this.seq++,
      up: false,
      down: false,
      left: false,
      right: false,
      moveTarget: this.moveTarget ? { x: this.moveTarget.x, y: this.moveTarget.y } : undefined
    };
    if (Phaser.Input.Keyboard.JustDown(this.cursors.F)) this.useFirstPotion();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.Q)) this.useSkillSlot(0);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.W)) this.useSkillSlot(1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.E)) this.useSkillSlot(2);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.R)) this.useSkillSlot(3);
    this.socket.emit("input", input);
    this.predictLocalPlayer(input, delta);
    this.renderBufferedWorld(time);
  }

  private neutralInput(): ClientInput {
    return {
      seq: this.seq++,
      up: false,
      down: false,
      left: false,
      right: false
    };
  }

  private applyPixelPerfectZoom(): void {
    const worldW = WORLD_WIDTH * TILE_SIZE;
    const worldH = WORLD_HEIGHT * TILE_SIZE;
    // Largest integer scale that still keeps the world visible on the smaller axis.
    // Integer zoom keeps pixel art crisp (no fractional scaling artefacts).
    const fitX = this.scale.width / worldW;
    const fitY = this.scale.height / worldH;
    const need = Math.max(fitX, fitY); // fill the viewport
    const zoom = Math.max(1, Math.ceil(need));
    this.cameras.main.setZoom(zoom);
  }

  private createMap(): void {
    const data: number[][] = [];
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const town = x < 11 && y < 11;
        const road = x === 10 || y === 10 || (x > 18 && x < 42 && y === 22);
        const deep = x >= 36 && y >= 12;
        row.push(town ? 1 : road ? 2 : deep ? 3 : 0);
      }
      data.push(row);
    }

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tiles = map.addTilesetImage("tiles", "tiles", TILE_SIZE, TILE_SIZE);
    map.createLayer(0, tiles!, 0, 0);

    this.add.rectangle(6 * TILE_SIZE, 8 * TILE_SIZE, 210, 120, 0x39424b, 0.55).setDepth(1);
    this.addZoneLabel(7 * TILE_SIZE, 9 * TILE_SIZE, t("town"), 18, "#f3e7bf");
    this.addZoneLabel(19 * TILE_SIZE, 12 * TILE_SIZE, t("zoneGreenwood"), 15, "#d8e9bf");
    this.addZoneLabel(31.5 * TILE_SIZE, 20.5 * TILE_SIZE, t("zoneMidlands"), 15, "#d8d6c2");
    this.addZoneLabel(42 * TILE_SIZE, 18.5 * TILE_SIZE, t("zoneDeeplands"), 16, "#e5b0ff");
  }

  private addZoneLabel(x: number, y: number, label: string, fontSize: number, color: string): void {
    this.add.text(x, y, label, {
      fontFamily: "monospace",
      fontSize: `${fontSize}px`,
      color,
      stroke: "#080a0a",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0.82).setDepth(2);
  }

  private registerSocketEvents(): void {
    this.socket.on("init", ({ selfId, snapshot }) => {
      this.selfId = selfId;
      this.loggedIn = true;
      this.enableGameKeyboard();
      document.querySelector("#login-overlay")?.classList.add("hidden");
      this.applySnapshot(snapshot);
    });

    this.socket.on("session", ({ token }) => localStorage.setItem("sessionToken", token));

    // Auto re-login on (re)connect when a session token is stored. This handles
    // dev-server hot-reloads / brief network drops without forcing the player
    // to retype credentials. If the token is no longer valid, the server emits
    // a system error which falls back to the manual login form.
    this.socket.on("connect", () => {
      if (this.loggedIn) return;
      const savedToken = localStorage.getItem("sessionToken");
      if (savedToken) this.socket.emit("login", { token: savedToken });
    });

    // If the server goes away mid-session (eg. dev-server restart), surface
    // the login overlay again instead of leaving the client silently broken.
    this.socket.on("disconnect", () => {
      if (!this.loggedIn) return;
      this.loggedIn = false;
      this.disableGameKeyboard();
      document.querySelector("#login-overlay")?.classList.remove("hidden");
      const error = document.querySelector("#login-error");
      if (error) error.textContent = "Mất kết nối với máy chủ, đang thử lại...";
    });

    this.socket.on("snapshot", (snapshot) => this.applySnapshot(snapshot));

    this.socket.on("player", (player) => {
      if (player.id === this.selfId) {
        this.selfPlayer = player;
        this.reconcileLocalPlayer(player.position);
        this.updateTargetPanel();
        if (this.moveTarget && Phaser.Math.Distance.Between(player.position.x, player.position.y, this.moveTarget.x, this.moveTarget.y) < 8) {
          this.clearMoveTarget();
        }
        this.hud.setPlayer(player);
      }
    });

    this.socket.on("floatingText", (event) => {
      const color = event.kind === "damage" ? "#ff6961" : event.kind === "loot" ? "#f7d774" : "#8be78b";
      const text = this.add.text(event.position.x, event.position.y - 28, event.text ?? `${event.amount}`, {
        fontFamily: "monospace",
        fontSize: event.kind === "level" ? "18px" : "14px",
        color,
        stroke: "#111",
        strokeThickness: 3
      }).setDepth(20).setOrigin(0.5);
      this.tweens.add({
        targets: text,
        y: text.y - 34,
        alpha: 0,
        duration: 900,
        onComplete: () => text.destroy()
      });
      if (event.kind === "damage") {
        if (this.monsters.has(event.entityId)) soundManager.play("hit");
        this.playHitEffect(event.entityId, event.position);
      }
      if (event.kind === "level") soundManager.play("levelUp");
    });

    this.socket.on("loot", ({ item, gold }) => {
      if (item) soundManager.play("loot");
      this.hud.log(
        item
          ? t("lootedGoldItem", { gold, rarity: t(item.rarity), item: item.name })
          : t("lootedGold", { gold }),
        item ? `loot-line rarity-${item.rarity}` : "loot-line"
      );
    });
    this.socket.on("offlineRewards", (payload) => {
      this.hud.showOfflineRewards(payload);
      soundManager.play("modalOpen");
    });
    this.socket.on("achievementUnlocked", (achievement) => {
      this.hud.showAchievementToast(achievement);
    });
    this.socket.on("announce", ({ accountName, itemName, rarity }) => {
      this.hud.announceDrop(accountName, itemName, rarity);
    });
    this.socket.on("bossAnnounce", ({ kind, bossName, accountName }) => {
      this.hud.log(
        kind === "spawn"
          ? t("bossAppeared", { boss: translateMonsterName(bossName) })
          : t("bossDefeated", { name: accountName ?? "", boss: translateMonsterName(bossName) }),
        "announcement announcement-epic"
      );
    });
    this.socket.on("chatHistory", (messages) => this.hud.setChatHistory(messages));
    this.socket.on("chatMessage", (message) => this.hud.appendChat(message));
    this.socket.on("shopStock", (items) => this.hud.setShopStock(items));
    this.socket.on("questList", (quests) => this.hud.setQuests(quests));
    this.socket.on("partyUpdate", (party) => {
      this.partyMemberIds = new Set((party?.members ?? []).map((member) => member.id));
      this.hud.setParty(party);
    });
    this.socket.on("partyInvite", (invite) => this.hud.showPartyInvite(invite));
    this.socket.on("system", (message) => {
      if (!this.loggedIn) {
        localStorage.removeItem("sessionToken");
        const error = document.querySelector("#login-error");
        if (error) error.textContent = message;
      }
      this.hud.log(message);
    });
  }

  private setupLoginForm(): void {
    this.disableGameKeyboard();
    const overlay = document.querySelector("#login-overlay") as HTMLElement;
    const form = document.querySelector("#login-form") as HTMLFormElement;
    const emailInput = document.querySelector("#email-input") as HTMLInputElement;
    const nameInput = document.querySelector("#name-input") as HTMLInputElement;
    const passwordInput = document.querySelector("#password-input") as HTMLInputElement;
    const error = document.querySelector("#login-error") as HTMLElement;

    this.captureFormEvents(overlay);

    document.querySelector("#login-copy")!.textContent = t("loginCopy");
    document.querySelector("#email-label")!.textContent = t("email");
    document.querySelector("#name-label")!.textContent = t("characterName");
    document.querySelector("#password-label")!.textContent = t("password");
    document.querySelector("#login-button")!.textContent = t("enterGame");
    emailInput.value = localStorage.getItem("loginEmail") ?? "";
    nameInput.value = localStorage.getItem("accountName") ?? "";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const accountName = nameInput.value.trim() || email.split("@")[0] || "hero";
      const password = passwordInput.value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error.textContent = t("invalidEmail");
        return;
      }
      if (password.length < 4) {
        error.textContent = t("passwordHint");
        return;
      }
      error.textContent = "";
      localStorage.setItem("loginEmail", email);
      localStorage.setItem("accountName", accountName);
      soundManager.markUserGesture();
      this.socket.emit("login", { email, accountName, password });
    });

    // Token-based auto-login is handled by the socket "connect" handler in
    // registerSocketEvents so it also fires on reconnect, not just first load.
    emailInput.focus();
  }

  private disableGameKeyboard(): void {
    if (!this.input.keyboard) return;
    this.input.keyboard.enabled = false;
    this.input.keyboard.removeAllKeys();
  }

  private enableGameKeyboard(): void {
    if (!this.input.keyboard) return;
    this.input.keyboard.enabled = true;
    this.cursors = this.input.keyboard.addKeys("F,Q,W,E,R") as Record<"F" | "Q" | "W" | "E" | "R", Phaser.Input.Keyboard.Key>;
  }

  private captureFormEvents(overlay: HTMLElement): void {
    const eventTypes = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "keydown", "keyup", "keypress", "input", "beforeinput"];
    for (const type of eventTypes) {
      const handler = (event: Event) => {
        event.stopPropagation();
        if (type.startsWith("key")) event.stopImmediatePropagation();
      };
      overlay.addEventListener(type, handler, true);
      this.formCaptureHandlers.push({ type, handler });
    }
  }

  private applySnapshot(snapshot: WorldSnapshot): void {
    this.pushSnapshot(snapshot);
    const seenPlayers = new Set<string>();
    for (const player of snapshot.players) {
      seenPlayers.add(player.id);
      if (player.id === this.selfId) {
        this.selfPlayer = player;
        this.reconcileLocalPlayer(player.position);
      }
      const currentPosition = player.id === this.selfId
        ? this.predictedSelfPosition ?? player.position
        : this.players.get(player.id) ?? player.position;
      this.renderPlayer(player, currentPosition);
    }
    for (const [id, sprite] of this.players) {
      if (!seenPlayers.has(id)) {
        sprite.destroy();
        this.players.delete(id);
        this.names.get(id)?.destroy();
        this.names.delete(id);
        this.playerBars.get(id)?.destroy();
        this.playerBars.delete(id);
        this.playerEquipment.get(id)?.destroy();
        this.playerEquipment.delete(id);
      }
    }

    const seenMonsters = new Set<string>();
    for (const monster of snapshot.monsters) {
      seenMonsters.add(monster.id);
      this.renderMonster(monster, this.monsters.get(monster.id) ?? monster.position);
    }
    for (const [id, sprite] of this.monsters) {
      if (!seenMonsters.has(id)) {
        sprite.destroy();
        this.monsters.delete(id);
        this.monsterBars.get(id)?.destroy();
        this.monsterBars.delete(id);
        this.monsterLabels.get(id)?.destroy();
        this.monsterLabels.delete(id);
      }
    }

    const seenGroundItems = new Set<string>();
    for (const groundItem of snapshot.groundItems) {
      seenGroundItems.add(groundItem.id);
      this.renderGroundItem(groundItem);
    }
    for (const [id, sprite] of this.groundItems) {
      if (!seenGroundItems.has(id)) {
        sprite.destroy();
        this.groundItems.delete(id);
        this.groundItemLabels.get(id)?.destroy();
        this.groundItemLabels.delete(id);
      }
    }
    this.updateTargetPanel(snapshot);
    this.hud.updatePartyVitals(snapshot.players);
  }

  private updateTargetPanel(snapshot = this.snapshotBuffer[this.snapshotBuffer.length - 1]): void {
    const targetId = this.selfPlayer?.targetId;
    const target = targetId ? snapshot?.monsters.find((monster) => monster.id === targetId) : undefined;
    this.hud.setTarget(target);
  }

  private pushSnapshot(snapshot: WorldSnapshot): void {
    this.snapshotBuffer.push(snapshot);
    this.snapshotBuffer.sort((a, b) => a.serverTime - b.serverTime);
    while (this.snapshotBuffer.length > MAX_SNAPSHOT_BUFFER) this.snapshotBuffer.shift();
    const measuredOffset = snapshot.serverTime - this.time.now;
    this.serverClockOffset = this.serverClockOffset === 0
      ? measuredOffset
      : Phaser.Math.Linear(this.serverClockOffset, measuredOffset, 0.08);
  }

  private renderBufferedWorld(time: number): void {
    if (this.snapshotBuffer.length === 0) return;
    const renderServerTime = time + this.serverClockOffset - INTERPOLATION_DELAY_MS;
    const pair = this.snapshotPairFor(renderServerTime);
    const playersFrom = new Map(pair.from.players.map((player) => [player.id, player]));
    for (const player of pair.to.players) {
      const previous = playersFrom.get(player.id);
      if (player.id === this.selfId) {
        this.renderPlayer(player, this.predictedSelfPosition ?? player.position);
        continue;
      }
      const position = previous
        ? interpolatePosition(previous.position, player.position, pair.alpha)
        : player.position;
      this.renderPlayer(player, position);
    }

    const monstersFrom = new Map(pair.from.monsters.map((monster) => [monster.id, monster]));
    for (const monster of pair.to.monsters) {
      const previous = monstersFrom.get(monster.id);
      const position = previous
        ? interpolatePosition(previous.position, monster.position, pair.alpha)
        : monster.position;
      this.renderMonster(monster, position);
    }
  }

  private snapshotPairFor(renderServerTime: number): { from: WorldSnapshot; to: WorldSnapshot; alpha: number } {
    const first = this.snapshotBuffer[0];
    const last = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (!first || !last || renderServerTime <= first.serverTime) return { from: first ?? last, to: first ?? last, alpha: 1 };
    if (renderServerTime >= last.serverTime) return { from: last, to: last, alpha: 1 };

    for (let i = 0; i < this.snapshotBuffer.length - 1; i += 1) {
      const from = this.snapshotBuffer[i];
      const to = this.snapshotBuffer[i + 1];
      if (renderServerTime >= from.serverTime && renderServerTime <= to.serverTime) {
        const duration = Math.max(1, to.serverTime - from.serverTime);
        return { from, to, alpha: Phaser.Math.Clamp((renderServerTime - from.serverTime) / duration, 0, 1) };
      }
    }
    return { from: last, to: last, alpha: 1 };
  }

  private predictLocalPlayer(input: ClientInput, deltaMs: number): void {
    if (!this.selfPlayer) return;
    if (!this.predictedSelfPosition) this.predictedSelfPosition = { ...this.selfPlayer.position };

    const dt = deltaMs / 1000;
    const axis = {
      x: Number(input.right) - Number(input.left),
      y: Number(input.down) - Number(input.up)
    };
    const manualLength = Math.hypot(axis.x, axis.y);
    let velocity = { x: 0, y: 0 };
    if (manualLength > 0) {
      velocity = { x: (axis.x / manualLength) * PLAYER_SPEED, y: (axis.y / manualLength) * PLAYER_SPEED };
    } else if (input.moveTarget) {
      const dx = input.moveTarget.x - this.predictedSelfPosition.x;
      const dy = input.moveTarget.y - this.predictedSelfPosition.y;
      const targetDistance = Math.hypot(dx, dy);
      if (targetDistance > 5) {
        velocity = { x: (dx / targetDistance) * PLAYER_SPEED, y: (dy / targetDistance) * PLAYER_SPEED };
      }
    }

    this.predictedSelfPosition = clampToWorld({
      x: this.predictedSelfPosition.x + velocity.x * dt,
      y: this.predictedSelfPosition.y + velocity.y * dt
    });
    this.predictedSelfFacing = facingFromAxis(velocity, this.predictedSelfFacing);

    if (this.authoritativeSelfPosition) {
      this.predictedSelfPosition = {
        x: Phaser.Math.Linear(this.predictedSelfPosition.x, this.authoritativeSelfPosition.x, LOCAL_RECONCILE_ALPHA),
        y: Phaser.Math.Linear(this.predictedSelfPosition.y, this.authoritativeSelfPosition.y, LOCAL_RECONCILE_ALPHA)
      };
    }

    if (this.moveTarget && Phaser.Math.Distance.Between(this.predictedSelfPosition.x, this.predictedSelfPosition.y, this.moveTarget.x, this.moveTarget.y) < 8) {
      this.clearMoveTarget();
    }
  }

  private reconcileLocalPlayer(serverPosition: Vec2): void {
    this.authoritativeSelfPosition = { ...serverPosition };
    if (!this.predictedSelfPosition) {
      this.predictedSelfPosition = { ...serverPosition };
      return;
    }
    if (Phaser.Math.Distance.Between(this.predictedSelfPosition.x, this.predictedSelfPosition.y, serverPosition.x, serverPosition.y) > LOCAL_SNAP_DISTANCE) {
      this.predictedSelfPosition = { ...serverPosition };
    }
  }

  private renderPlayer(player: PlayerState, position: Vec2): void {
    let sprite = this.players.get(player.id);
    if (!sprite) {
      sprite = this.add.sprite(position.x, position.y, "player").setScale(3).setDepth(10);
      if (player.id !== this.selfId) {
        sprite.setInteractive({ useHandCursor: true });
        sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (pointer.leftButtonDown()) this.socket.emit("targetPlayer", { playerId: player.id });
        });
      }
      this.players.set(player.id, sprite);
      const name = this.add.text(position.x, position.y - 34, player.accountName, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: player.id === this.selfId ? "#a8d8ff" : "#f1f1f1",
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(11);
      this.names.set(player.id, name);
      this.playerBars.set(player.id, this.add.graphics().setDepth(12));
      this.playerEquipment.set(player.id, this.add.graphics().setDepth(13));
      if (player.id === this.selfId) this.cameras.main.startFollow(sprite, true, 0.12, 0.12);
    }
    const facing = player.id === this.selfId ? this.predictedSelfFacing : player.facing;
    sprite.setPosition(position.x, position.y);
    sprite.setFlipX(facing === "left");
    if (player.id !== this.selfId) {
      sprite.disableInteractive();
      sprite.setInteractive({ useHandCursor: true });
    }
    const nameColor = player.id === this.selfId ? "#a8d8ff" : this.partyMemberIds.has(player.id) ? "#8be78b" : "#f1f1f1";
    this.names.get(player.id)?.setText(player.accountName).setColor(nameColor).setPosition(position.x, position.y - 42);
    this.drawPlayerBar(player, position);
    this.drawPlayerEquipment(player, position, facing);
  }

  private drawPlayerEquipment(player: PlayerState, position: Vec2, facing: Direction): void {
    const gear = this.playerEquipment.get(player.id);
    if (!gear) return;
    const { x, y } = position;
    const equipped = player.inventory.equipped;
    const facingLeft = facing === "left";
    const weaponSide = facingLeft ? -1 : 1;

    gear.clear();

    if (equipped.armor) {
      gear.fillStyle(rarityColor(equipped.armor.rarity), 0.9);
      gear.fillRoundedRect(x - 9, y - 7, 18, 14, 2);
      gear.lineStyle(1, 0x111111, 0.75).strokeRoundedRect(x - 9, y - 7, 18, 14, 2);
    }

    if (equipped.helmet) {
      gear.fillStyle(rarityColor(equipped.helmet.rarity), 0.95);
      gear.fillRect(x - 8, y - 18, 16, 5);
      gear.lineStyle(1, 0x111111, 0.75).strokeRect(x - 8, y - 18, 16, 5);
    }

    if (equipped.weapon) {
      gear.lineStyle(3, rarityColor(equipped.weapon.rarity), 1);
      gear.lineBetween(x + weaponSide * 9, y - 8, x + weaponSide * 22, y - 21);
      gear.lineStyle(1, 0xf7f0d2, 0.9);
      gear.lineBetween(x + weaponSide * 12, y - 10, x + weaponSide * 24, y - 22);
    }

    if (equipped.boots) {
      gear.fillStyle(rarityColor(equipped.boots.rarity), 0.95);
      gear.fillRect(x - 9, y + 13, 6, 4);
      gear.fillRect(x + 3, y + 13, 6, 4);
    }

    if (equipped.ring) {
      gear.lineStyle(2, rarityColor(equipped.ring.rarity), 1);
      gear.strokeCircle(x + weaponSide * 17, y + 2, 4);
      gear.fillStyle(0xf7d774, 0.9);
      gear.fillCircle(x + weaponSide * 21, y - 2, 1.6);
    }
  }

  private renderMonster(monster: MonsterState, position: Vec2): void {
    let sprite = this.monsters.get(monster.id);
    if (!sprite) {
      sprite = this.add.sprite(position.x, position.y, "monster").setScale(3).setDepth(9);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => {
        if (!monster.respawnsAt) this.socket.emit("targetMonster", { monsterId: monster.id });
      });
      this.monsters.set(monster.id, sprite);
      this.monsterBars.set(monster.id, this.add.graphics().setDepth(12));
      this.monsterLabels.set(monster.id, this.add.text(position.x, position.y - 45, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f3e7bf",
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(12));
    }

    sprite.setTexture(monster.respawnsAt ? "dead" : "monster");
    sprite.setAlpha(monster.respawnsAt ? 0.35 : 1);
    const definition = getMonsterDefinition(monster.type);
    sprite.setTint(monster.boss ? 0xfff1a8 : monster.elite ? 0xffd36b : definition.tint);
    sprite.setScale(monster.boss ? definition.scale : monster.elite ? definition.scale * 1.18 : definition.scale);
    sprite.disableInteractive();
    if (!monster.respawnsAt) sprite.setInteractive({ useHandCursor: true });
    sprite.setPosition(position.x, position.y);
    const name = `${monster.boss ? `${t("bossPrefix")} ` : monster.elite ? `${t("elitePrefix")} ` : ""}${translateMonsterName(monster.name)}`;
    this.monsterLabels.get(monster.id)
      ?.setText(`${t("levelShort")} ${monster.level} ${name}`)
      .setColor(monster.boss ? "#fff1a8" : monster.elite ? "#ffe088" : "#f3e7bf")
      .setPosition(position.x, position.y - (monster.boss ? 66 : monster.elite ? 52 : 45))
      .setVisible(!monster.respawnsAt);
    this.drawMonsterBar(monster, position);
  }

  private renderGroundItem(groundItem: GroundItem): void {
    let sprite = this.groundItems.get(groundItem.id);
    if (!sprite) {
      sprite = this.add.sprite(groundItem.position.x, groundItem.position.y, "ground-item").setScale(2.5).setDepth(7);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) this.socket.emit("pickupGroundItem", { groundItemId: groundItem.id });
      });
      this.groundItems.set(groundItem.id, sprite);
      const label = this.add.text(groundItem.position.x, groundItem.position.y - 20, groundItem.item.name, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: rarityHex(groundItem.item.rarity),
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(8);
      this.groundItemLabels.set(groundItem.id, label);
    }
    sprite.setPosition(groundItem.position.x, groundItem.position.y);
    sprite.setTint(rarityColor(groundItem.item.rarity));
    this.groundItemLabels.get(groundItem.id)
      ?.setText(groundItem.item.name)
      .setColor(rarityHex(groundItem.item.rarity))
      .setPosition(groundItem.position.x, groundItem.position.y - 20);
  }

  private drawPlayerBar(player: PlayerState, position: Vec2): void {
    const bar = this.playerBars.get(player.id);
    if (!bar) return;
    const pct = Phaser.Math.Clamp(player.stats.hp / player.stats.maxHp, 0, 1);
    const width = player.id === this.selfId ? 46 : 38;
    const y = position.y - 31;
    bar.clear();
    bar.fillStyle(0x151515, 0.9).fillRect(position.x - width / 2, y, width, 6);
    bar.fillStyle(player.id === this.selfId ? 0x50d36f : 0x69a7ff, 1).fillRect(position.x - width / 2 + 1, y + 1, (width - 2) * pct, 4);
    bar.lineStyle(1, 0x0b0d10, 0.8).strokeRect(position.x - width / 2, y, width, 6);
    if (this.selfPlayer?.targetId === player.id && player.id !== this.selfId) {
      bar.lineStyle(1, 0xf8e66d, 1).strokeRect(position.x - width / 2 - 2, y - 2, width + 4, 10);
    }
  }

  private drawMonsterBar(monster: MonsterState, position: Vec2): void {
    const bar = this.monsterBars.get(monster.id);
    if (!bar) return;
    bar.clear();
    if (monster.respawnsAt) return;
    const pct = Phaser.Math.Clamp(monster.hp / monster.maxHp, 0, 1);
    const width = monster.boss ? 76 : monster.elite ? 58 : 48;
    bar.fillStyle(0x151515, 0.9).fillRect(position.x - width / 2, position.y - 34, width, 6);
    bar.fillStyle(monster.boss ? 0xffd36b : monster.elite ? 0xffb347 : 0xd94b4b, 1).fillRect(position.x - width / 2 + 1, position.y - 33, (width - 2) * pct, 4);
    if (this.selfPlayer && this.selfPlayer.targetId === monster.id) {
      bar.lineStyle(1, 0xf8e66d, 1).strokeRect(position.x - width / 2 - 1, position.y - 35, width + 2, 8);
    }
  }

  private drawMoveMarker(): void {
    if (!this.moveMarker) this.moveMarker = this.add.graphics().setDepth(8);
    this.moveMarker.clear();
    if (!this.moveTarget) return;
    this.moveMarker.lineStyle(2, 0xf7d774, 0.95);
    this.moveMarker.strokeCircle(this.moveTarget.x, this.moveTarget.y, 10);
    this.moveMarker.lineBetween(this.moveTarget.x - 5, this.moveTarget.y, this.moveTarget.x + 5, this.moveTarget.y);
    this.moveMarker.lineBetween(this.moveTarget.x, this.moveTarget.y - 5, this.moveTarget.x, this.moveTarget.y + 5);
  }

  private clearMoveTarget(): void {
    this.moveTarget = undefined;
    this.moveMarker?.clear();
  }

  private useFirstPotion(): void {
    const potion = this.selfPlayer?.inventory.items.find((item) => item.kind === "consumable");
    if (potion) this.socket.emit("useItem", { itemId: potion.id });
  }

  private useSkillSlot(slot: number): void {
    const skillId = this.selfPlayer?.equippedSkills[slot];
    if (!skillId) return;
    soundManager.markUserGesture();
    soundManager.play("skill");
    this.socket.emit("useSkill", { skillId });
  }

  private inviteCurrentTarget(): void {
    const targetId = this.selfPlayer?.targetId;
    if (targetId && targetId !== this.selfId && this.players.has(targetId)) {
      this.socket.emit("inviteParty", { playerId: targetId });
    } else {
      this.hud.log(t("selectPlayerToInvite"));
    }
  }

  private playHitEffect(entityId: string, position: { x: number; y: number }): void {
    const sprite = this.players.get(entityId) ?? this.monsters.get(entityId);
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        alpha: 0.45,
        duration: 70,
        yoyo: true,
        repeat: 1,
        onComplete: () => sprite.setAlpha(1)
      });
      if (entityId === this.selfId) this.cameras.main.shake(110, 0.004);
    }

    const slash = this.add.graphics().setDepth(21);
    slash.lineStyle(3, 0xfff1a8, 0.95);
    slash.lineBetween(position.x - 14, position.y - 18, position.x + 14, position.y + 4);
    slash.lineStyle(2, 0xff6961, 0.9);
    slash.lineBetween(position.x + 12, position.y - 16, position.x - 10, position.y + 8);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      y: slash.y - 8,
      duration: 180,
      onComplete: () => slash.destroy()
    });
  }
}

function rarityColor(rarity: "common" | "rare" | "epic"): number {
  if (rarity === "epic") return 0xd98cff;
  if (rarity === "rare") return 0x69a7ff;
  return 0xd6dddf;
}

function rarityHex(rarity: "common" | "rare" | "epic"): string {
  if (rarity === "epic") return "#d98cff";
  if (rarity === "rare") return "#69a7ff";
  return "#d6dddf";
}

function interpolatePosition(from: Vec2, to: Vec2, alpha: number): Vec2 {
  if (Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) > LOCAL_SNAP_DISTANCE) return to;
  return {
    x: Phaser.Math.Linear(from.x, to.x, alpha),
    y: Phaser.Math.Linear(from.y, to.y, alpha)
  };
}

function facingFromAxis(axis: Vec2, fallback: Direction): Direction {
  if (Math.abs(axis.x) > Math.abs(axis.y)) return axis.x > 0 ? "right" : "left";
  if (axis.y !== 0) return axis.y > 0 ? "down" : "up";
  return fallback;
}

function isEditableFocused(): boolean {
  const element = document.activeElement;
  if (!element) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}
