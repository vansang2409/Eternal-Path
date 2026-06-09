import Phaser from "phaser";
import {
  ARENA_TILE_BOX,
  BIOME_INFO,
  COSMETICS,
  PLAYER_SPEED,
  SKILL_CATALOG,
  TILE_SIZE,
  TileId,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clampToWorld,
  getMonsterDefinition,
  getPet,
  isWalkableTile,
  isVipActive,
  isGoldBoostActive,
  titleLabel
} from "@mmorpg/shared";
import type { ClientInput, Direction, GroundItem, MonsterState, PlayerState, SkillId, Vec2, WorldMapPayload, WorldSnapshot } from "@mmorpg/shared";
import { createSocket, type GameSocket } from "../net/socket";
import { Hud } from "../ui/hud";
import { ISO_TILE_W, ISO_TILE_H, createPixelArt } from "./assets";
import { t, translateMonsterName } from "../i18n";
import { soundManager } from "../sound";

const INTERPOLATION_DELAY_MS = 100;
const MAX_SNAPSHOT_BUFFER = 8;
const LOCAL_SNAP_DISTANCE = 64;
const LOCAL_RECONCILE_ALPHA = 0.16;

// Isometric projection. Server still works in 2D Cartesian world pixels;
// the client renders projected iso for a 2.5D camera feel.
const ISO_OFFSET_X = (WORLD_HEIGHT - 1) * (ISO_TILE_W / 2);
function worldToIso(wx: number, wy: number): { x: number; y: number } {
  const tx = wx / TILE_SIZE;
  const ty = wy / TILE_SIZE;
  return {
    x: (tx - ty) * (ISO_TILE_W / 2) + ISO_OFFSET_X,
    y: (tx + ty) * (ISO_TILE_H / 2)
  };
}
function isoToWorld(sx: number, sy: number): { x: number; y: number } {
  const ax = sx - ISO_OFFSET_X;
  const tx = (ax / (ISO_TILE_W / 2) + sy / (ISO_TILE_H / 2)) / 2;
  const ty = (sy / (ISO_TILE_H / 2) - ax / (ISO_TILE_W / 2)) / 2;
  return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
}

