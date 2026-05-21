import Phaser from "phaser";
import {
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getMonsterDefinition
} from "@mmorpg/shared";
import type { ClientInput, GroundItem, MonsterState, PlayerState, WorldSnapshot } from "@mmorpg/shared";
import { createSocket, type GameSocket } from "../net/socket";
import { Hud } from "../ui/hud";
import { createPixelArt } from "./assets";
import { t, translateMonsterName } from "../i18n";

export class GameScene extends Phaser.Scene {
  private socket!: GameSocket;
  private hud!: Hud;
  private selfId = "";
  private cursors!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
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
      (itemId) => this.socket.emit("dropItem", { itemId })
    );
    this.socket = createSocket();
    this.registerSocketEvents();

    this.cursors = this.input.keyboard!.addKeys("W,A,S,D") as Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
    this.setupLoginForm();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      if (!pointer.rightButtonDown() || objects.length > 0) return;
      this.moveTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      this.drawMoveMarker();
    });
  }

  update(): void {
    if (!this.socket?.connected || !this.loggedIn) return;
    const input: ClientInput = {
      seq: this.seq++,
      up: this.cursors.W.isDown,
      down: this.cursors.S.isDown,
      left: this.cursors.A.isDown,
      right: this.cursors.D.isDown,
      moveTarget: this.moveTarget ? { x: this.moveTarget.x, y: this.moveTarget.y } : undefined
    };
    if (input.up || input.down || input.left || input.right) this.clearMoveTarget();
    this.socket.emit("input", input);
  }

  private createMap(): void {
    const data: number[][] = [];
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const town = x < 11 && y < 11;
        const road = x === 10 || y === 10 || (x > 18 && x < 42 && y === 22);
        row.push(town ? 1 : road ? 2 : 0);
      }
      data.push(row);
    }

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tiles = map.addTilesetImage("tiles", "tiles", TILE_SIZE, TILE_SIZE);
    map.createLayer(0, tiles!, 0, 0);

    this.add.rectangle(6 * TILE_SIZE, 5 * TILE_SIZE, 210, 120, 0x39424b, 0.55).setDepth(1);
    this.add.text(4.1 * TILE_SIZE, 3.7 * TILE_SIZE, t("town"), { fontFamily: "monospace", fontSize: "18px", color: "#f3e7bf" }).setDepth(2);
  }

  private registerSocketEvents(): void {
    this.socket.on("init", ({ selfId, snapshot }) => {
      this.selfId = selfId;
      this.loggedIn = true;
      this.enableGameKeyboard();
      document.querySelector("#login-overlay")?.classList.add("hidden");
      this.applySnapshot(snapshot);
    });

    this.socket.on("snapshot", (snapshot) => this.applySnapshot(snapshot));

    this.socket.on("player", (player) => {
      if (player.id === this.selfId) {
        this.selfPlayer = player;
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
      if (event.kind === "damage") this.playHitEffect(event.entityId, event.position);
    });

    this.socket.on("loot", ({ item, gold }) => {
      this.hud.log(item
        ? t("lootedGoldItem", { gold, rarity: t(item.rarity), item: item.name })
        : t("lootedGold", { gold }));
    });
    this.socket.on("chatHistory", (messages) => this.hud.setChatHistory(messages));
    this.socket.on("chatMessage", (message) => this.hud.appendChat(message));
    this.socket.on("shopStock", (items) => this.hud.setShopStock(items));
    this.socket.on("system", (message) => {
      if (!this.loggedIn) {
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
    const error = document.querySelector("#login-error") as HTMLElement;

    this.captureFormEvents(overlay);

    document.querySelector("#login-copy")!.textContent = t("loginCopy");
    document.querySelector("#email-label")!.textContent = t("email");
    document.querySelector("#name-label")!.textContent = t("characterName");
    document.querySelector("#login-button")!.textContent = t("enterGame");
    emailInput.value = localStorage.getItem("loginEmail") ?? "";
    nameInput.value = localStorage.getItem("accountName") ?? "";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const accountName = nameInput.value.trim() || email.split("@")[0] || "hero";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error.textContent = t("invalidEmail");
        return;
      }
      error.textContent = "";
      localStorage.setItem("loginEmail", email);
      localStorage.setItem("accountName", accountName);
      this.socket.emit("login", { email, accountName });
    });
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
    this.cursors = this.input.keyboard.addKeys("W,A,S,D") as Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
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
    const seenPlayers = new Set<string>();
    for (const player of snapshot.players) {
      seenPlayers.add(player.id);
      this.renderPlayer(player);
      if (player.id === this.selfId) {
        this.selfPlayer = player;
      }
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
      this.renderMonster(monster);
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
  }

  private renderPlayer(player: PlayerState): void {
    let sprite = this.players.get(player.id);
    if (!sprite) {
      sprite = this.add.sprite(player.position.x, player.position.y, "player").setScale(3).setDepth(10);
      if (player.id !== this.selfId) {
        sprite.setInteractive({ useHandCursor: true });
        sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (pointer.leftButtonDown()) this.socket.emit("targetPlayer", { playerId: player.id });
        });
      }
      this.players.set(player.id, sprite);
      const name = this.add.text(player.position.x, player.position.y - 34, player.accountName, {
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
    sprite.setPosition(player.position.x, player.position.y);
    sprite.setFlipX(player.facing === "left");
    if (player.id !== this.selfId) {
      sprite.disableInteractive();
      sprite.setInteractive({ useHandCursor: true });
    }
    this.names.get(player.id)?.setPosition(player.position.x, player.position.y - 42);
    this.drawPlayerBar(player);
    this.drawPlayerEquipment(player);
  }

  private drawPlayerEquipment(player: PlayerState): void {
    const gear = this.playerEquipment.get(player.id);
    if (!gear) return;
    const { x, y } = player.position;
    const equipped = player.inventory.equipped;
    const facingLeft = player.facing === "left";
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

  private renderMonster(monster: MonsterState): void {
    let sprite = this.monsters.get(monster.id);
    if (!sprite) {
      sprite = this.add.sprite(monster.position.x, monster.position.y, "monster").setScale(3).setDepth(9);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => {
        if (!monster.respawnsAt) this.socket.emit("targetMonster", { monsterId: monster.id });
      });
      this.monsters.set(monster.id, sprite);
      this.monsterBars.set(monster.id, this.add.graphics().setDepth(12));
      this.monsterLabels.set(monster.id, this.add.text(monster.position.x, monster.position.y - 45, "", {
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
    sprite.setTint(definition.tint);
    sprite.setScale(definition.scale);
    sprite.disableInteractive();
    if (!monster.respawnsAt) sprite.setInteractive({ useHandCursor: true });
    sprite.setPosition(monster.position.x, monster.position.y);
    this.monsterLabels.get(monster.id)?.setText(`${t("levelShort")} ${monster.level} ${translateMonsterName(monster.name)}`).setPosition(monster.position.x, monster.position.y - 45).setVisible(!monster.respawnsAt);
    this.drawMonsterBar(monster);
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

  private drawPlayerBar(player: PlayerState): void {
    const bar = this.playerBars.get(player.id);
    if (!bar) return;
    const pct = Phaser.Math.Clamp(player.stats.hp / player.stats.maxHp, 0, 1);
    const width = player.id === this.selfId ? 46 : 38;
    const y = player.position.y - 31;
    bar.clear();
    bar.fillStyle(0x151515, 0.9).fillRect(player.position.x - width / 2, y, width, 6);
    bar.fillStyle(player.id === this.selfId ? 0x50d36f : 0x69a7ff, 1).fillRect(player.position.x - width / 2 + 1, y + 1, (width - 2) * pct, 4);
    bar.lineStyle(1, 0x0b0d10, 0.8).strokeRect(player.position.x - width / 2, y, width, 6);
    if (this.selfPlayer?.targetId === player.id && player.id !== this.selfId) {
      bar.lineStyle(1, 0xf8e66d, 1).strokeRect(player.position.x - width / 2 - 2, y - 2, width + 4, 10);
    }
  }

  private drawMonsterBar(monster: MonsterState): void {
    const bar = this.monsterBars.get(monster.id);
    if (!bar) return;
    bar.clear();
    if (monster.respawnsAt) return;
    const pct = Phaser.Math.Clamp(monster.hp / monster.maxHp, 0, 1);
    bar.fillStyle(0x151515, 0.9).fillRect(monster.position.x - 24, monster.position.y - 34, 48, 6);
    bar.fillStyle(0xd94b4b, 1).fillRect(monster.position.x - 23, monster.position.y - 33, 46 * pct, 4);
    if (this.selfPlayer && this.selfPlayer.targetId === monster.id) {
      bar.lineStyle(1, 0xf8e66d, 1).strokeRect(monster.position.x - 25, monster.position.y - 35, 50, 8);
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
