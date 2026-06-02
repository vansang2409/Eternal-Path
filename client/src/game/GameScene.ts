import Phaser from "phaser";
import {
  ARENA_TILE_BOX,
  BIOME_INFO,
  PLAYER_SPEED,
  SKILL_CATALOG,
  TILE_SIZE,
  TileId,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clampToWorld,
  getMonsterDefinition,
  isWalkableTile
} from "@mmorpg/shared";
import type { ClientInput, Direction, GroundItem, MonsterState, PlayerState, SkillId, Vec2, WorldMapPayload, WorldSnapshot } from "@mmorpg/shared";
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
  private worldMap?: WorldMapPayload;
  private mapBuilt = false;
  private minimapCanvas?: HTMLCanvasElement;
  private minimapCtx?: CanvasRenderingContext2D;
  private minimapBase?: ImageData;
  private lastMinimapAt = 0;
  private aliveMonsters = new Set<string>();

  preload(): void {}

  create(): void {
    createPixelArt(this);
    // createMap is now deferred until the init event delivers the world tile
    // grid from the server.

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
      () => soundManager.isMuted(),
      (recipeId) => this.socket.emit("craftRecipe", { recipeId }),
      (playerClass) => this.socket.emit("selectClass", { playerClass })
    );
    this.socket = createSocket();
    this.registerSocketEvents();

    this.cursors = this.input.keyboard!.addKeys("F,Q,W,E,R") as Record<"F" | "Q" | "W" | "E" | "R", Phaser.Input.Keyboard.Key>;
    this.setupLoginForm();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
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

  private buildMapFromServer(worldMap: WorldMapPayload): void {
    if (this.mapBuilt) return;
    this.mapBuilt = true;
    this.worldMap = worldMap;

    const map = this.make.tilemap({
      data: worldMap.tiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE
    });
    const tiles = map.addTilesetImage("tiles", "tiles", TILE_SIZE, TILE_SIZE);
    map.createLayer(0, tiles!, 0, 0);

    this.initMinimap(worldMap);
    this.createTownNpcs(worldMap);
    this.createArenaOverlay();

    // Update camera bounds for the (possibly larger) world.
    this.cameras.main.setBounds(0, 0, worldMap.width * TILE_SIZE, worldMap.height * TILE_SIZE);

    // Town label rectangle backdrop.
    const town = worldMap.landmarks.town;
    this.add.rectangle(town.x * TILE_SIZE, (town.y + 1) * TILE_SIZE, 210, 120, 0x39424b, 0.55).setDepth(1);
    this.addZoneLabel((town.x + 0.5) * TILE_SIZE, (town.y + 1.5) * TILE_SIZE, t("town"), 18, "#f3e7bf");

    // Auto-place zone labels at the centroid of the largest cluster per biome.
    const clusters = this.findBiomeClusters(worldMap);
    const labeled = new Set<number>();
    for (const c of clusters) {
      if (labeled.size >= 6) break;
      if (labeled.has(c.biome)) continue;
      if (c.biome === TileId.Road || c.biome === TileId.TownStone) continue;
      labeled.add(c.biome);
      const info = BIOME_INFO[c.biome as TileId];
      const label = this.biomeLabel(c.biome as TileId);
      if (!label) continue;
      this.addZoneLabel(
        (c.centroid.x + 0.5) * TILE_SIZE,
        (c.centroid.y + 0.5) * TILE_SIZE,
        label,
        14,
        info?.labelColor ?? "#ffffff"
      );
    }

    // Dungeon entrance markers.
    for (const d of worldMap.landmarks.dungeons) {
      this.addZoneLabel(
        (d.x + 0.5) * TILE_SIZE,
        (d.y - 0.5) * TILE_SIZE,
        "Hầm Bí Ẩn",
        13,
        "#c79bff"
      );
    }
  }

  private biomeLabel(biome: TileId): string | undefined {
    switch (biome) {
      case TileId.Forest: return "Rừng Xanh";
      case TileId.Grass: return "Đồng Cỏ";
      case TileId.Sand: return "Sa Mạc";
      case TileId.Snow: return "Tuyết Trắng";
      case TileId.Swamp: return "Đầm Lầy";
      case TileId.Rock: return "Núi Đá";
      case TileId.Water: return undefined;
      case TileId.Deep: return "Vực Sâu";
      case TileId.DungeonFloor: return "Hầm Mộ";
      default: return undefined;
    }
  }

  // Flood-fill biome clusters to find the centroid of each large region.
  private findBiomeClusters(worldMap: WorldMapPayload): { biome: number; centroid: { x: number; y: number }; size: number }[] {
    const W = worldMap.width;
    const H = worldMap.height;
    const seen = new Uint8Array(W * H);
    const out: { biome: number; centroid: { x: number; y: number }; size: number }[] = [];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const idx = y * W + x;
        if (seen[idx]) continue;
        const target = worldMap.tiles[y][x];
        if (target === TileId.Road || target === TileId.TownStone || target === TileId.Water) {
          seen[idx] = 1;
          continue;
        }
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        const queue: number[] = [idx];
        seen[idx] = 1;
        while (queue.length) {
          const cur = queue.shift()!;
          const px = cur % W;
          const py = Math.floor(cur / W);
          sumX += px;
          sumY += py;
          count += 1;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ] as const) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const nidx = ny * W + nx;
            if (seen[nidx]) continue;
            if (worldMap.tiles[ny][nx] !== target) continue;
            seen[nidx] = 1;
            queue.push(nidx);
          }
        }
        if (count >= 80) {
          out.push({ biome: target, centroid: { x: Math.round(sumX / count), y: Math.round(sumY / count) }, size: count });
        }
      }
    }
    out.sort((a, b) => b.size - a.size);
    return out;
  }

  // ------- arena -------

  private createArenaOverlay(): void {
    const x = ARENA_TILE_BOX.x0 * TILE_SIZE;
    const y = ARENA_TILE_BOX.y0 * TILE_SIZE;
    const w = (ARENA_TILE_BOX.x1 - ARENA_TILE_BOX.x0 + 1) * TILE_SIZE;
    const h = (ARENA_TILE_BOX.y1 - ARENA_TILE_BOX.y0 + 1) * TILE_SIZE;
    // Reddish tint marks the dueling ground.
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xb73a48, 0.22).setDepth(1);
    // Thicker red border.
    const border = this.add.graphics().setDepth(1);
    border.lineStyle(2, 0xff6b7a, 0.85);
    border.strokeRect(x, y, w, h);
    // Label.
    this.add.text(x + w / 2, y - 6, "Đấu Trường (PvP)", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ff8a98",
      stroke: "#111",
      strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(2);
  }

  // ------- town NPCs -------

  private createTownNpcs(worldMap: WorldMapPayload): void {
    const town = worldMap.landmarks.town;
    type Npc = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; phrases: string[]; index: number };
    const npcs: { texture: string; offset: { dx: number; dy: number }; name: string; phrases: string[] }[] = [
      {
        texture: "npc-sage",
        offset: { dx: -3, dy: -3 },
        name: "Hiền Giả",
        phrases: [
          "Cốt lõi của sức mạnh nằm ở sự kiên trì.",
          "Vực Sâu giấu báu vật, nhưng cũng giấu tử thần.",
          "Hãy luyện skill cho thuần, đừng chỉ đeo nhiều.",
          "Mỗi hầm mộ có Khắc Tinh canh giữ — đừng vội."
        ]
      },
      {
        texture: "npc-merchant",
        offset: { dx: 2, dy: -3 },
        name: "Thương Gia",
        phrases: [
          "Đồ thường hả? Bán lấy vàng cho khỏe.",
          "Rương kho báu rải khắp đồng — chịu khó đi xa.",
          "Vàng để dành mua bình máu nhé.",
          "Trang bị epic mới đáng giá."
        ]
      },
      {
        texture: "npc-guard",
        offset: { dx: -1, dy: 3 },
        name: "Vệ Binh",
        phrases: [
          "Tôi giữ cổng — quái không vào được đâu, cứ yên tâm.",
          "Bên ngoài là Rừng Xanh, đi thẳng là tới.",
          "Phía nam có Đầm Lầy, cẩn thận chân nhão.",
          "Nghe đồn Khắc Tinh Hầm vừa hồi sinh."
        ]
      }
    ];

    const created: Npc[] = [];
    for (const def of npcs) {
      const px = (town.x + def.offset.dx + 0.5) * TILE_SIZE;
      const py = (town.y + def.offset.dy + 0.5) * TILE_SIZE;
      const sprite = this.add.sprite(px, py, def.texture).setScale(3).setDepth(8);
      sprite.setInteractive({ useHandCursor: true });
      const nameLabel = this.add.text(px, py - 32, def.name, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f3e7bf",
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(9);
      const npc: Npc = { sprite, label: nameLabel, phrases: def.phrases, index: 0 };
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        this.showNpcDialogue(npc);
      });
      created.push(npc);
    }
  }

  private showNpcDialogue(npc: { sprite: Phaser.GameObjects.Sprite; phrases: string[]; index: number }): void {
    const phrase = npc.phrases[npc.index % npc.phrases.length];
    npc.index += 1;
    const px = npc.sprite.x;
    const py = npc.sprite.y - 58;
    const text = this.add.text(px, py, phrase, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#f1f1f1",
      backgroundColor: "rgba(20, 20, 20, 0.92)",
      padding: { left: 8, right: 8, top: 6, bottom: 6 },
      stroke: "#111",
      strokeThickness: 2,
      wordWrap: { width: 200 }
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: text,
      y: py - 6,
      alpha: 0,
      delay: 3200,
      duration: 600,
      onComplete: () => text.destroy()
    });
  }

  // ------- minimap -------

  private initMinimap(worldMap: WorldMapPayload): void {
    const canvas = document.querySelector<HTMLCanvasElement>("#minimap");
    if (!canvas) return;
    canvas.width = worldMap.width;
    canvas.height = worldMap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.minimapCanvas = canvas;
    this.minimapCtx = ctx;
    const img = ctx.createImageData(worldMap.width, worldMap.height);
    for (let y = 0; y < worldMap.height; y += 1) {
      for (let x = 0; x < worldMap.width; x += 1) {
        const t = worldMap.tiles[y][x] as TileId;
        const [r, g, b] = minimapColorFor(t);
        const idx = (y * worldMap.width + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    this.minimapBase = img;
    // Mark dungeon entrances in pink on the base layer so they persist.
    for (const d of worldMap.landmarks.dungeons) {
      this.paintMinimapPixel(img, d.x, d.y, 233, 142, 255);
      this.paintMinimapPixel(img, d.x + 1, d.y, 233, 142, 255);
      this.paintMinimapPixel(img, d.x, d.y + 1, 233, 142, 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  private paintMinimapPixel(img: ImageData, x: number, y: number, r: number, g: number, b: number): void {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
    const idx = (y * img.width + x) * 4;
    img.data[idx] = r;
    img.data[idx + 1] = g;
    img.data[idx + 2] = b;
    img.data[idx + 3] = 255;
  }

  private redrawMinimap(snapshot: WorldSnapshot): void {
    if (!this.minimapCtx || !this.minimapBase || !this.worldMap) return;
    this.minimapCtx.putImageData(this.minimapBase, 0, 0);
    const ctx = this.minimapCtx;
    // Treasure chests in gold
    ctx.fillStyle = "#f7d774";
    for (const g of snapshot.groundItems) {
      if (g.droppedBy !== "treasure") continue;
      const mx = Math.floor(g.position.x / TILE_SIZE);
      const my = Math.floor(g.position.y / TILE_SIZE);
      ctx.fillRect(mx, my, 2, 2);
    }
    // Monsters
    for (const m of snapshot.monsters) {
      if (m.respawnsAt) continue;
      const mx = Math.floor(m.position.x / TILE_SIZE);
      const my = Math.floor(m.position.y / TILE_SIZE);
      ctx.fillStyle = m.boss ? "#ff5d7a" : m.elite ? "#ffb55a" : "#ff8181";
      ctx.fillRect(mx, my, m.boss ? 3 : 2, m.boss ? 3 : 2);
    }
    // Other players
    ctx.fillStyle = "#9be3ff";
    for (const p of snapshot.players) {
      if (p.id === this.selfId) continue;
      const px = Math.floor(p.position.x / TILE_SIZE);
      const py = Math.floor(p.position.y / TILE_SIZE);
      ctx.fillRect(px, py, 2, 2);
    }
    // Self in bright yellow
    const me = snapshot.players.find((p) => p.id === this.selfId);
    if (me) {
      const px = Math.floor(me.position.x / TILE_SIZE);
      const py = Math.floor(me.position.y / TILE_SIZE);
      ctx.fillStyle = "#ffe25e";
      ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.fillStyle = "#000";
      ctx.fillRect(px, py, 1, 1);
    }
  }

  private isClientTileWalkable(position: Vec2): boolean {
    if (!this.worldMap) return true;
    const tx = Math.floor(position.x / TILE_SIZE);
    const ty = Math.floor(position.y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.worldMap.width || ty >= this.worldMap.height) return false;
    return isWalkableTile(this.worldMap.tiles[ty][tx] as TileId);
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
    this.socket.on("init", ({ selfId, snapshot, worldMap }) => {
      this.selfId = selfId;
      this.loggedIn = true;
      this.enableGameKeyboard();
      document.querySelector("#login-overlay")?.classList.add("hidden");
      if (worldMap) this.buildMapFromServer(worldMap);
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
      const isHeavyHit = event.kind === "damage" && event.amount >= 60;
      const color = event.kind === "damage" ? (isHeavyHit ? "#ffbe3c" : "#ff6961") : event.kind === "loot" ? "#f7d774" : "#8be78b";
      const fontSize = event.kind === "level" ? 18 : isHeavyHit ? 18 : 14;
      const text = this.add.text(event.position.x, event.position.y - 28, event.text ?? `${event.amount}`, {
        fontFamily: "monospace",
        fontSize: `${fontSize}px`,
        color,
        stroke: "#111",
        strokeThickness: isHeavyHit ? 4 : 3,
        fontStyle: isHeavyHit ? "bold" : ""
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
        // Heavy hit (>=60 dmg) shakes the camera a bit harder.
        if (isHeavyHit) this.cameras.main.shake(160, 0.008);
      }
      if (event.kind === "level") soundManager.play("levelUp");
    });

    this.socket.on("skillCast", ({ skillId, position, targetPosition }) => {
      this.playSkillVFX(skillId, position, targetPosition);
    });

    this.socket.on("arenaKill", ({ killerName, victimName }) => {
      this.hud.log(`⚔ ${killerName} hạ ${victimName} tại Đấu Trường.`, "arena-line");
    });

    // Wire the arena toolbar button to fetch the leaderboard each time it opens.
    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal='arena-modal']").forEach((btn) => {
      btn.addEventListener("click", () => this.socket.emit("arenaLeaderboardRequest"));
    });

    this.socket.on("arenaLeaderboard", (rows) => {
      const tbody = document.querySelector<HTMLTableSectionElement>("#arena-leaderboard tbody");
      if (!tbody) return;
      tbody.innerHTML = "";
      if (!rows.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="3" style="text-align:center;padding:18px;color:#8e9192">Chưa có ai chiến đấu.</td>`;
        tbody.appendChild(tr);
        return;
      }
      for (const row of rows) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td style="padding:6px 4px;border-bottom:1px solid #2a2a2a">${row.accountName}</td><td style="text-align:right;padding:6px 4px;border-bottom:1px solid #2a2a2a;color:#ffd166">${row.kills}</td><td style="text-align:right;padding:6px 4px;border-bottom:1px solid #2a2a2a;color:#ff8181">${row.deaths}</td>`;
        tbody.appendChild(tr);
      }
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
      // Detect death transition: previously alive, now respawning -> poof.
      const wasAlive = this.aliveMonsters.has(monster.id);
      const isAlive = !monster.respawnsAt && monster.hp > 0;
      if (wasAlive && !isAlive) {
        this.playDeathPoof(monster.position, monster.boss || monster.elite);
      }
      if (isAlive) this.aliveMonsters.add(monster.id);
      else this.aliveMonsters.delete(monster.id);
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
    // Throttle minimap redraw to ~6 fps; that's enough for spatial awareness.
    const now = this.time.now;
    if (now - this.lastMinimapAt > 160) {
      this.redrawMinimap(snapshot);
      this.lastMinimapAt = now;
    }
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
    const isTreasure = groundItem.droppedBy === "treasure";
    let sprite = this.groundItems.get(groundItem.id);
    if (!sprite) {
      const texture = isTreasure ? "chest" : "ground-item";
      const scale = isTreasure ? 3 : 2.5;
      sprite = this.add.sprite(groundItem.position.x, groundItem.position.y, texture).setScale(scale).setDepth(7);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) this.socket.emit("pickupGroundItem", { groundItemId: groundItem.id });
      });
      this.groundItems.set(groundItem.id, sprite);
      const labelText = isTreasure ? "Rương Kho Báu" : groundItem.item.name;
      const label = this.add.text(groundItem.position.x, groundItem.position.y - 24, labelText, {
        fontFamily: "monospace",
        fontSize: isTreasure ? "11px" : "10px",
        color: isTreasure ? "#f7d774" : rarityHex(groundItem.item.rarity),
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(8);
      this.groundItemLabels.set(groundItem.id, label);
    }
    sprite.setPosition(groundItem.position.x, groundItem.position.y);
    if (!isTreasure) sprite.setTint(rarityColor(groundItem.item.rarity));
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

  private playDeathPoof(position: Vec2, big: boolean): void {
    const count = big ? 14 : 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = (big ? 70 : 50) + Math.random() * 30;
      const radius = big ? 5 : 3.5;
      const color = big ? 0xffd166 : 0xc7c7c7;
      const dot = this.add.circle(position.x, position.y, radius, color, 0.95).setDepth(19);
      const tx = position.x + Math.cos(angle) * speed;
      const ty = position.y + Math.sin(angle) * speed;
      this.tweens.add({
        targets: dot,
        x: tx,
        y: ty,
        alpha: 0,
        scale: 0.2,
        duration: big ? 700 : 500,
        ease: "Cubic.Out",
        onComplete: () => dot.destroy()
      });
    }
    if (big) this.cameras.main.shake(180, 0.006);
  }

  private playSkillVFX(skillId: SkillId, position: Vec2, targetPosition?: Vec2): void {
    const info = SKILL_CATALOG[skillId];
    if (!info) return;
    if (info.effect === "healSelf") {
      // Green column of sparkles rising at the caster.
      for (let i = 0; i < 6; i += 1) {
        const dot = this.add.circle(position.x + (Math.random() - 0.5) * 22, position.y + 8, 2.5, 0x8be78b, 0.95).setDepth(21);
        this.tweens.add({
          targets: dot,
          y: dot.y - 36 - Math.random() * 16,
          alpha: 0,
          duration: 600 + Math.random() * 200,
          onComplete: () => dot.destroy()
        });
      }
      const ring = this.add.circle(position.x, position.y, 8, 0x8be78b, 0).setStrokeStyle(2, 0x8be78b, 0.9).setDepth(20);
      this.tweens.add({
        targets: ring,
        radius: 28,
        alpha: 0,
        duration: 500,
        onComplete: () => ring.destroy()
      });
      return;
    }
    if (info.effect === "damageAoe") {
      const radius = info.aoeRadius ?? 100;
      const ring = this.add.circle(position.x, position.y, 4, 0xff9a3c, 0).setStrokeStyle(3, 0xfff1a8, 0.95).setDepth(20);
      this.tweens.add({
        targets: ring,
        radius,
        alpha: 0,
        duration: 380,
        onComplete: () => ring.destroy()
      });
      const inner = this.add.circle(position.x, position.y, 4, 0xff9a3c, 0.55).setDepth(20);
      this.tweens.add({
        targets: inner,
        radius: radius * 0.7,
        alpha: 0,
        duration: 320,
        onComplete: () => inner.destroy()
      });
      return;
    }
    if (info.effect === "lifestealSingle" && targetPosition) {
      const beam = this.add.graphics().setDepth(21);
      beam.lineStyle(3, 0xff5d7a, 0.95);
      beam.lineBetween(position.x, position.y, targetPosition.x, targetPosition.y);
      this.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 280,
        onComplete: () => beam.destroy()
      });
      return;
    }
    // damageSingle: slash arc from caster toward target.
    if (targetPosition) {
      const slash = this.add.graphics().setDepth(21);
      slash.lineStyle(3, 0xfff1a8, 0.95);
      const midX = (position.x + targetPosition.x) / 2;
      const midY = (position.y + targetPosition.y) / 2;
      slash.lineBetween(position.x, position.y, midX, midY);
      slash.lineStyle(2, 0xffd166, 0.95);
      slash.lineBetween(midX, midY, targetPosition.x, targetPosition.y);
      this.tweens.add({
        targets: slash,
        alpha: 0,
        duration: 280,
        onComplete: () => slash.destroy()
      });
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

// Minimap palette per biome (RGB triplets).
function minimapColorFor(tile: TileId): [number, number, number] {
  switch (tile) {
    case TileId.Grass: return [79, 154, 77];
    case TileId.Road: return [155, 134, 95];
    case TileId.Forest: return [31, 74, 42];
    case TileId.Water: return [35, 83, 138];
    case TileId.Sand: return [217, 195, 120];
    case TileId.Snow: return [227, 236, 242];
    case TileId.Swamp: return [47, 67, 38];
    case TileId.Rock: return [111, 111, 115];
    case TileId.DungeonFloor: return [58, 49, 72];
    case TileId.DungeonWall: return [26, 20, 38];
    case TileId.TownStone: return [161, 141, 108];
    case TileId.Deep: return [43, 41, 71];
    default: return [60, 60, 60];
  }
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