export class GameScene extends Phaser.Scene {
  private socket!: GameSocket;
  private hud!: Hud;
  private selfId = "";
  private cursors!: Record<"F" | "Q" | "W" | "E" | "R" | "SHIFT", Phaser.Input.Keyboard.Key>;
  private seq = 0;
  private players = new Map<string, Phaser.GameObjects.Sprite>();
  private names = new Map<string, Phaser.GameObjects.Text>();
  private playerBars = new Map<string, Phaser.GameObjects.Graphics>();
  private playerEquipment = new Map<string, Phaser.GameObjects.Graphics>();
  private petSprites = new Map<string, Phaser.GameObjects.Arc>();
  private playerAuras = new Map<string, Phaser.GameObjects.Ellipse>();
  private ambientMotes: Array<{ go: Phaser.GameObjects.Arc; vx: number; vy: number }> = [];
  private nightFireflies: Array<{ go: Phaser.GameObjects.Arc; t: number; speed: number; ampX: number; ampY: number; baseX: number; baseY: number }> = [];
  private weatherPetals: Array<{ go: Phaser.GameObjects.Rectangle; vy: number; sway: number; phase: number; spin: number; a: number }> = [];
  private nextShootingStarAt = 4000;
  private lastAfterimageAt = 0;
  private lastSpeedLineAt = 0;
  private statusFxAt = new Map<string, number>();
  private groundSparkleAt = new Map<string, number>();
  private lowHpOverlay?: Phaser.GameObjects.Rectangle;
  private lowHpPulse = 0;
  private lastDustAt = 0;
  private monsters = new Map<string, Phaser.GameObjects.Sprite>();
  private monsterBars = new Map<string, Phaser.GameObjects.Graphics>();
  private monsterLabels = new Map<string, Phaser.GameObjects.Text>();
  private groundItems = new Map<string, Phaser.GameObjects.Sprite>();
  private groundItemLabels = new Map<string, Phaser.GameObjects.Text>();
  private moveTarget?: Phaser.Math.Vector2;
  private moveMarker?: Phaser.GameObjects.Graphics;
  private targetReticle?: Phaser.GameObjects.Graphics;
  private partyArrows?: Phaser.GameObjects.Graphics;
  private selfPlayer?: PlayerState;
  private partyMemberIds = new Set<string>();
  private snapshotBuffer: WorldSnapshot[] = [];
  private serverClockOffset = 0;
  private predictedSelfPosition?: Vec2;
  private predictedSelfFacing: Direction = "down";
  private authoritativeSelfPosition?: Vec2;
  private loggedIn = false;
  private formCaptureHandlers: Array<{ type: string; handler: EventListener }> = [];
  // Touch controls: joystick axis (-1..1) and per-skill touch flags.
  private touchAxis = { x: 0, y: 0 };
  private touchKeyDown: Record<"F" | "Q" | "W" | "E" | "R", boolean> = { F: false, Q: false, W: false, E: false, R: false };
  private isTouchDevice = false;
  private worldMap?: WorldMapPayload;
  private mapBuilt = false;
  private minimapCanvas?: HTMLCanvasElement;
  private minimapCtx?: CanvasRenderingContext2D;
  private minimapBase?: ImageData;
  private lastMinimapAt = 0;
  private aliveMonsters = new Set<string>();
  private monsterAggroPrev = new Map<string, boolean>();
  private lastBossAggroBannerAt = 0;
  private monsterHpLag = new Map<string, number>();
  private chatBubbles = new Map<string, { text: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Rectangle; expires: number }>();
  private recentFloating: Array<{ id: string; at: number }> = [];

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
      (playerClass) => this.socket.emit("selectClass", { playerClass }),
      (skillId) => this.socket.emit("upgradeSkill", { skillId }),
      (itemId) => this.socket.emit("enchantItem", { itemId }),
      (cosmeticId) => this.socket.emit("buyCosmetic", { cosmeticId }),
      (cosmeticId) => this.socket.emit("equipCosmetic", { cosmeticId }),
      () => this.socket.emit("claimDailyReward"),
      () => this.socket.emit("buyBattlePassPremium"),
      (tier, track) => this.socket.emit("claimBattlePassTier", { tier, track }),
      (days) => this.socket.emit("buyVip", { days }),
      () => this.socket.emit("claimVipDaily"),
      () => this.socket.emit("claimLoginStreak"),
      (petId) => this.socket.emit("buyPet", { petId }),
      (petId) => this.socket.emit("equipPet", { petId }),
      () => this.socket.emit("feedPet"),
      () => this.socket.emit("petTreat"),
      () => this.socket.emit("buyMysteryBox"),
      () => this.socket.emit("buyBagSlots"),
      (gems) => this.socket.emit("exchangeGemsForGold", { gems }),
      () => this.socket.emit("buyGoldBoost"),
      () => this.socket.emit("sellAllMaterials")
    );
    this.socket = createSocket();
    this.registerSocketEvents();
    this.hud.setPrivateMessageHandler((to, message) => this.socket.emit("privateMessage", { to, message }));
    this.hud.setFriendHandlers(
      (name) => this.socket.emit("addFriend", { name }),
      (name) => this.socket.emit("removeFriend", { name })
    );
    this.socket.on("privateMessageReceived", ({ from, message }) => {
      this.hud.appendPrivateMessage(from, message);
    });
    this.socket.on("friendList", (rows) => {
      this.hud.log(`Bạn bè (${rows.filter((r) => r.online).length}/${rows.length} online): ${rows.map((r) => `${r.online ? "🟢" : "⚪"} ${r.name}`).join(", ") || "(trống)"}`, "log-line");
    });
    this.hud.setGuildHandlers({
      create: (name, tag) => this.socket.emit("createGuild", { name, tag }),
      invite: (name) => this.socket.emit("guildInvitePlayer", { name }),
      accept: (guildId) => this.socket.emit("acceptGuildInvite", { guildId }),
      leave: () => this.socket.emit("leaveGuild"),
      kick: (accountName) => this.socket.emit("kickGuildMember", { accountName }),
      promote: (accountName) => this.socket.emit("promoteGuildMember", { accountName }),
      motd: (motd) => this.socket.emit("setGuildMotd", { motd }),
      chat: (message) => this.socket.emit("guildChat", { message }),
      donate: (amount) => this.socket.emit("donateGuild", { amount }),
      boost: () => this.socket.emit("buyGuildBoost"),
      deposit: (amount) => this.socket.emit("depositGuildBank", { amount }),
      withdraw: (amount) => this.socket.emit("withdrawGuildBank", { amount }),
      disband: () => this.socket.emit("disbandGuild"),
      setDesc: (desc) => this.socket.emit("setGuildDescription", { desc })
    });
    this.socket.on("guildUpdate", (view) => this.hud.setGuild(view));
    this.socket.on("guildInvite", (payload) => {
      this.hud.showGuildInvite(payload);
      this.showTopBanner(`🏰 ${payload.from} mời vào [${payload.tag}] ${payload.guildName} — gõ /gaccept`, "achievement", 5000);
    });
    this.socket.on("guildChatMessage", (payload) => this.hud.appendGuildChat(payload));
    this.socket.on("guildLeaderboard", (rows) => this.hud.setGuildRanking(rows));
    this.hud.setRaidHandlers({
      summon: () => this.socket.emit("summonGuildRaid"),
      attack: () => this.socket.emit("raidAttack")
    });
    this.socket.on("guildRaidUpdate", (view) => this.hud.setGuildRaid(view));
    this.hud.setMysteryBannerProxy((text) => this.showTopBanner(text, "achievement", 3500));
    this.socket.on("mysteryBoxResult", (r) => this.hud.showMysteryBoxResult(r.label));
    this.hud.setInspectHandler((name) => this.socket.emit("inspectPlayer", { name }));
    this.hud.setPayHandler((to, amount) => this.socket.emit("payPlayer", { to, amount }));
    this.hud.setWhoHandler(() => this.socket.emit("requestOnline"));
    this.socket.on("onlineList", (p) => this.hud.showOnlineList(p));
    this.socket.on("playerProfile", (p) => { if (p) this.hud.showPlayerProfile(p); });
    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal='guild-modal']").forEach((btn) => {
      btn.addEventListener("click", () => this.socket.emit("requestGuildLeaderboard"));
    });
    window.addEventListener("hotkey-guild", () => this.socket.emit("requestGuildLeaderboard"));
    this.hud.setMarketHandlers({
      list: (itemId, price) => this.socket.emit("listMarketItem", { itemId, price }),
      buy: (listingId) => this.socket.emit("buyMarketItem", { listingId }),
      cancel: (listingId) => this.socket.emit("cancelMarketListing", { listingId }),
      feature: (listingId) => this.socket.emit("featureMarketListing", { listingId }),
      refresh: () => this.socket.emit("requestMarket")
    });
    this.socket.on("marketUpdate", (listings) => this.hud.setMarket(listings));
    this.hud.setTitleHandler((titleId) => this.socket.emit("setActiveTitle", { titleId }));
    this.socket.on("titlesUpdate", ({ earned, active }) => this.hud.setTitles(earned, active));
    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal='titles-modal']").forEach((btn) => {
      btn.addEventListener("click", () => this.socket.emit("requestTitles"));
    });
    window.addEventListener("hotkey-titles", () => this.socket.emit("requestTitles"));

    this.cursors = this.input.keyboard!.addKeys("F,Q,W,E,R,SHIFT") as Record<"F" | "Q" | "W" | "E" | "R" | "SHIFT", Phaser.Input.Keyboard.Key>;
    this.setupLoginForm();
    this.setupTouchControls();
    this.setupAmbientParticles();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
      if (!pointer.rightButtonDown() || objects.length > 0) return;
      // Pointer is in iso-screen world coords; reverse-project to game world.
      const w = isoToWorld(pointer.worldX, pointer.worldY);
      this.moveTarget = new Phaser.Math.Vector2(w.x, w.y);
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
    // Merge touch joystick into directional axis (8-way threshold).
    const tx = this.touchAxis.x;
    const ty = this.touchAxis.y;
    const input: ClientInput = {
      seq: this.seq++,
      up: tx === 0 && ty < -0.3 ? true : ty < -0.3,
      down: ty > 0.3,
      left: tx < -0.3,
      right: tx > 0.3,
      moveTarget: this.moveTarget ? { x: this.moveTarget.x, y: this.moveTarget.y } : undefined,
      sprinting: this.cursors.SHIFT?.isDown ?? false
    };
    if (Phaser.Input.Keyboard.JustDown(this.cursors.F) || this.consumeTouchTap("F")) this.useFirstPotion();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.Q) || this.consumeTouchTap("Q")) this.useSkillSlot(0);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.W) || this.consumeTouchTap("W")) this.useSkillSlot(1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.E) || this.consumeTouchTap("E")) this.useSkillSlot(2);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.R) || this.consumeTouchTap("R")) this.useSkillSlot(3);
    this.socket.emit("input", input);
    this.predictLocalPlayer(input, delta);
    this.renderBufferedWorld(time);
    this.updateAmbient(delta);
    this.drawTargetReticle(time);
    this.updateWaterShimmer(time);
    this.updateChatBubbles(time);
    this.drawPartyArrows();
    // Sprint afterimage: leave fading ghost copies of the hero while dashing.
    const moving = input.up || input.down || input.left || input.right || !!input.moveTarget;
    // Footstep dust puffs while moving (anime grounding).
    if (moving && time - this.lastDustAt > 170) {
      this.lastDustAt = time;
      const self = this.players.get(this.selfId);
      if (self) {
        const puff = this.add.ellipse(self.x + (Math.random() - 0.5) * 8, self.y + 6, 9, 4, 0xcdbfa0, 0.5).setDepth(self.depth - 1);
        this.tweens.add({ targets: puff, scaleX: 2, scaleY: 2, alpha: 0, duration: 360, ease: "Quad.Out", onComplete: () => puff.destroy() });
      }
    }
    if (input.sprinting && moving && time - this.lastAfterimageAt > 70) {
      this.lastAfterimageAt = time;
      const self = this.players.get(this.selfId);
      if (self) {
        const ghost = this.add.sprite(self.x, self.y, self.texture.key, self.frame.name)
          .setScale(self.scaleX, self.scaleY).setFlipX(self.flipX)
          .setAlpha(0.45).setTint(0x9ad0ff).setDepth(self.depth - 1);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 240, onComplete: () => ghost.destroy() });
      }
    }
    // Sprint 117: shounen dash speed-lines — faint streaks sweep inward from the
    // screen edges while sprinting, selling a sense of momentum.
    if (input.sprinting && moving && time - this.lastSpeedLineAt > 90) {
      this.lastSpeedLineAt = time;
      const w = this.scale.width;
      const h = this.scale.height;
      for (let s = 0; s < 2; s += 1) {
        const fromLeft = Math.random() < 0.5;
        const y = 40 + Math.random() * (h - 80);
        const len = 40 + Math.random() * 60;
        const x = fromLeft ? -len : w + len;
        const line = this.add.rectangle(x, y, len, 2, 0xdff1ff, 0.28)
          .setOrigin(0.5).setScrollFactor(0).setDepth(99955).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: line, x: fromLeft ? x + 120 : x - 120, alpha: 0, duration: 260, ease: "Quad.Out", onComplete: () => line.destroy() });
      }
    }
  }

  // Gentle screen-space atmosphere motes drifting upward (anime ambiance).
  private setupAmbientParticles(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < 22; i += 1) {
      const go = this.add.circle(Math.random() * w, Math.random() * h, Math.random() < 0.3 ? 2.5 : 1.5, 0xffffff, 0.12 + Math.random() * 0.12)
        .setScrollFactor(0).setDepth(99980);
      this.ambientMotes.push({ go, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 8 });
    }
    // Full-screen red danger tint (alpha driven by HP each frame).
    this.lowHpOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0xff1a1a, 0)
      .setScrollFactor(0).setDepth(99970);
  }

  private updateAmbient(delta: number): void {
    if (this.ambientMotes.length === 0) return;
    const dt = delta / 1000;
    const w = this.scale.width;
    const h = this.scale.height;
    for (const m of this.ambientMotes) {
      m.go.x += m.vx * dt;
      m.go.y += m.vy * dt;
      if (m.go.y < -6) { m.go.y = h + 6; m.go.x = Math.random() * w; }
      if (m.go.x < -6) m.go.x = w + 6;
      else if (m.go.x > w + 6) m.go.x = -6;
    }
    // Low-HP danger vignette: pulse red when below 30% HP.
    if (this.lowHpOverlay) {
      const hp = this.selfPlayer?.stats.hp ?? 1;
      const maxHp = this.selfPlayer?.stats.maxHp ?? 1;
      const ratio = maxHp > 0 ? hp / maxHp : 1;
      let target = 0;
      if (ratio > 0 && ratio < 0.3) {
        this.lowHpPulse += dt * 6;
        const danger = 1 - ratio / 0.3; // 0 at 30% → 1 near death
        target = (0.1 + 0.12 * danger) * (0.55 + 0.45 * Math.sin(this.lowHpPulse));
      }
      const cur = this.lowHpOverlay.alpha;
      this.lowHpOverlay.setAlpha(cur + (target - cur) * Math.min(1, dt * 8));
    }
    this.updateNightFireflies(dt);
    this.updateWeather(dt);
    this.updateShootingStars();
  }

  // Sprint 132: off-screen party arrows — green pointers at the screen edge show
  // where allies are when they roam out of view, so groups stay together.
  private drawPartyArrows(): void {
    if (!this.partyArrows) this.partyArrows = this.add.graphics().setScrollFactor(0).setDepth(99964);
    const g = this.partyArrows;
    g.clear();
    if (this.partyMemberIds.size === 0) return;
    const cam = this.cameras.main;
    const vx = cam.worldView;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2;
    const margin = 36;
    for (const id of this.partyMemberIds) {
      if (id === this.selfId) continue;
      const sprite = this.players.get(id);
      if (!sprite || vx.contains(sprite.x, sprite.y)) continue;
      const screenX = ((sprite.x - vx.x) / vx.width) * w;
      const screenY = ((sprite.y - vx.y) / vx.height) * h;
      const angle = Math.atan2(screenY - cy, screenX - cx);
      const dirx = Math.cos(angle);
      const diry = Math.sin(angle);
      const halfW = cx - margin;
      const halfH = cy - margin;
      const s = Math.min(Math.abs(dirx) < 1e-3 ? Infinity : halfW / Math.abs(dirx), Math.abs(diry) < 1e-3 ? Infinity : halfH / Math.abs(diry));
      const ex = cx + dirx * s;
      const ey = cy + diry * s;
      const size = 10;
      const tipX = ex + dirx * size;
      const tipY = ey + diry * size;
      g.fillStyle(0x8be78b, 0.9);
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(ex + Math.cos(angle + 2.5) * size, ey + Math.sin(angle + 2.5) * size);
      g.lineTo(ex + Math.cos(angle - 2.5) * size, ey + Math.sin(angle - 2.5) * size);
      g.closePath();
      g.fillPath();
    }
  }

  // Sprint 131: speech bubbles — a player's chat line pops above their head for
  // a few seconds so conversation happens in-world, not just the chat log.
  private showChatBubble(playerId: string, message: string): void {
    const old = this.chatBubbles.get(playerId);
    if (old) { old.text.destroy(); old.bg.destroy(); this.chatBubbles.delete(playerId); }
    const trimmed = message.length > 42 ? message.slice(0, 41) + "…" : message;
    const text = this.add.text(0, 0, trimmed, {
      fontFamily: "monospace", fontSize: "11px", color: "#fffdf2",
      stroke: "#10141a", strokeThickness: 2, align: "center", wordWrap: { width: 150 }
    }).setOrigin(0.5).setDepth(99986);
    const bg = this.add.rectangle(0, 0, text.width + 12, text.height + 8, 0x10141a, 0.72)
      .setOrigin(0.5).setDepth(99985).setStrokeStyle(1, 0x3a4a5a, 0.9);
    this.chatBubbles.set(playerId, { text, bg, expires: this.time.now + 4800 });
  }

  private updateChatBubbles(time: number): void {
    for (const [id, b] of this.chatBubbles) {
      const sprite = this.players.get(id);
      if (!sprite || time > b.expires) {
        b.text.destroy(); b.bg.destroy();
        this.chatBubbles.delete(id);
        continue;
      }
      const x = sprite.x;
      const y = sprite.y - 52;
      b.text.setPosition(x, y);
      b.bg.setPosition(x, y);
      // Gentle fade-out over the final 600ms of life.
      const remaining = b.expires - time;
      const a = remaining < 600 ? remaining / 600 : 1;
      b.text.setAlpha(a);
      b.bg.setAlpha(a * 0.72);
    }
  }

  // Sprint 125: water sparkle — occasional specular glints dance over nearby
  // water tiles so lakes and coastline feel alive instead of flat.
  private lastWaterShimmerAt = 0;
  private updateWaterShimmer(time: number): void {
    if (!this.worldMap || !this.selfPlayer) return;
    if (time - this.lastWaterShimmerAt < 220) return;
    this.lastWaterShimmerAt = time;
    const ptx = Math.floor(this.selfPlayer.position.x / TILE_SIZE);
    const pty = Math.floor(this.selfPlayer.position.y / TILE_SIZE);
    const candidates: Array<{ x: number; y: number }> = [];
    for (let dy = -6; dy <= 6; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        const tx = ptx + dx;
        const ty = pty + dy;
        if (tx < 0 || ty < 0 || tx >= this.worldMap.width || ty >= this.worldMap.height) continue;
        const tile = this.worldMap.tiles[ty][tx] as TileId;
        if (tile === TileId.Water || tile === TileId.Deep) candidates.push({ x: tx, y: ty });
      }
    }
    if (candidates.length === 0) return;
    const picks = Math.min(2, candidates.length);
    for (let i = 0; i < picks; i += 1) {
      const c = candidates[Math.floor(Math.random() * candidates.length)];
      const wx = (c.x + 0.3 + Math.random() * 0.4) * TILE_SIZE;
      const wy = (c.y + 0.3 + Math.random() * 0.4) * TILE_SIZE;
      const iso = worldToIso(wx, wy);
      const glint = this.add.ellipse(iso.x, iso.y, 6, 2.5, 0xdaf4ff, 0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glint, alpha: 0.75, duration: 320, yoyo: true, ease: "Sine.InOut", onComplete: () => glint.destroy() });
    }
  }

  // Sprint 123: rare shooting star streaking across the night sky — a quiet
  // wow-moment that only appears after dark.
  private updateShootingStars(): void {
    if (this.currentDayPhase !== "night") return;
    const now = this.time.now;
    if (now < this.nextShootingStarAt) return;
    this.nextShootingStarAt = now + 5000 + Math.random() * 7000;
    const w = this.scale.width;
    const startX = w * (0.2 + Math.random() * 0.6);
    const startY = this.scale.height * (0.05 + Math.random() * 0.2);
    const dx = 160 + Math.random() * 120;
    const dy = dx * (0.4 + Math.random() * 0.2);
    const star = this.add.circle(startX, startY, 2, 0xffffff, 1).setScrollFactor(0).setDepth(99959).setBlendMode(Phaser.BlendModes.ADD);
    const trail = this.add.rectangle(startX, startY, 26, 2, 0xbfe0ff, 0.7).setScrollFactor(0).setDepth(99958)
      .setOrigin(1, 0.5).setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx))).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: [star, trail], x: startX + dx, y: startY + dy, alpha: 0, duration: 700, ease: "Quad.In",
      onComplete: () => { star.destroy(); trail.destroy(); }
    });
  }

  // Sprint 120: biome-aware weather — drifting petals/leaves in the forest,
  // snowflakes on the peaks, spores over the swamp, dust in the dunes. A pooled
  // screen-space layer that recolors itself to whatever biome the hero stands in.
  private updateWeather(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // Decide the active weather palette from the tile under the player.
    let color = 0x000000;
    let active = false;
    let drift = 22;
    if (this.worldMap && this.selfPlayer) {
      const tx = Math.floor(this.selfPlayer.position.x / TILE_SIZE);
      const ty = Math.floor(this.selfPlayer.position.y / TILE_SIZE);
      if (tx >= 0 && ty >= 0 && tx < this.worldMap.width && ty < this.worldMap.height) {
        const tile = this.worldMap.tiles[ty][tx] as TileId;
        if (tile === TileId.Forest || tile === TileId.Grass) { color = 0x8fd98f; active = true; drift = 22; }
        else if (tile === TileId.Snow) { color = 0xffffff; active = true; drift = 14; }
        else if (tile === TileId.Swamp) { color = 0x86c98f; active = true; drift = 16; }
        else if (tile === TileId.Sand) { color = 0xe8d4a0; active = true; drift = 40; }
        else if (tile === TileId.DungeonFloor || tile === TileId.DungeonWall) { color = 0x9a9488; active = true; drift = 8; }
      }
    }
    if (this.weatherPetals.length === 0) {
      for (let i = 0; i < 16; i += 1) {
        const go = this.add.rectangle(Math.random() * w, Math.random() * h, 4, 6, 0xffffff, 0)
          .setScrollFactor(0).setDepth(99958).setAngle(Math.random() * 360);
        this.weatherPetals.push({ go, vy: 24 + Math.random() * 26, sway: 12 + Math.random() * 16, phase: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 60, a: 0 });
      }
    }
    for (const p of this.weatherPetals) {
      p.phase += dt;
      p.go.y += p.vy * dt;
      p.go.x += Math.sin(p.phase * 1.3) * p.sway * dt + drift * dt * 0.4;
      p.go.angle += p.spin * dt;
      if (p.go.y > h + 8 || p.go.x > w + 8) { p.go.y = -8; p.go.x = Math.random() * w; }
      const target = active ? 0.5 : 0;
      p.a += (target - p.a) * Math.min(1, dt * 1.5);
      p.go.setFillStyle(color === 0x000000 ? 0xffffff : color, p.a);
    }
  }

  // Sprint 112: warm drifting fireflies that fade in at night/dusk and out by
  // day — screen-space (scrollFactor 0) so they read as foreground atmosphere.
  private updateNightFireflies(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.nightFireflies.length === 0) {
      for (let i = 0; i < 16; i += 1) {
        const go = this.add.circle(Math.random() * w, Math.random() * h, 1.6 + Math.random() * 1.6, 0xfff1a8, 0)
          .setScrollFactor(0).setDepth(99950).setBlendMode(Phaser.BlendModes.ADD);
        this.nightFireflies.push({ go, t: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6, ampX: 18 + Math.random() * 26, ampY: 12 + Math.random() * 20, baseX: go.x, baseY: go.y });
      }
    }
    const night = this.currentDayPhase === "night";
    const dusk = this.currentDayPhase === "dusk" || this.currentDayPhase === "dawn";
    const targetMax = night ? 0.85 : dusk ? 0.35 : 0;
    for (const f of this.nightFireflies) {
      f.t += dt * f.speed;
      f.go.x = f.baseX + Math.cos(f.t) * f.ampX;
      f.go.y = f.baseY + Math.sin(f.t * 1.3) * f.ampY;
      // Re-anchor drifting fireflies if the window resized under them.
      if (f.baseX > w) f.baseX = Math.random() * w;
      if (f.baseY > h) f.baseY = Math.random() * h;
      const flicker = 0.55 + 0.45 * Math.sin(f.t * 3.1);
      const target = targetMax * flicker;
      f.go.setAlpha(f.go.alpha + (target - f.go.alpha) * Math.min(1, dt * 2));
    }
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
      const iso = worldToIso((c.centroid.x + 0.5) * TILE_SIZE, (c.centroid.y + 0.5) * TILE_SIZE);
      this.addZoneLabel(iso.x, iso.y, label, 14, info?.labelColor ?? "#ffffff");
    }

    // Dungeon entrance markers.
    for (const d of worldMap.landmarks.dungeons) {
      const iso = worldToIso((d.x + 0.5) * TILE_SIZE, (d.y - 0.5) * TILE_SIZE);
      this.addZoneLabel(iso.x, iso.y, "Hầm Bí Ẩn", 13, "#c79bff");
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

  // ------- top banner notifications -------

  private showTopBanner(text: string, kind: "level" | "achievement", durationMs: number): void {
    const stack = document.querySelector("#top-banner-stack");
    if (!stack) return;
    const banner = document.createElement("div");
    banner.className = `top-banner${kind === "achievement" ? " achievement" : ""}`;
    banner.textContent = text;
    stack.appendChild(banner);
    setTimeout(() => banner.classList.add("fade-out"), durationMs);
    setTimeout(() => banner.remove(), durationMs + 500);
  }

  // ------- boss HUD -------

  private updateBossHud(snapshot: WorldSnapshot): void {
    const hud = document.querySelector<HTMLDivElement>("#boss-hud");
    if (!hud) return;
    const boss = snapshot.monsters.find((m) => m.boss && m.type === "eternalWarden" && !m.respawnsAt && m.hp > 0);
    if (!boss) {
      hud.classList.add("hidden");
      return;
    }
    hud.classList.remove("hidden");
    const name = document.querySelector<HTMLDivElement>("#boss-hud-name");
    const fill = document.querySelector<HTMLSpanElement>("#boss-hud-fill");
    const label = document.querySelector<HTMLLabelElement>("#boss-hud-label");
    if (name) name.textContent = `⚔ ${boss.name}`;
    const pct = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    if (fill) fill.style.width = `${pct * 100}%`;
    if (label) label.textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;
  }

  // ------- leaderboard -------

  private lastLeaderboard?: { byLevel: any[]; byGold: any[]; byKills: any[] };
  private activeLeaderboardTab: "byLevel" | "byGold" | "byKills" = "byLevel";

  private renderLeaderboard(): void {
    if (!this.lastLeaderboard) return;
    const tabsRoot = document.querySelector<HTMLDivElement>("#leaderboard-tabs");
    if (!tabsRoot) return;
    tabsRoot.innerHTML = "";
    const tabs = [
      { id: "byLevel" as const, label: "Cấp" },
      { id: "byGold" as const, label: "Vàng" },
      { id: "byKills" as const, label: "PvP" }
    ];
    for (const t of tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `quest-tab${this.activeLeaderboardTab === t.id ? " active" : ""}`;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        this.activeLeaderboardTab = t.id;
        this.renderLeaderboard();
      });
      tabsRoot.appendChild(btn);
    }
    const rows = this.lastLeaderboard[this.activeLeaderboardTab];
    const valueHead = document.querySelector<HTMLTableCellElement>("#leaderboard-value-head");
    if (valueHead) valueHead.textContent = this.activeLeaderboardTab === "byLevel" ? "Cấp" : this.activeLeaderboardTab === "byGold" ? "Vàng" : "Hạ";
    const tbody = document.querySelector<HTMLTableSectionElement>("#leaderboard-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="padding:18px;text-align:center;color:#8e9192">Chưa có ai trên bảng.</td></tr>`;
      return;
    }
    rows.forEach((row, i) => {
      const tr = document.createElement("tr");
      const val = this.activeLeaderboardTab === "byLevel" ? row.level : this.activeLeaderboardTab === "byGold" ? row.gold : row.pvpKills;
      tr.innerHTML = `<td style="padding:6px 4px;border-bottom:1px solid #2a2a2a;color:${i === 0 ? "#ffd166" : "#bdbdbd"}">${i + 1}</td><td style="padding:6px 4px;border-bottom:1px solid #2a2a2a">${row.accountName}</td><td style="text-align:right;padding:6px 4px;border-bottom:1px solid #2a2a2a;color:#ffd166">${val}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ------- touch controls -------

  private touchTapEdges: Set<"F" | "Q" | "W" | "E" | "R"> = new Set();

  private consumeTouchTap(key: "F" | "Q" | "W" | "E" | "R"): boolean {
    if (this.touchTapEdges.has(key)) {
      this.touchTapEdges.delete(key);
      return true;
    }
    return false;
  }

  private setupTouchControls(): void {
    this.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const root = document.querySelector<HTMLDivElement>("#touch-controls");
    if (!root) return;
    if (!this.isTouchDevice) {
      root.classList.add("hidden");
      return;
    }
    root.classList.remove("hidden");

    // Joystick.
    const joystick = document.querySelector<HTMLDivElement>("#touch-joystick");
    const knob = document.querySelector<HTMLDivElement>("#touch-joystick-knob");
    if (joystick && knob) {
      let activePointer: number | undefined;
      const rect = () => joystick.getBoundingClientRect();
      const maxR = 50;
      const reset = () => {
        this.touchAxis = { x: 0, y: 0 };
        knob.style.transform = "translate(-50%, -50%)";
      };
      const handleMove = (clientX: number, clientY: number) => {
        const r = rect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.touchAxis = { x: dx / maxR, y: dy / maxR };
      };
      joystick.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (activePointer !== undefined) return;
        activePointer = e.pointerId;
        joystick.setPointerCapture(e.pointerId);
        handleMove(e.clientX, e.clientY);
      });
      joystick.addEventListener("pointermove", (e) => {
        if (activePointer !== e.pointerId) return;
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
      });
      const release = (e: PointerEvent) => {
        if (activePointer !== e.pointerId) return;
        activePointer = undefined;
        try { joystick.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        reset();
      };
      joystick.addEventListener("pointerup", release);
      joystick.addEventListener("pointercancel", release);
    }

    // Action buttons.
    document.querySelectorAll<HTMLButtonElement>(".touch-btn[data-touch-key]").forEach((btn) => {
      const key = btn.dataset.touchKey as "F" | "Q" | "W" | "E" | "R";
      const fire = (e: Event) => {
        e.preventDefault();
        this.touchTapEdges.add(key);
      };
      btn.addEventListener("pointerdown", fire);
    });
  }

  // ------- day / night cycle -------

  private dayOverlay?: Phaser.GameObjects.Rectangle;
  private vignette?: Phaser.GameObjects.Image;
  private lastDayPhase = "";

  private currentDayPhase: string = "day";

  private updateAmbientMood(): void {
    if (!this.worldMap || !this.selfPlayer) return;
    const tx = Math.floor(this.selfPlayer.position.x / TILE_SIZE);
    const ty = Math.floor(this.selfPlayer.position.y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.worldMap.width || ty >= this.worldMap.height) return;
    const tile = this.worldMap.tiles[ty][tx] as TileId;
    const phase = this.currentDayPhase;
    let mood: import("../sound").AmbientMood = "forestDay";
    if (tile === TileId.TownStone || tile === TileId.Road) mood = "townCalm";
    else if (tile === TileId.Forest || tile === TileId.Grass) mood = phase === "night" ? "forestNight" : "forestDay";
    else if (tile === TileId.Sand) mood = "desert";
    else if (tile === TileId.Snow) mood = "snow";
    else if (tile === TileId.Swamp) mood = "swamp";
    else if (tile === TileId.Deep) mood = "deepDark";
    else if (tile === TileId.DungeonFloor || tile === TileId.DungeonWall) mood = "dungeon";
    else mood = phase === "night" ? "forestNight" : "forestDay";
    soundManager.setAmbient(mood);
  }

  private applyWorldTime(payload: { timeOfDay: number; phase: string }): void {
    this.currentDayPhase = payload.phase;
    this.updateAmbientMood();
    // Lazy-create a full-screen overlay rectangle that lives above the world
    // but below entities (depth -500 so map and entities stay visible).
    if (!this.dayOverlay) {
      this.dayOverlay = this.add
        .rectangle(0, 0, 1, 1, 0x000000, 0)
        .setOrigin(0, 0)
        .setDepth(50000)
        .setScrollFactor(0);
      this.scale.on("resize", () => this.fitDayOverlay());
    }
    // Sprint 122: cinematic vignette — a soft radial darkening at the screen
    // edges that deepens at night, framing the action like an anime shot.
    if (!this.vignette) {
      if (!this.textures.exists("vignette")) {
        const size = 256;
        const canvasTex = this.textures.createCanvas("vignette", size, size);
        const ctx = canvasTex?.getContext();
        if (ctx) {
          const grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size * 0.52);
          grd.addColorStop(0, "rgba(0,0,0,0)");
          grd.addColorStop(1, "rgba(0,0,0,1)");
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, size, size);
          canvasTex?.refresh();
        }
      }
      this.vignette = this.add.image(this.scale.width / 2, this.scale.height / 2, "vignette")
        .setScrollFactor(0).setDepth(99965).setAlpha(0.34);
    }
    this.fitDayOverlay();
    {
      let vAlpha = 0.34;
      if (payload.phase === "night") vAlpha = 0.6;
      else if (payload.phase === "dawn" || payload.phase === "dusk") vAlpha = 0.46;
      this.tweens.killTweensOf(this.vignette);
      this.tweens.add({ targets: this.vignette, alpha: vAlpha, duration: 1800, ease: "Sine.InOut" });
    }
    const t01 = payload.timeOfDay;
    // Tint color + alpha by phase.
    // Night: deep blue / strong alpha. Dawn/dusk: warm orange / mid alpha.
    // Day: barely any tint.
    let color = 0x000020;
    let alpha = 0;
    if (payload.phase === "night") { color = 0x0a1238; alpha = 0.42; }
    else if (payload.phase === "dawn") { color = 0xff9a3c; alpha = 0.18; }
    else if (payload.phase === "dusk") { color = 0xff5a3c; alpha = 0.22; }
    else { color = 0xffeec0; alpha = 0.05; }
    // Smoothly fade between day phases instead of snapping (cinematic).
    this.dayOverlay.fillColor = color;
    this.tweens.killTweensOf(this.dayOverlay);
    this.tweens.add({ targets: this.dayOverlay, fillAlpha: alpha, duration: 1800, ease: "Sine.InOut" });

    // Update HUD clock.
    const phaseLabel: Record<string, string> = { dawn: "🌅 Bình minh", day: "☀️ Ban ngày", dusk: "🌇 Hoàng hôn", night: "🌙 Đêm" };
    const minutesIntoDay = Math.floor(t01 * 24 * 60);
    const hours = Math.floor(minutesIntoDay / 60).toString().padStart(2, "0");
    const minutes = (minutesIntoDay % 60).toString().padStart(2, "0");
    const phaseEl = document.querySelector<HTMLSpanElement>("#world-clock-phase");
    const timeEl = document.querySelector<HTMLSpanElement>("#world-clock-time");
    if (phaseEl) phaseEl.textContent = phaseLabel[payload.phase] ?? payload.phase;
    if (timeEl) timeEl.textContent = `${hours}:${minutes}`;
    this.lastDayPhase = payload.phase;
  }

  private fitDayOverlay(): void {
    if (this.vignette) {
      // Stretch a bit past the edges so the gradient's darkest rim is off-screen.
      this.vignette.setPosition(this.scale.width / 2, this.scale.height / 2)
        .setDisplaySize(this.scale.width * 1.15, this.scale.height * 1.15);
    }
    if (!this.dayOverlay) return;
    this.dayOverlay.setSize(this.scale.width, this.scale.height);
  }

  // ------- arena -------

  private createArenaOverlay(): void {
    // Arena box: 4 world corners projected to iso form a rhombus.
    const x0 = ARENA_TILE_BOX.x0 * TILE_SIZE;
    const y0 = ARENA_TILE_BOX.y0 * TILE_SIZE;
    const x1 = (ARENA_TILE_BOX.x1 + 1) * TILE_SIZE;
    const y1 = (ARENA_TILE_BOX.y1 + 1) * TILE_SIZE;
    const tl = worldToIso(x0, y0);
    const tr = worldToIso(x1, y0);
    const br = worldToIso(x1, y1);
    const bl = worldToIso(x0, y1);
    const poly = this.add.polygon(0, 0, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y], 0xb73a48, 0.22)
      .setOrigin(0, 0)
      .setDepth(0.5);
    const border = this.add.graphics().setDepth(0.5);
    border.lineStyle(2, 0xff6b7a, 0.85);
    border.strokePoints([
      { x: tl.x, y: tl.y },
      { x: tr.x, y: tr.y },
      { x: br.x, y: br.y },
      { x: bl.x, y: bl.y }
    ], true);
    // Label at the iso top corner.
    this.add.text(tl.x, tl.y - 8, "Đấu Trường (PvP)", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ff8a98",
      stroke: "#111",
      strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(2);
    poly.setVisible(true);
  }

  // ------- town NPCs -------

  private createTownNpcs(worldMap: WorldMapPayload): void {
    const town = worldMap.landmarks.town;
    type Npc = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; phrases: string[]; index: number; offerReroll?: boolean };
    const npcs: { texture: string; offset: { dx: number; dy: number }; name: string; phrases: string[]; offerReroll?: boolean }[] = [
      {
        texture: "npc-sage",
        offset: { dx: -3, dy: -3 },
        name: "Hiền Giả",
        phrases: [
          "Cốt lõi của sức mạnh nằm ở sự kiên trì.",
          "Vực Sâu giấu báu vật, nhưng cũng giấu tử thần.",
          "Hãy luyện skill cho thuần, đừng chỉ đeo nhiều.",
          "Mỗi hầm mộ có Khắc Tinh canh giữ — đừng vội.",
          "Bạn muốn làm mới nhiệm vụ hằng ngày? Mất 100 vàng nhé."
        ],
        offerReroll: true
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
      const wx = (town.x + def.offset.dx + 0.5) * TILE_SIZE;
      const wy = (town.y + def.offset.dy + 0.5) * TILE_SIZE;
      const iso = worldToIso(wx, wy);
      const px = iso.x;
      const py = iso.y;
      const sprite = this.add.sprite(px, py, def.texture).setScale(3).setDepth(py);
      sprite.setInteractive({ useHandCursor: true });
      // Sprint 118: living town — a soft warm glow beneath each NPC that gently
      // breathes, plus a slow idle bob so vendors feel animate, not frozen.
      const glow = this.add.ellipse(px, py + 10, 30, 14, 0xffe1a0, 0.18).setDepth(py - 1).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, scaleX: 1.25, scaleY: 1.25, alpha: 0.32, duration: 1600 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.tweens.add({ targets: sprite, y: py - 3, duration: 1400 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      const nameLabel = this.add.text(px, py - 32, def.name, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f3e7bf",
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(9);
      const npc: Npc = { sprite, label: nameLabel, phrases: def.phrases, index: 0, offerReroll: def.offerReroll };
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        this.showNpcDialogue(npc);
        // Every 5th click on the Sage triggers the reroll prompt if applicable.
        if (npc.offerReroll && npc.index % 5 === 0) {
          if (confirm("Hiền Giả: Làm mới 3 nhiệm vụ hằng ngày với 100 vàng?")) {
            this.socket.emit("rerollDailyQuests");
          }
        }
      });
      created.push(npc);
    }
  }

  private showNpcDialogue(npc: { sprite: Phaser.GameObjects.Sprite; phrases: string[]; index: number; offerReroll?: boolean }): void {
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
    const bossPulse = 0.5 + 0.5 * Math.sin(this.time.now / 220);
    for (const m of snapshot.monsters) {
      if (m.respawnsAt) continue;
      const mx = Math.floor(m.position.x / TILE_SIZE);
      const my = Math.floor(m.position.y / TILE_SIZE);
      ctx.fillStyle = m.boss ? "#ff5d7a" : m.elite ? "#ffb55a" : "#ff8181";
      ctx.fillRect(mx, my, m.boss ? 3 : 2, m.boss ? 3 : 2);
      // Sprint 126: pulsing halo around alive bosses so they're easy to find.
      if (m.boss) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.55 * bossPulse;
        ctx.strokeStyle = "#ff5d7a";
        ctx.lineWidth = 1;
        const r = 2 + bossPulse * 3;
        ctx.strokeRect(mx + 1.5 - r, my + 1.5 - r, r * 2, r * 2);
        ctx.restore();
      }
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
    // Sprint 135: camera viewport box — outline the on-screen area on the
    // minimap so the player knows which slice of the world they're looking at.
    const view = this.cameras.main.worldView;
    if (view.width > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        view.x / TILE_SIZE,
        view.y / TILE_SIZE,
        view.width / TILE_SIZE,
        view.height / TILE_SIZE
      );
      ctx.restore();
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
      // First-ever login on this device: show the help guide once.
      if (!localStorage.getItem("helpShown")) {
        setTimeout(() => {
          document.querySelector("#help-modal")?.classList.remove("hidden");
          localStorage.setItem("helpShown", "1");
        }, 600);
      }
    });

    this.socket.on("session", ({ token }) => localStorage.setItem("sessionToken", token));

    // Auto re-login on (re)connect when a session token is stored. This handles
    // dev-server hot-reloads / brief network drops without forcing the player
    // to retype credentials. If the token is no longer valid, the server emits
    // a system error which falls back to the manual login form.
    this.socket.on("connect", () => {
      const stats = document.querySelector<HTMLDivElement>("#login-stats");
      if (stats) stats.textContent = "✓ Đã kết nối máy chủ — sẵn sàng vào game.";
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
      const isMegaHit = event.kind === "damage" && event.amount >= 120;
      const color = event.kind === "damage" ? (isHeavyHit ? "#ffbe3c" : "#ff6961") : event.kind === "loot" ? "#f7d774" : "#8be78b";
      const fontSize = event.kind === "level" ? 20 : isMegaHit ? 30 : isHeavyHit ? 24 : 15;
      const ftIso = worldToIso(event.position.x, event.position.y);
      // Stack damage numbers vertically: bump up by recent-text count near
      // the same entity to avoid overlap.
      const now = this.time.now;
      const recents = this.recentFloating.filter((r) => r.id === event.entityId && now - r.at < 700);
      const stackIndex = recents.length;
      this.recentFloating.push({ id: event.entityId, at: now });
      if (this.recentFloating.length > 60) this.recentFloating.shift();
      const text = this.add.text(ftIso.x, ftIso.y - 28 - stackIndex * 14, event.text ?? `${event.amount}`, {
        fontFamily: "monospace",
        fontSize: `${fontSize}px`,
        color,
        stroke: "#111",
        strokeThickness: isHeavyHit ? 4 : 3,
        fontStyle: isHeavyHit ? "bold" : ""
      }).setDepth(99990).setOrigin(0.5);
      // Pop-in: numbers punch in big then settle (anime impact juice).
      text.setScale(isHeavyHit ? 2.1 : 1.45);
      this.tweens.add({ targets: text, scale: 1, duration: isHeavyHit ? 220 : 130, ease: "Back.Out" });
      this.tweens.add({
        targets: text,
        y: text.y - 34,
        alpha: 0,
        duration: 900,
        delay: 120,
        onComplete: () => text.destroy()
      });
      if (event.kind === "damage") {
        if (this.monsters.has(event.entityId)) soundManager.play("hit");
        this.playHitEffect(event.entityId, event.position);
        // Sprint 134: punchy crit word that pops above big damage numbers.
        if (isHeavyHit) {
          const label = isMegaHit ? "CỰC MẠNH!" : "CHÍ MẠNG!";
          const tag = this.add.text(ftIso.x, ftIso.y - 46, label, {
            fontFamily: "monospace", fontSize: isMegaHit ? "15px" : "12px",
            color: isMegaHit ? "#ff4df0" : "#ffd166", stroke: "#2a0a00", strokeThickness: 3, fontStyle: "bold"
          }).setOrigin(0.5).setDepth(99991).setScale(0.4).setAngle(-8);
          this.tweens.add({ targets: tag, scale: 1, duration: 200, ease: "Back.Out" });
          this.tweens.add({ targets: tag, y: tag.y - 18, alpha: 0, duration: 760, delay: 260, onComplete: () => tag.destroy() });
        }
        if (isHeavyHit) {
          this.cameras.main.shake(160, 0.008);
          // Crit indicator: 8 brief golden particles.
          for (let i = 0; i < 8; i += 1) {
            const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.2;
            const dot = this.add.circle(ftIso.x, ftIso.y - 28, 3, 0xffd166, 0.95).setDepth(99988);
            this.tweens.add({
              targets: dot,
              x: ftIso.x + Math.cos(ang) * 32,
              y: ftIso.y - 28 + Math.sin(ang) * 32,
              alpha: 0,
              duration: 350,
              onComplete: () => dot.destroy()
            });
          }
        }
        // Sprint 111: MEGA crit — chromatic split echoes behind the number +
        // an expanding shock ripple + a harder camera punch.
        if (isMegaHit) {
          this.cameras.main.shake(220, 0.013);
          for (const [dx, tint] of [[-3, "#22e0ff"], [3, "#ff2bd6"]] as const) {
            const ghost = this.add.text(text.x + dx, text.y, event.text ?? `${event.amount}`, {
              fontFamily: "monospace", fontSize: `${fontSize}px`, color: tint, fontStyle: "bold"
            }).setDepth(99989).setOrigin(0.5).setAlpha(0.6);
            ghost.setScale(text.scale);
            this.tweens.add({ targets: ghost, x: ghost.x + dx * 4, alpha: 0, duration: 260, ease: "Quad.Out", onComplete: () => ghost.destroy() });
          }
          const ripple = this.add.circle(ftIso.x, ftIso.y - 20, 10).setStrokeStyle(3, 0xffe066, 0.9).setDepth(99987);
          this.tweens.add({ targets: ripple, scale: 5, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => ripple.destroy() });
        }
      }
      if (event.kind === "level") {
        soundManager.play("levelUp");
        this.playLevelUpAura(event.position);
        if (event.entityId === this.selfId) {
          this.showTopBanner(`🎉 LEVEL ${event.amount}!`, "level", 2000);
          this.cameras.main.flash(260, 255, 226, 140);
          this.playSelfLevelUpFlash();
        }
      }
    });

    this.socket.on("achievementUnlocked", (payload) => {
      this.showTopBanner(`🏆 ${payload.title}`, "achievement", 3000);
      soundManager.play("levelUp");
      const self = this.players.get(this.selfId);
      if (self) this.playCelebration(self.x, self.y);
    });

    this.socket.on("skillCast", ({ casterId, skillId, position, targetPosition }) => {
      this.playCastBurst(position);
      this.playSkillVFX(skillId, position, targetPosition);
      // Sprint 136: feel your own power — a light camera kick when YOU land an
      // area skill, so big abilities have weight beyond the particles.
      if (casterId === this.selfId) {
        const info = SKILL_CATALOG[skillId];
        if (info?.effect === "damageAoe") this.cameras.main.shake(130, 0.004);
      }
    });

    this.socket.on("monsterProjectile", ({ sourcePosition, targetPosition, color }) => {
      this.playMonsterProjectile(sourcePosition, targetPosition, color);
    });

    this.socket.on("worldTime", (payload) => this.applyWorldTime(payload));

    this.socket.on("arenaKill", ({ killerName, victimName }) => {
      this.hud.log(`⚔ ${killerName} hạ ${victimName} tại Đấu Trường.`, "arena-line");
    });

    // Wire the arena toolbar button to fetch the leaderboard each time it opens.
    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal='arena-modal']").forEach((btn) => {
      btn.addEventListener("click", () => this.socket.emit("arenaLeaderboardRequest"));
    });

    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal='leaderboard-modal']").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.socket.emit("leaderboardRequest");
        this.activeLeaderboardTab = "byLevel";
      });
    });
    // Hotkey-driven modals also need their server requests.
    window.addEventListener("hotkey-leaderboard", () => {
      this.socket.emit("leaderboardRequest");
      this.activeLeaderboardTab = "byLevel";
    });
    window.addEventListener("hotkey-arena", () => this.socket.emit("arenaLeaderboardRequest"));
    // Marketplace: refresh listings whenever the modal opens (toolbar or hotkey).
    document.querySelectorAll<HTMLButtonElement>(".toolbar-btn[data-modal='market-modal']").forEach((btn) => {
      btn.addEventListener("click", () => this.socket.emit("requestMarket"));
    });
    window.addEventListener("hotkey-market", () => this.socket.emit("requestMarket"));

    window.addEventListener("loadout-save", ((event: CustomEvent<number>) => {
      this.socket.emit("saveLoadout", { slot: event.detail });
    }) as EventListener);
    window.addEventListener("loadout-load", ((event: CustomEvent<number>) => {
      this.socket.emit("loadLoadout", { slot: event.detail });
    }) as EventListener);

    this.socket.on("leaderboard", (payload) => {
      this.lastLeaderboard = payload;
      this.renderLeaderboard();
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
      if (kind === "defeat") this.playBossFinisher();
    });
    this.socket.on("chatHistory", (messages) => this.hud.setChatHistory(messages));
    this.socket.on("chatMessage", (message) => {
      this.hud.appendChat(message);
      this.showChatBubble(message.playerId, message.message);
    });
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
    this.cursors = this.input.keyboard.addKeys("F,Q,W,E,R,SHIFT") as Record<"F" | "Q" | "W" | "E" | "R" | "SHIFT", Phaser.Input.Keyboard.Key>;
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
        // Sprint 129: departure poof when another player leaves view/logs out.
        if (id !== this.selfId && this.cameras.main.worldView.contains(sprite.x, sprite.y)) {
          const ring = this.add.circle(sprite.x, sprite.y, 6).setStrokeStyle(2, 0x9be3ff, 0.8).setDepth(99990);
          this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 360, ease: "Cubic.Out", onComplete: () => ring.destroy() });
        }
        sprite.destroy();
        this.players.delete(id);
        this.names.get(id)?.destroy();
        this.names.delete(id);
        this.playerBars.get(id)?.destroy();
        this.playerBars.delete(id);
        this.playerEquipment.get(id)?.destroy();
        this.playerEquipment.delete(id);
        this.petSprites.get(id)?.destroy();
        this.petSprites.delete(id);
        this.playerAuras.get(id)?.destroy();
        this.playerAuras.delete(id);
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
        if (monster.boss) {
          // Extra screen-wide golden flash for boss kills.
          this.cameras.main.flash(420, 255, 220, 120);
        }
      }
      // Respawn materialize: not-alive -> alive on a sprite we already have.
      if (!wasAlive && isAlive && this.monsters.has(monster.id)) {
        this.playSpawnShimmer(monster.position, monster.boss || monster.elite);
      }
      // Sprint 121: aggro alert — flash a red "!" the moment a monster locks
      // onto the local player, so incoming threats read instantly.
      const aggroOnMe = isAlive && monster.targetPlayerId === this.selfId;
      if (aggroOnMe && !this.monsterAggroPrev.get(monster.id)) {
        this.playAggroAlert(monster.position, monster.boss || monster.elite);
        // Sprint 124: dramatic banner + flash when a BOSS turns on the player.
        if (monster.boss && this.time.now - this.lastBossAggroBannerAt > 12000) {
          this.lastBossAggroBannerAt = this.time.now;
          this.showTopBanner(`⚔ ${translateMonsterName(monster.name)} đã chú ý đến ngươi!`, "achievement", 2600);
          this.cameras.main.flash(260, 120, 0, 0, false);
          this.cameras.main.shake(200, 0.006);
        }
      }
      this.monsterAggroPrev.set(monster.id, aggroOnMe);
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
        this.statusFxAt.delete(id);
      }
    }

    const seenGroundItems = new Set<string>();
    for (const groundItem of snapshot.groundItems) {
      seenGroundItems.add(groundItem.id);
      // Shiny drop beam for newly-appearing rare/epic loot (anime flourish).
      if (!this.groundItems.has(groundItem.id) && groundItem.item.rarity !== "common") {
        this.playLootBeam(groundItem.position, groundItem.item.rarity);
      }
      this.renderGroundItem(groundItem);
    }
    for (const [id, sprite] of this.groundItems) {
      if (!seenGroundItems.has(id)) {
        this.playPickupBurst(sprite.x, sprite.y, sprite.texture.key === "chest");
        sprite.destroy();
        this.groundItems.delete(id);
        this.groundSparkleAt.delete(id);
        this.groundItemLabels.get(id)?.destroy();
        this.groundItemLabels.delete(id);
      }
    }
    this.updateTargetPanel(snapshot);
    this.hud.updatePartyVitals(snapshot.players);
    this.updateBossHud(snapshot);
    // Throttle minimap redraw to ~6 fps; that's enough for spatial awareness.
    const now = this.time.now;
    if (now - this.lastMinimapAt > 160) {
      this.redrawMinimap(snapshot);
      this.lastMinimapAt = now;
    }
    // Re-check ambient mood roughly every 2 seconds (player tile may change).
    if (now - this.lastAmbientCheck > 2000) {
      this.updateAmbientMood();
      this.lastAmbientCheck = now;
    }
  }

  private lastAmbientCheck = 0;

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
    // Pick the per-class sprite if the player has chosen a class; fall back
    // to the legacy "player" texture otherwise.
    const textureKey = player.playerClass === "warrior" ? "player-warrior"
      : player.playerClass === "mage" ? "player-mage"
      : player.playerClass === "ranger" ? "player-ranger"
      : "player";
    let sprite = this.players.get(player.id);
    if (!sprite) {
      const ip = worldToIso(position.x, position.y);
      // Class sprites are 12×14 (vs 8×8 fallback); use a smaller scale so
      // they render at roughly the same on-screen size.
      const scale = textureKey === "player" ? 3 : 2;
      sprite = this.add.sprite(ip.x, ip.y, textureKey).setScale(scale).setDepth(ip.y);
      if (player.id !== this.selfId) {
        sprite.setInteractive({ useHandCursor: true });
        sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (pointer.leftButtonDown()) this.socket.emit("targetPlayer", { playerId: player.id });
        });
      }
      this.players.set(player.id, sprite);
      // Sprint 129: graceful arrival — other players fade in with a soft ring
      // instead of popping into existence.
      if (player.id !== this.selfId) {
        sprite.setAlpha(0);
        this.tweens.add({ targets: sprite, alpha: 1, duration: 360, ease: "Quad.Out" });
        const ring = this.add.circle(ip.x, ip.y, 8).setStrokeStyle(2, 0x9be3ff, 0.9).setDepth(99990);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 480, ease: "Cubic.Out", onComplete: () => ring.destroy() });
      }
      const ip2 = worldToIso(position.x, position.y);
      const name = this.add.text(ip2.x, ip2.y - 34, this.displayName(player), {
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
    const ip3 = worldToIso(position.x, position.y);
    // Update the sprite's class texture if it changed (player picked a class
    // mid-session). Skip if texture key is the same to avoid flicker.
    if (sprite.texture.key !== textureKey) {
      sprite.setTexture(textureKey);
      sprite.setScale(textureKey === "player" ? 3 : 2);
    }
    // Subtle idle "breathing" bob when standing still (anime liveliness).
    const speed2 = player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y;
    const bob = speed2 < 4 ? Math.sin(this.time.now / 360 + ip3.x * 0.05) * 1.4 : 0;
    sprite.setPosition(ip3.x, ip3.y + bob);
    sprite.setDepth(ip3.y);
    sprite.setFlipX(facing === "left");
    // Apply cosmetic skin tint when the player has one active.
    if (player.activeCosmeticSkin) {
      const tint = cosmeticSkinTint(player.activeCosmeticSkin);
      if (tint !== undefined) sprite.setTint(tint);
      else sprite.clearTint();
    } else {
      sprite.clearTint();
    }
    if (player.id !== this.selfId) {
      sprite.disableInteractive();
      sprite.setInteractive({ useHandCursor: true });
    }
    const nameColor = player.id === this.selfId ? "#a8d8ff" : this.partyMemberIds.has(player.id) ? "#8be78b" : "#f1f1f1";
    this.names.get(player.id)?.setText(this.displayName(player)).setColor(nameColor).setPosition(ip3.x, ip3.y - 42).setDepth(ip3.y + 2);
    // Iso depth sort: bar + gear must follow sprite's depth, otherwise the
    // fixed (12,13) depth set at creation puts them under the sprite once
    // ip3.y exceeds those values (which it always does in a 200x150 world).
    this.playerBars.get(player.id)?.setDepth(ip3.y + 1);
    this.playerEquipment.get(player.id)?.setDepth(ip3.y + 0.5);
    this.drawPlayerBar(player, ip3);
    this.drawPlayerEquipment(player, ip3, facing);
    this.updatePetSprite(player, ip3);
    this.updatePlayerAura(player, ip3);
  }

  // Pulsing golden ground aura under players with an active buff (VIP / gold
  // boost) so power-ups read at a glance (Sprint 101).
  private updatePlayerAura(player: PlayerState, position: Vec2): void {
    const buffed = isVipActive(player.vipUntil) || isGoldBoostActive(player.goldBoostUntil);
    let aura = this.playerAuras.get(player.id);
    if (!buffed) {
      if (aura) { aura.destroy(); this.playerAuras.delete(player.id); }
      return;
    }
    if (!aura) {
      aura = this.add.ellipse(position.x, position.y + 8, 30, 14, 0xffd166, 0.3);
      this.playerAuras.set(player.id, aura);
    }
    const pulse = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(this.time.now / 260));
    aura.setPosition(position.x, position.y + 8).setDepth(position.y - 2).setAlpha(pulse);
  }

  /** Small companion orb that trails the player when a pet is equipped. */
  private updatePetSprite(player: PlayerState, position: Vec2): void {
    const pet = getPet(player.activePet);
    let arc = this.petSprites.get(player.id);
    if (!pet) {
      if (arc) { arc.destroy(); this.petSprites.delete(player.id); }
      return;
    }
    if (!arc) {
      arc = this.add.circle(position.x, position.y, 5, pet.color).setStrokeStyle(2, 0x000000, 0.5);
      this.petSprites.set(player.id, arc);
    }
    arc.setFillStyle(pet.color);
    // Trail slightly behind-left of the hero, just above the ground shadow.
    arc.setPosition(position.x - 16, position.y - 6).setDepth(position.y - 1);
  }

  /** Name label text: optional title + guild tag prefix before the name. */
  private displayName(player: PlayerState): string {
    const title = titleLabel(player.activeTitle);
    const parts: string[] = [];
    if (title) parts.push(`«${title}»`);
    if (player.guildTag) parts.push(`[${player.guildTag}]`);
    parts.push(player.accountName);
    return parts.join(" ");
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
    const iso = worldToIso(position.x, position.y);
    let sprite = this.monsters.get(monster.id);
    if (!sprite) {
      sprite = this.add.sprite(iso.x, iso.y, "monster").setScale(3).setDepth(iso.y);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => {
        if (!monster.respawnsAt) this.socket.emit("targetMonster", { monsterId: monster.id });
      });
      this.monsters.set(monster.id, sprite);
      this.monsterBars.set(monster.id, this.add.graphics().setDepth(iso.y + 1));
      this.monsterLabels.set(monster.id, this.add.text(iso.x, iso.y - 45, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f3e7bf",
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(iso.y + 2));
    }

    sprite.setTexture(monster.respawnsAt ? "dead" : "monster");
    sprite.setAlpha(monster.respawnsAt ? 0.35 : 1);
    const definition = getMonsterDefinition(monster.type);
    // Status effect tints override the base definition tint:
    // burn -> orange/red, bleed -> magenta, freeze -> cyan.
    const effects = monster.activeEffects ?? [];
    let tint = monster.boss ? 0xfff1a8 : monster.elite ? 0xffd36b : definition.tint;
    if (effects.some((e) => e.kind === "burn")) tint = 0xff6a3c;
    else if (effects.some((e) => e.kind === "freeze")) tint = 0x9bd2ff;
    else if (effects.some((e) => e.kind === "bleed")) tint = 0xd94b88;
    // Sprint 113: enrage telegraph — bosses/elites below 30% HP throb toward an
    // angry red so the final phase reads at a glance.
    else if ((monster.boss || monster.elite) && !monster.respawnsAt && monster.maxHp > 0 && monster.hp / monster.maxHp < 0.3) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 110);
      tint = lerpColorHex(tint, 0xff2a22, 0.35 + 0.5 * pulse);
    }
    sprite.setTint(tint);
    // Lingering status particles (throttled per monster ~180ms).
    if (effects.length && !monster.respawnsAt) {
      const now = this.time.now;
      if (now - (this.statusFxAt.get(monster.id) ?? 0) > 180) {
        this.statusFxAt.set(monster.id, now);
        this.emitStatusParticle(effects[0].kind, iso.x, iso.y);
      }
    }
    sprite.setScale(monster.boss ? definition.scale : monster.elite ? definition.scale * 1.18 : definition.scale);
    sprite.disableInteractive();
    if (!monster.respawnsAt) sprite.setInteractive({ useHandCursor: true });
    sprite.setPosition(iso.x, iso.y);
    sprite.setDepth(iso.y);
    // Face direction of movement (or last facing if stationary).
    if (monster.velocity.x !== 0) sprite.setFlipX(monster.velocity.x < 0);
    const name = `${monster.boss ? `${t("bossPrefix")} ` : monster.elite ? `${t("elitePrefix")} ` : ""}${translateMonsterName(monster.name)}`;
    // Sprint 133: con-style threat coloring — tint the nameplate by how the
    // monster's level compares to the player's so danger reads at a glance.
    const selfLevel = this.selfPlayer?.stats.level ?? monster.level;
    const delta = monster.level - selfLevel;
    let threatColor = "#f3e7bf";
    if (delta >= 5) threatColor = "#ff5a5a";
    else if (delta >= 2) threatColor = "#ff9d4d";
    else if (delta >= -1) threatColor = "#ffe088";
    else if (delta >= -4) threatColor = "#9be88b";
    else threatColor = "#9aa0a6";
    this.monsterLabels.get(monster.id)
      ?.setText(`${t("levelShort")} ${monster.level} ${name}`)
      .setColor(monster.boss ? "#fff1a8" : threatColor)
      .setPosition(iso.x, iso.y - (monster.boss ? 66 : monster.elite ? 52 : 45))
      .setDepth(iso.y + 2)
      .setVisible(!monster.respawnsAt);
    this.monsterBars.get(monster.id)?.setDepth(iso.y + 1);
    this.drawMonsterBar(monster, iso);
  }

  private renderGroundItem(groundItem: GroundItem): void {
    const isTreasure = groundItem.droppedBy === "treasure";
    const iso = worldToIso(groundItem.position.x, groundItem.position.y);
    let sprite = this.groundItems.get(groundItem.id);
    if (!sprite) {
      const texture = isTreasure ? "chest" : "ground-item";
      const scale = isTreasure ? 3 : 2.5;
      sprite = this.add.sprite(iso.x, iso.y, texture).setScale(scale).setDepth(iso.y);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) this.socket.emit("pickupGroundItem", { groundItemId: groundItem.id });
      });
      this.groundItems.set(groundItem.id, sprite);
      const labelText = isTreasure ? "Rương Kho Báu" : groundItem.item.name;
      const label = this.add.text(iso.x, iso.y - 24, labelText, {
        fontFamily: "monospace",
        fontSize: isTreasure ? "11px" : "10px",
        color: isTreasure ? "#f7d774" : rarityHex(groundItem.item.rarity),
        stroke: "#111",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(iso.y + 1);
      this.groundItemLabels.set(groundItem.id, label);
    }
    sprite.setPosition(iso.x, iso.y);
    sprite.setDepth(iso.y);
    if (!isTreasure) sprite.setTint(rarityColor(groundItem.item.rarity));
    this.groundItemLabels.get(groundItem.id)
      ?.setText(groundItem.item.name)
      .setColor(rarityHex(groundItem.item.rarity))
      .setPosition(iso.x, iso.y - 20)
      .setDepth(iso.y + 1);
    // Idle shimmer for rare/epic loot + treasure chests (anime treasure feel).
    const shiny = isTreasure || groundItem.item.rarity !== "common";
    if (shiny) {
      const now = this.time.now;
      if (now - (this.groundSparkleAt.get(groundItem.id) ?? 0) > 520) {
        this.groundSparkleAt.set(groundItem.id, now + Math.random() * 200);
        const color = isTreasure ? 0xffe28c : groundItem.item.rarity === "epic" ? 0xd98cff : 0x9cc6ff;
        const star = this.add.circle(iso.x + (Math.random() - 0.5) * 16, iso.y - 4 - Math.random() * 8, 1.8, color, 0.95).setDepth(iso.y + 2);
        this.tweens.add({ targets: star, y: star.y - 12, alpha: 0, scale: 0.4, duration: 620, ease: "Quad.Out", onComplete: () => star.destroy() });
      }
    }
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
    const innerW = width - 2;
    const x0 = position.x - width / 2;
    bar.fillStyle(0x151515, 0.9).fillRect(x0, position.y - 34, width, 6);
    // Sprint 127: damage-lag — a pale "ghost" chunk drains down to the real HP
    // a beat later, making each hit land with visible weight.
    let lag = this.monsterHpLag.get(monster.id);
    if (lag === undefined || pct > lag) lag = pct;
    else lag = Math.max(pct, lag - 0.035);
    this.monsterHpLag.set(monster.id, lag);
    if (lag > pct) {
      bar.fillStyle(0xfff1f1, 0.85).fillRect(x0 + 1 + innerW * pct, position.y - 33, innerW * (lag - pct), 4);
    }
    bar.fillStyle(monster.boss ? 0xffd36b : monster.elite ? 0xffb347 : 0xd94b4b, 1).fillRect(x0 + 1, position.y - 33, innerW * pct, 4);
    if (this.selfPlayer && this.selfPlayer.targetId === monster.id) {
      bar.lineStyle(1, 0xf8e66d, 1).strokeRect(position.x - width / 2 - 1, position.y - 35, width + 2, 8);
    }
  }

  // Sprint 119: animated lock-on reticle — four rotating corner brackets +
  // pulsing ring track the currently targeted monster for a clear combat focus.
  private drawTargetReticle(time: number): void {
    if (!this.targetReticle) this.targetReticle = this.add.graphics().setDepth(99960);
    const g = this.targetReticle;
    g.clear();
    const targetId = this.selfPlayer?.targetId;
    const sprite = targetId ? this.monsters.get(targetId) : undefined;
    const snap = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    const mon = targetId ? snap?.monsters.find((m) => m.id === targetId) : undefined;
    if (!sprite || !mon || mon.respawnsAt) return;
    const cx = sprite.x;
    const cy = sprite.y - 6;
    const r = mon.boss ? 40 : mon.elite ? 30 : 24;
    const rot = time / 600;
    const pulse = 1 + Math.sin(time / 220) * 0.06;
    const rr = r * pulse;
    const color = mon.boss ? 0xff5a5a : 0xf8e66d;
    // Faint full ring.
    g.lineStyle(1, color, 0.35).strokeCircle(cx, cy, rr);
    // Four rotating corner brackets.
    g.lineStyle(2.5, color, 0.95);
    for (let i = 0; i < 4; i += 1) {
      const a = rot + (Math.PI / 2) * i;
      const ax = cx + Math.cos(a) * rr;
      const ay = cy + Math.sin(a) * rr;
      const t1 = a + 0.32;
      const t2 = a - 0.32;
      g.beginPath();
      g.moveTo(cx + Math.cos(t1) * rr, cy + Math.sin(t1) * rr);
      g.lineTo(ax, ay);
      g.lineTo(cx + Math.cos(t2) * rr, cy + Math.sin(t2) * rr);
      g.strokePath();
    }
  }

  private drawMoveMarker(): void {
    if (!this.moveMarker) this.moveMarker = this.add.graphics().setDepth(99999);
    this.moveMarker.clear();
    if (!this.moveTarget) return;
    const iso = worldToIso(this.moveTarget.x, this.moveTarget.y);
    this.moveMarker.lineStyle(2, 0xf7d774, 0.95);
    this.moveMarker.strokeCircle(iso.x, iso.y, 10);
    this.moveMarker.lineBetween(iso.x - 5, iso.y, iso.x + 5, iso.y);
    this.moveMarker.lineBetween(iso.x, iso.y - 5, iso.x, iso.y + 5);
  }

  private clearMoveTarget(): void {
    this.moveTarget = undefined;
    this.moveMarker?.clear();
  }

  private useFirstPotion(): void {
    const potion = this.selfPlayer?.inventory.items.find((item) => item.kind === "consumable");
    if (!potion) return;
    this.socket.emit("useItem", { itemId: potion.id });
    // Heal flash on self: green ring + rising plus-cross sparkles.
    const self = this.players.get(this.selfId);
    if (self) {
      const ring = this.add.circle(self.x, self.y, 8, 0x8be78b, 0).setStrokeStyle(2.5, 0x8be78b, 0.9).setDepth(self.depth + 1);
      this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => ring.destroy() });
      for (let i = 0; i < 6; i += 1) {
        const px = self.x + (Math.random() - 0.5) * 22;
        const plus = this.add.text(px, self.y, "+", { fontFamily: "monospace", fontSize: "14px", color: "#8be78b", stroke: "#0a2", strokeThickness: 2 }).setOrigin(0.5).setDepth(99999);
        this.tweens.add({ targets: plus, y: self.y - 30 - Math.random() * 18, alpha: 0, duration: 600 + Math.random() * 200, ease: "Quad.Out", onComplete: () => plus.destroy() });
      }
    }
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

  // Travel a small glowing orb from `from` to `to` in iso space.
  private playMonsterProjectile(from: Vec2, to: Vec2, color: number): void {
    const a = worldToIso(from.x, from.y);
    const b = worldToIso(to.x, to.y);
    const glow = this.add.circle(a.x, a.y, 8, color, 0.3).setDepth(99987);
    const orb = this.add.circle(a.x, a.y, 4, color, 0.95).setDepth(99989);
    const ring = this.add.circle(a.x, a.y, 6, color, 0).setStrokeStyle(1, color, 0.6).setDepth(99988);
    // Trailing motes left along the flight path.
    let trailPhase = 0;
    const onUpdate = () => {
      trailPhase += 1;
      if (trailPhase % 2 === 0) {
        const t = this.add.circle(orb.x, orb.y, 2.5, color, 0.6).setDepth(99986);
        this.tweens.add({ targets: t, alpha: 0, scale: 0.2, duration: 220, onComplete: () => t.destroy() });
      }
    };
    this.tweens.add({
      targets: [orb, ring, glow],
      x: b.x,
      y: b.y,
      duration: 280,
      ease: "Cubic.Out",
      onUpdate,
      onComplete: () => {
        // Tiny impact burst at the target.
        const flash = this.add.circle(b.x, b.y, 6, 0xffffff, 0.8).setDepth(99990);
        this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
        orb.destroy();
        ring.destroy();
        glow.destroy();
      }
    });
  }

  // Shiny drop: a rising light beam + sparkles when rare/epic loot appears.
  private playLootBeam(position: Vec2, rarity: "rare" | "epic"): void {
    const iso = worldToIso(position.x, position.y);
    const color = rarity === "epic" ? 0xd98cff : 0x69a7ff;
    const beam = this.add.rectangle(iso.x, iso.y, rarity === "epic" ? 14 : 10, 80, color, 0.5)
      .setOrigin(0.5, 1).setDepth(iso.y - 1);
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.3, duration: 700, ease: "Quad.Out", onComplete: () => beam.destroy() });
    const ring = this.add.ellipse(iso.x, iso.y + 4, 16, 8).setStrokeStyle(2, color, 0.95).setDepth(iso.y - 1);
    this.tweens.add({ targets: ring, scaleX: 2.6, scaleY: 2.6, alpha: 0, duration: 560, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    const n = rarity === "epic" ? 8 : 5;
    for (let i = 0; i < n; i += 1) {
      const sx = iso.x + (Math.random() - 0.5) * 22;
      const star = this.add.circle(sx, iso.y, 2, 0xffffff, 0.95).setDepth(99999);
      this.tweens.add({ targets: star, y: iso.y - 30 - Math.random() * 26, alpha: 0, duration: 600 + Math.random() * 200, ease: "Quad.Out", onComplete: () => star.destroy() });
    }
  }

  // Sprint 114: satisfying pop when an item/chest is picked up — gold ring +
  // sparkle fan. Chests get a bigger golden burst than ordinary drops.
  private playPickupBurst(x: number, y: number, isTreasure: boolean): void {
    if (!this.cameras.main.worldView.contains(x, y)) return;
    const color = isTreasure ? 0xffd166 : 0xfff4cf;
    const ring = this.add.ellipse(x, y, 14, 8).setStrokeStyle(2, color, 0.95).setDepth(99997);
    this.tweens.add({ targets: ring, scaleX: isTreasure ? 3.4 : 2.2, scaleY: isTreasure ? 3.4 : 2.2, alpha: 0, duration: isTreasure ? 520 : 380, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    const n = isTreasure ? 10 : 6;
    for (let i = 0; i < n; i += 1) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const dist = (isTreasure ? 30 : 20) + Math.random() * 10;
      const star = this.add.circle(x, y, isTreasure ? 2.6 : 2, color, 0.95).setDepth(99998);
      this.tweens.add({ targets: star, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist - 8, alpha: 0, scale: 0.3, duration: isTreasure ? 560 : 420, ease: "Quad.Out", onComplete: () => star.destroy() });
    }
  }

  // One small lingering particle for an active status effect (Sprint 97).
  private emitStatusParticle(kind: "burn" | "freeze" | "bleed", x: number, y: number): void {
    if (kind === "burn") {
      const ember = this.add.circle(x + (Math.random() - 0.5) * 16, y - 4, 2 + Math.random() * 1.5, Math.random() < 0.5 ? 0xff7a2a : 0xffd166, 0.9).setDepth(99980);
      this.tweens.add({ targets: ember, y: ember.y - 22 - Math.random() * 12, alpha: 0, duration: 480, ease: "Quad.Out", onComplete: () => ember.destroy() });
    } else if (kind === "freeze") {
      const flake = this.add.rectangle(x + (Math.random() - 0.5) * 18, y - 8, 3, 3, 0xeaffff, 0.9).setDepth(99980).setRotation(Math.random() * Math.PI);
      this.tweens.add({ targets: flake, alpha: 0, scale: 0.3, duration: 420, onComplete: () => flake.destroy() });
    } else {
      const drop = this.add.circle(x + (Math.random() - 0.5) * 14, y - 2, 2, 0xd94b88, 0.9).setDepth(99980);
      this.tweens.add({ targets: drop, y: drop.y + 16, alpha: 0, duration: 380, ease: "Quad.In", onComplete: () => drop.destroy() });
    }
  }

  private playDeathPoof(position: Vec2, big: boolean): void {
    const iso = worldToIso(position.x, position.y);
    // Flash core + shockwave ring (anime dissolve burst).
    const flash = this.add.circle(iso.x, iso.y, big ? 12 : 7, 0xffffff, 0.9).setDepth(99998);
    this.tweens.add({ targets: flash, scale: big ? 3 : 2, alpha: 0, duration: 220, ease: "Quad.Out", onComplete: () => flash.destroy() });
    const ring = this.add.circle(iso.x, iso.y, big ? 8 : 5).setStrokeStyle(big ? 3 : 2, 0xffd166, 0.9).setDepth(99997);
    this.tweens.add({ targets: ring, scale: big ? 6 : 4, alpha: 0, duration: big ? 480 : 340, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    const count = big ? 16 : 9;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = (big ? 70 : 50) + Math.random() * 30;
      const radius = big ? 5 : 3.5;
      const color = big ? 0xffd166 : 0xd8d8d8;
      const dot = this.add.circle(iso.x, iso.y, radius, color, 0.95).setDepth(99998);
      this.tweens.add({
        targets: dot,
        x: iso.x + Math.cos(angle) * speed,
        y: iso.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: big ? 700 : 500,
        ease: "Cubic.Out",
        onComplete: () => dot.destroy()
      });
    }
    // Rising "soul" wisps that float up and fade (anime death flourish).
    const souls = big ? 4 : 2;
    for (let i = 0; i < souls; i += 1) {
      const sx = iso.x + (Math.random() - 0.5) * (big ? 24 : 14);
      const soul = this.add.circle(sx, iso.y, big ? 3.5 : 2.5, 0xbfeaff, 0.9).setDepth(99999);
      this.tweens.add({
        targets: soul,
        y: iso.y - (big ? 70 : 44) - Math.random() * 20,
        alpha: 0,
        duration: big ? 900 : 650,
        ease: "Sine.Out",
        onComplete: () => soul.destroy()
      });
    }
    if (big) this.cameras.main.shake(180, 0.006);
  }

  // Sprint 110: monster respawn materialize — implode ring + rising sparkles so
  // foes fade in instead of popping into existence.
  private playSpawnShimmer(position: Vec2, big: boolean): void {
    const iso = worldToIso(position.x, position.y);
    const ring = this.add.circle(iso.x, iso.y, big ? 30 : 20).setStrokeStyle(2, 0x9b7bff, 0.85).setDepth(99996);
    this.tweens.add({ targets: ring, scale: 0.15, alpha: 0, duration: 360, ease: "Cubic.In", onComplete: () => ring.destroy() });
    const core = this.add.circle(iso.x, iso.y, big ? 6 : 4, 0xe0d4ff, 0).setDepth(99997);
    this.tweens.add({ targets: core, alpha: 0.9, duration: 180, yoyo: true, ease: "Sine.InOut", onComplete: () => core.destroy() });
    const motes = big ? 8 : 5;
    for (let i = 0; i < motes; i += 1) {
      const angle = (Math.PI * 2 * i) / motes;
      const dist = big ? 26 : 18;
      const sx = iso.x + Math.cos(angle) * dist;
      const sy = iso.y + Math.sin(angle) * dist;
      const mote = this.add.circle(sx, sy, 2.5, 0xc9b6ff, 0.95).setDepth(99997);
      this.tweens.add({ targets: mote, x: iso.x, y: iso.y, alpha: 0, scale: 0.3, duration: 340, ease: "Quad.In", onComplete: () => mote.destroy() });
    }
  }

  // Sprint 121: brief red "!" alert that pops above a monster the instant it
  // aggroes onto the local player.
  private playAggroAlert(position: Vec2, big: boolean): void {
    const iso = worldToIso(position.x, position.y);
    if (!this.cameras.main.worldView.contains(iso.x, iso.y)) return;
    const y0 = iso.y - (big ? 52 : 40);
    const mark = this.add.text(iso.x, y0, "!", {
      fontFamily: "monospace", fontSize: big ? "24px" : "18px", color: "#ff4d4d",
      stroke: "#2a0000", strokeThickness: 4, fontStyle: "bold"
    }).setOrigin(0.5).setDepth(99992).setScale(0.4);
    this.tweens.add({ targets: mark, scale: 1, y: y0 - 8, duration: 180, ease: "Back.Out" });
    this.tweens.add({ targets: mark, alpha: 0, duration: 360, delay: 480, onComplete: () => mark.destroy() });
    const ring = this.add.circle(iso.x, iso.y - 6, 6).setStrokeStyle(2, 0xff4d4d, 0.9).setDepth(99991);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 380, ease: "Cubic.Out", onComplete: () => ring.destroy() });
  }

  // Element-specific flourish at an impact point (Sprint 94).
  private elementalAccent(element: SkillElement, x: number, y: number): void {
    if (element === "lightning") {
      // Jagged vertical bolt striking down + white flash.
      const g = this.add.graphics().setDepth(99999);
      g.lineStyle(3, 0xffffff, 0.95);
      let px = x, py = y - 90;
      g.beginPath(); g.moveTo(px, py);
      for (let s = 0; s < 5; s += 1) { px = x + (Math.random() - 0.5) * 18; py += 18; g.lineTo(px, py); }
      g.lineTo(x, y); g.strokePath();
      const flash = this.add.circle(x, y, 14, 0xffffff, 0.7).setDepth(99998);
      this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
      this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    } else if (element === "ice") {
      // Shattering ice shards.
      for (let i = 0; i < 7; i += 1) {
        const ang = (Math.PI * 2 * i) / 7;
        const shard = this.add.rectangle(x, y, 3, 9, 0xeaffff, 0.95).setDepth(99998).setRotation(ang);
        this.tweens.add({ targets: shard, x: x + Math.cos(ang) * 30, y: y + Math.sin(ang) * 30, alpha: 0, duration: 320, ease: "Quad.Out", onComplete: () => shard.destroy() });
      }
    } else if (element === "fire") {
      // Rising embers.
      for (let i = 0; i < 8; i += 1) {
        const ember = this.add.circle(x + (Math.random() - 0.5) * 28, y, 2 + Math.random() * 1.5, i % 2 ? 0xff7a2a : 0xffd166, 0.95).setDepth(99998);
        this.tweens.add({ targets: ember, y: y - 30 - Math.random() * 26, alpha: 0, duration: 460 + Math.random() * 200, ease: "Quad.Out", onComplete: () => ember.destroy() });
      }
    } else if (element === "holy") {
      const halo = this.add.circle(x, y, 10, 0xffffff, 0.8).setDepth(99998);
      this.tweens.add({ targets: halo, scale: 3.2, alpha: 0, duration: 320, ease: "Quad.Out", onComplete: () => halo.destroy() });
    } else if (element === "shadow" || element === "void") {
      for (let i = 0; i < 8; i += 1) {
        const ang = (Math.PI * 2 * i) / 8;
        const wisp = this.add.circle(x + Math.cos(ang) * 26, y + Math.sin(ang) * 26, 3, element === "void" ? 0x8a4dff : 0x7a3fbf, 0.9).setDepth(99998);
        this.tweens.add({ targets: wisp, x, y, scale: 0.3, alpha: 0, duration: 300, ease: "Quad.In", onComplete: () => wisp.destroy() });
      }
    }
  }

  private playSkillVFX(skillId: SkillId, position: Vec2, targetPosition?: Vec2): void {
    const info = SKILL_CATALOG[skillId];
    if (!info) return;
    const theme = skillTheme(skillId);
    const iso = worldToIso(position.x, position.y);
    const tgtIso = targetPosition ? worldToIso(targetPosition.x, targetPosition.y) : undefined;

    // Sprint 115: universal cast wind-up — a theme-colored charge ring snaps
    // inward onto the caster the instant any skill fires, giving casts weight.
    const charge = this.add.circle(iso.x, iso.y, 34).setStrokeStyle(2.5, theme.rim, 0.85).setDepth(99996);
    this.tweens.add({ targets: charge, scale: 0.12, alpha: 0, duration: 180, ease: "Quad.In", onComplete: () => charge.destroy() });
    const castGlow = this.add.ellipse(iso.x, iso.y + 6, 24, 12, theme.core, 0.45).setDepth(iso.y - 1);
    this.tweens.add({ targets: castGlow, scaleX: 1.7, scaleY: 1.7, alpha: 0, duration: 260, ease: "Cubic.Out", onComplete: () => castGlow.destroy() });

    if (info.effect === "healSelf") {
      // Pulsing aura ring + rising sparkles + inner glow.
      const aura = this.add.circle(iso.x, iso.y, 6, 0x8be78b, 0.45).setDepth(99996);
      this.tweens.add({
        targets: aura,
        radius: 38,
        alpha: 0,
        duration: 700,
        ease: "Cubic.Out",
        onComplete: () => aura.destroy()
      });
      const ring1 = this.add.circle(iso.x, iso.y, 10, 0x8be78b, 0).setStrokeStyle(2, 0x8be78b, 0.95).setDepth(99997);
      const ring2 = this.add.circle(iso.x, iso.y, 6, 0xffffff, 0).setStrokeStyle(1.5, 0xffffff, 0.85).setDepth(99997);
      this.tweens.add({ targets: ring1, radius: 32, alpha: 0, duration: 560, onComplete: () => ring1.destroy() });
      this.tweens.add({ targets: ring2, radius: 24, alpha: 0, duration: 440, delay: 80, onComplete: () => ring2.destroy() });
      // 10 rising sparkles in 2 colors.
      for (let i = 0; i < 10; i += 1) {
        const color = i % 2 === 0 ? 0x8be78b : 0xeaffe0;
        const dx = (Math.random() - 0.5) * 28;
        const dot = this.add.circle(iso.x + dx, iso.y + 10, 1.6 + Math.random(), color, 0.95).setDepth(99998);
        this.tweens.add({
          targets: dot,
          y: dot.y - 32 - Math.random() * 22,
          alpha: 0,
          scale: 0.4,
          duration: 700 + Math.random() * 250,
          ease: "Cubic.Out",
          onComplete: () => dot.destroy()
        });
      }
      return;
    }

    if (info.effect === "damageAoe") {
      const radius = info.aoeRadius ?? 100;
      // Inner shockwave that expands quickly.
      const inner = this.add.circle(iso.x, iso.y, 4, theme.core, 0.6).setDepth(99996);
      this.tweens.add({ targets: inner, radius: radius * 0.65, alpha: 0, duration: 280, ease: "Cubic.Out", onComplete: () => inner.destroy() });
      // Outer rimmed ring.
      const ring = this.add.circle(iso.x, iso.y, 6, theme.core, 0).setStrokeStyle(3, theme.rim, 0.95).setDepth(99997);
      this.tweens.add({ targets: ring, radius, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => ring.destroy() });
      // Secondary thinner ring trailing behind.
      const ring2 = this.add.circle(iso.x, iso.y, 4, theme.core, 0).setStrokeStyle(2, theme.core, 0.85).setDepth(99997);
      this.tweens.add({ targets: ring2, radius: radius * 0.85, alpha: 0, duration: 360, delay: 60, onComplete: () => ring2.destroy() });
      this.elementalAccent(theme.element, iso.x, iso.y);
      // 8 outward sparks.
      for (let i = 0; i < 8; i += 1) {
        const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.18;
        const spark = this.add.circle(iso.x, iso.y, 2.5, theme.rim, 1).setDepth(99998);
        this.tweens.add({
          targets: spark,
          x: iso.x + Math.cos(ang) * radius * 0.9,
          y: iso.y + Math.sin(ang) * radius * 0.9,
          alpha: 0,
          duration: 420,
          ease: "Quad.Out",
          onComplete: () => spark.destroy()
        });
      }
      return;
    }

    if (info.effect === "lifestealSingle" && tgtIso) {
      // Twisting red beam: 3 parallel lines + spiral particles.
      const g = this.add.graphics().setDepth(99997);
      g.lineStyle(4, 0xff5d7a, 0.95);
      g.lineBetween(iso.x, iso.y, tgtIso.x, tgtIso.y);
      g.lineStyle(2, 0xffb0c1, 0.9);
      g.lineBetween(iso.x, iso.y - 4, tgtIso.x, tgtIso.y - 4);
      g.lineStyle(2, 0xb33049, 0.9);
      g.lineBetween(iso.x, iso.y + 4, tgtIso.x, tgtIso.y + 4);
      this.tweens.add({ targets: g, alpha: 0, duration: 360, onComplete: () => g.destroy() });
      const dx = tgtIso.x - iso.x;
      const dy = tgtIso.y - iso.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / (len || 1);
      const ny = dx / (len || 1);
      for (let i = 0; i < 6; i += 1) {
        const t = i / 6;
        const sway = Math.sin(i * 1.3) * 6;
        const px = iso.x + dx * t + nx * sway;
        const py = iso.y + dy * t + ny * sway;
        const drop = this.add.circle(px, py, 2.5, 0xff5d7a, 1).setDepth(99998);
        this.tweens.add({
          targets: drop,
          x: iso.x + Math.cos(Math.random() * Math.PI * 2) * 8,
          y: iso.y - Math.random() * 18,
          alpha: 0,
          duration: 380,
          ease: "Quad.Out",
          delay: i * 22,
          onComplete: () => drop.destroy()
        });
      }
      return;
    }

    // damageSingle — double slash with impact spark, themed per element.
    if (tgtIso) {
      const slash = this.add.graphics().setDepth(99997);
      slash.lineStyle(4, theme.rim, 0.95);
      slash.lineBetween(iso.x, iso.y, tgtIso.x, tgtIso.y);
      slash.lineStyle(2, theme.core, 0.95);
      const dx = tgtIso.x - iso.x;
      const dy = tgtIso.y - iso.y;
      // Second slash offset perpendicular for a "double" feel.
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 4;
      const ny = dx / len * 4;
      slash.lineBetween(iso.x + nx, iso.y + ny, tgtIso.x + nx, tgtIso.y + ny);
      this.tweens.add({ targets: slash, alpha: 0, duration: 280, onComplete: () => slash.destroy() });
      // 5 outward sparks at impact.
      for (let i = 0; i < 5; i += 1) {
        const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6;
        const spark = this.add.circle(tgtIso.x, tgtIso.y, 2, 0xfff1a8, 1).setDepth(99998);
        this.tweens.add({
          targets: spark,
          x: tgtIso.x + Math.cos(ang) * 22,
          y: tgtIso.y + Math.sin(ang) * 22,
          alpha: 0,
          duration: 280,
          ease: "Quad.Out",
          onComplete: () => spark.destroy()
        });
      }
    }
  }

  // Cinematic boss finisher: zoom-punch + white flash + golden shockwave +
  // radial speed-lines around the camera centre (anime "finishing blow").
  private playBossFinisher(): void {
    const cam = this.cameras.main;
    cam.flash(360, 255, 240, 180);
    cam.shake(420, 0.012);
    // Zoom punch in then ease back out.
    this.tweens.add({ targets: cam, zoom: 1.18, duration: 140, ease: "Quad.Out", yoyo: true, hold: 90 });
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    // Expanding golden shockwave at screen centre.
    const ring = this.add.circle(cx, cy, 20).setStrokeStyle(4, 0xffd166, 0.95).setDepth(99999);
    this.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 520, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    // Radial speed-lines.
    for (let i = 0; i < 16; i += 1) {
      const ang = (Math.PI * 2 * i) / 16;
      const line = this.add.rectangle(cx + Math.cos(ang) * 60, cy + Math.sin(ang) * 60, 40, 3, 0xffffff, 0.8)
        .setRotation(ang).setDepth(99998);
      this.tweens.add({
        targets: line,
        x: cx + Math.cos(ang) * 240,
        y: cy + Math.sin(ang) * 240,
        alpha: 0,
        duration: 360,
        ease: "Quad.Out",
        onComplete: () => line.destroy()
      });
    }
  }

  // Anime power-up on level-up: a rising light pillar + expanding golden rings
  // + sparks lifting off the character.
  private playLevelUpAura(position: { x: number; y: number }): void {
    const iso = worldToIso(position.x, position.y);
    const pillar = this.add.rectangle(iso.x, iso.y - 24, 26, 70, 0xffe28c, 0.5).setDepth(57).setOrigin(0.5, 1);
    this.tweens.add({ targets: pillar, scaleX: 0.2, alpha: 0, duration: 520, ease: "Quad.Out", onComplete: () => pillar.destroy() });
    for (let r = 0; r < 2; r += 1) {
      const ring = this.add.ellipse(iso.x, iso.y + 4, 18, 9).setStrokeStyle(3, 0xffd166, 0.95).setDepth(57);
      this.tweens.add({ targets: ring, scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 560, delay: r * 140, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    }
    for (let i = 0; i < 10; i += 1) {
      const sx = iso.x + (Math.random() - 0.5) * 30;
      const spark = this.add.circle(sx, iso.y + 4, 2.5, 0xfff1a8, 0.95).setDepth(58);
      this.tweens.add({ targets: spark, y: iso.y - 46 - Math.random() * 20, alpha: 0, duration: 520 + Math.random() * 200, ease: "Quad.Out", onComplete: () => spark.destroy() });
    }
  }

  // Sprint 130: screen-space golden radiance on the local player's level-up —
  // expanding ring + sunburst rays + drifting gold motes for a triumphant beat.
  private playSelfLevelUpFlash(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const ring = this.add.circle(cx, cy, 30).setStrokeStyle(4, 0xffe9a8, 0.9)
      .setScrollFactor(0).setDepth(99968).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 12, alpha: 0, duration: 620, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    for (let i = 0; i < 18; i += 1) {
      const ang = (Math.PI * 2 * i) / 18;
      const ray = this.add.rectangle(cx, cy, 60, 3, 0xffd98a, 0.7)
        .setOrigin(0, 0.5).setRotation(ang).setScrollFactor(0).setDepth(99967).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ray, scaleX: 4, alpha: 0, duration: 520, delay: 40, ease: "Quad.Out", onComplete: () => ray.destroy() });
      const mote = this.add.circle(cx, cy, 3, 0xfff3c4, 0.95).setScrollFactor(0).setDepth(99969).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: mote, x: cx + Math.cos(ang) * (160 + Math.random() * 80), y: cy + Math.sin(ang) * (120 + Math.random() * 60), alpha: 0, duration: 700 + Math.random() * 200, ease: "Quad.Out", onComplete: () => mote.destroy() });
    }
  }

  // Celebration burst (achievement unlock): gold stars arc up + ring.
  private playCelebration(x: number, y: number): void {
    const ring = this.add.circle(x, y, 8).setStrokeStyle(3, 0xffd166, 0.95).setDepth(99998);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 600, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    for (let i = 0; i < 14; i += 1) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const dist = 30 + Math.random() * 40;
      const star = this.add.star(x, y - 8, 5, 2, 4, i % 2 ? 0xffd166 : 0xfff1a8, 0.95).setDepth(99999);
      this.tweens.add({
        targets: star,
        x: x + Math.cos(ang) * dist,
        y: y - 8 + Math.sin(ang) * dist + 20,
        angle: 360,
        alpha: 0,
        duration: 700 + Math.random() * 300,
        ease: "Quad.Out",
        onComplete: () => star.destroy()
      });
    }
  }

  // Anime cast "charge" burst at the caster: a bright flash + ground ring +
  // converging energy motes. Played for every skill so casts feel weighty.
  private playCastBurst(position: { x: number; y: number }): void {
    const iso = worldToIso(position.x, position.y);
    const flash = this.add.circle(iso.x, iso.y - 6, 10, 0xffffff, 0.85).setDepth(58);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 200, ease: "Quad.Out", onComplete: () => flash.destroy() });
    const ground = this.add.ellipse(iso.x, iso.y + 6, 18, 9).setStrokeStyle(2, 0xcdb6ff, 0.9).setDepth(2);
    this.tweens.add({ targets: ground, scaleX: 3, scaleY: 3, alpha: 0, duration: 300, ease: "Cubic.Out", onComplete: () => ground.destroy() });
    // Converging motes spiral inward to the caster.
    for (let i = 0; i < 7; i += 1) {
      const ang = (Math.PI * 2 * i) / 7;
      const mote = this.add.circle(iso.x + Math.cos(ang) * 34, iso.y - 6 + Math.sin(ang) * 34, 3, 0xa8e6ff, 0.95).setDepth(59);
      this.tweens.add({ targets: mote, x: iso.x, y: iso.y - 6, alpha: 0.2, duration: 220, ease: "Quad.In", onComplete: () => mote.destroy() });
    }
  }

  private playHitEffect(entityId: string, position: { x: number; y: number }): void {
    // Project to iso since callers pass server-side world pixel coords.
    const iso = worldToIso(position.x, position.y);
    position = iso as { x: number; y: number };
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
      // Sprint 116: squash-and-stretch impact punch — the struck sprite briefly
      // compresses then springs back (classic anime hit feel).
      const bx = sprite.scaleX, by = sprite.scaleY;
      this.tweens.add({
        targets: sprite,
        scaleX: bx * 1.18,
        scaleY: by * 0.82,
        duration: 80,
        yoyo: true,
        ease: "Quad.Out",
        onComplete: () => sprite.setScale(bx, by)
      });
      if (entityId === this.selfId) {
        this.cameras.main.shake(110, 0.004);
        // Brief red damage flash at screen edges when the local player is hit.
        this.cameras.main.flash(120, 150, 20, 20, false);
      }
    }

    const cx = position.x;
    const cy = position.y - 8;
    // Anime "impact frame": a white core that pops and fades fast.
    const core = this.add.circle(cx, cy, 7, 0xffffff, 0.92).setDepth(60);
    this.tweens.add({ targets: core, scale: 2.6, alpha: 0, duration: 150, ease: "Quad.Out", onComplete: () => core.destroy() });
    // Shockwave ring.
    const ring = this.add.circle(cx, cy, 5).setStrokeStyle(2, 0xfff1a8, 0.95).setDepth(60);
    this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 240, ease: "Cubic.Out", onComplete: () => ring.destroy() });
    // Radiating spark shards (anime hit sparks).
    for (let i = 0; i < 6; i += 1) {
      const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
      const shard = this.add.rectangle(cx, cy, 7, 2, 0xffd166, 0.95).setDepth(61).setRotation(ang);
      this.tweens.add({
        targets: shard,
        x: cx + Math.cos(ang) * 28,
        y: cy + Math.sin(ang) * 28,
        alpha: 0,
        duration: 230,
        ease: "Quad.Out",
        onComplete: () => shard.destroy()
      });
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

type SkillElement = "fire" | "ice" | "lightning" | "shadow" | "holy" | "void" | "blood" | "physical";

function skillElement(skillId: SkillId): SkillElement {
  switch (skillId) {
    case "flameBurst": return "fire";
    case "icicleStorm": return "ice";
    case "thunderStrike": return "lightning";
    case "shadowAssault": return "shadow";
    case "divineLight": return "holy";
    case "voidNova": return "void";
    case "lifedrain": return "blood";
    default: return "physical";
  }
}

function skillTheme(skillId: SkillId): { core: number; rim: number; element: SkillElement } {
  const element = skillElement(skillId);
  switch (element) {
    case "fire": return { core: 0xff7a2a, rim: 0xffd166, element };
    case "ice": return { core: 0x7fd4ff, rim: 0xeaffff, element };
    case "lightning": return { core: 0xfff36b, rim: 0xffffff, element };
    case "shadow": return { core: 0x7a3fbf, rim: 0xc79bff, element };
    case "holy": return { core: 0xfff1a8, rim: 0xffffff, element };
    case "void": return { core: 0x8a4dff, rim: 0xff7ac6, element };
    case "blood": return { core: 0xff5d7a, rim: 0xffb0c1, element };
    default: return { core: 0xff9a3c, rim: 0xfff1a8, element };
  }
}

function rarityColor(rarity: "common" | "rare" | "epic"): number {
  if (rarity === "epic") return 0xd98cff;
  if (rarity === "rare") return 0x69a7ff;
  return 0xd6dddf;
}

// Blend two packed 0xRRGGBB colors; t=0 -> a, t=1 -> b.
function lerpColorHex(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

// Minimap palette per biome (RGB triplets).
function cosmeticSkinTint(cosmeticId: string): number | undefined {
  const c = COSMETICS.find((x) => x.id === cosmeticId && x.type === "skinTint");
  return c?.color;
}

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
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    // Only TEXT-entry inputs should swallow movement/hotkeys. A focused
    // checkbox/button/range (e.g. the "Tự chọn" auto-target toggle) must NOT
    // freeze the player — that was the "can't move after toggling" bug.
    const nonText = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);
    return !nonText.has(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}
