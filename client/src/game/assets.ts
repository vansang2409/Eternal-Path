// Pixel art generator. Tiles are baked into a single horizontal strip so a
// Phaser tilemap can address them by index. Tile index must match the
// TileId enum from shared (Grass=0, Road=1, Forest=2, ... Deep=11).
//
// The isometric renderer uses a second 64x32 atlas with four deterministic
// visual variants for each biome. Server TileId values remain unchanged.

import { TileId } from "@mmorpg/shared";
import { bakeClassTexture } from "./characterArt";
import { bakeMonsterTextures } from "./monsterArt";

const TILE_PX = 32;
const TILE_COUNT = 12;
const TILE_SHEET_WIDTH = TILE_PX * TILE_COUNT;
export const ISO_TILE_W = 64;
export const ISO_TILE_H = 32;
export const ISO_TILE_VARIANTS = 4;
const ISO_TILE_SHEET_WIDTH = ISO_TILE_W * TILE_COUNT * ISO_TILE_VARIANTS;

export function createPixelArt(scene: Phaser.Scene): void {
  // Default player (kept as fallback for legacy code paths).
  createTexture(scene, "player", [
    "..3333..",
    ".355553.",
    ".355553.",
    "..7777..",
    ".772277.",
    ".777777.",
    "..7..7..",
    ".77..77."
  ], palette());

  // ───── Class-specific anime hero sprites (see characterArt.ts) ─────
  // Sprint 304: high-resolution anime hero sprites, baked from vector painters
  // in characterArt.ts (60x84, big eyes + cel-shaded armor/robe + class weapon).
  bakeClassTexture(scene, "player-warrior", "warrior");
  bakeClassTexture(scene, "player-mage", "mage");
  bakeClassTexture(scene, "player-ranger", "ranger");
  bakeMonsterTextures(scene);

  createTexture(scene, "monster", [
    "..4444..",
    ".466664.",
    "44666644",
    "46622664",
    "46666664",
    ".444444.",
    "..4..4..",
    ".44..44."
  ], palette());

  createTexture(scene, "dead", [
    "........",
    "........",
    "..9999..",
    ".999999.",
    ".999999.",
    "..9999..",
    "........",
    "........"
  ], palette());

  createTexture(scene, "ground-item", [
    "........",
    "...88...",
    "..8888..",
    ".887788.",
    ".877778.",
    "..8888..",
    "...88...",
    "........"
  ], palette());

  // Treasure chest: a small wooden box with a gold lock.
  createTexture(scene, "chest", [
    "........",
    ".CCCCCC.",
    ".C8888C.",
    ".C8228C.",
    ".CCCCCC.",
    ".B8888B.",
    ".BBBBBB.",
    "........"
  ], { ...palette(), B: "#5b3a1e", C: "#8b5a2b" });

  // NPC sprites — distinct hat/robe colors per role.
  createTexture(scene, "npc-sage", [
    "..PPPP..",
    ".PWWWWP.",
    ".PW22WP.",
    ".PWWWWP.",
    ".VVVVVV.",
    ".VVVVVV.",
    "..V..V..",
    ".VV..VV."
  ], { P: "#6e4c9b", W: "#f1d0a2", "2": "#151515", V: "#3b2670" });

  createTexture(scene, "npc-merchant", [
    "..HHHH..",
    ".HWWWWH.",
    ".HW22WH.",
    ".HWWWWH.",
    ".GGGGGG.",
    ".GG88GG.",
    "..G..G..",
    ".GG..GG."
  ], { H: "#8b5a2b", W: "#f1d0a2", "2": "#151515", G: "#8a6a39", "8": "#e9c349" });

  createTexture(scene, "npc-guard", [
    "..SSSS..",
    ".SWWWWS.",
    ".SW22WS.",
    ".SWWWWS.",
    ".KKKKKK.",
    ".KKKKKK.",
    "..K..K..",
    ".KK..KK."
  ], { S: "#a0a0a3", W: "#f1d0a2", "2": "#151515", K: "#5b6266" });

  createTileSheet(scene);
  createIsoTiles(scene);
}

// Iso tile atlas: mỗi biome có bốn biến thể deterministic để mặt đất không
// lặp như giấy dán tường. Chỉ số server vẫn là TileId 0..11; client chuyển nó
// sang frame atlas bằng `isoTileIndex` và không thay đổi collision/gameplay.
function createIsoTiles(scene: Phaser.Scene): void {
  const palette: Record<number, { top: string; dither?: string; accent?: string; outline?: string }> = {
    [TileId.Grass]: { top: "#315f3c", dither: "#244a31", accent: "#5b8f52", outline: "#1d3b29" },
    [TileId.Road]: { top: "#76694f", dither: "#5b4f3b", accent: "#a18c65", outline: "#443b2d" },
    [TileId.Forest]: { top: "#213f2a", dither: "#172f20", accent: "#47764a", outline: "#112419" },
    [TileId.Water]: { top: "#225c78", dither: "#17445d", accent: "#62a9bd", outline: "#102f43" },
    [TileId.Sand]: { top: "#a88a55", dither: "#836a43", accent: "#d4b975", outline: "#665036" },
    [TileId.Snow]: { top: "#cbd7dc", dither: "#aabcc5", accent: "#f5f8f7", outline: "#839aa6" },
    [TileId.Swamp]: { top: "#33442a", dither: "#26351f", accent: "#637a46", outline: "#1d2918" },
    [TileId.Rock]: { top: "#575d61", dither: "#41464a", accent: "#82888a", outline: "#303438" },
    [TileId.DungeonFloor]: { top: "#292735", dither: "#1d1b27", accent: "#4b455c", outline: "#15131d" },
    [TileId.DungeonWall]: { top: "#171621", dither: "#0e0d15", accent: "#413653", outline: "#09080e" },
    [TileId.TownStone]: { top: "#706757", dither: "#554d42", accent: "#9b8e75", outline: "#40392f" },
    [TileId.Deep]: { top: "#25243d", dither: "#181726", accent: "#504a78", outline: "#100f1c" }
  };

  const canvas = scene.textures.createCanvas("iso-tiles", ISO_TILE_SHEET_WIDTH, ISO_TILE_H);
  if (!canvas) return;
  const ctx = canvas.getContext();

  for (let id = 0; id < TILE_COUNT; id += 1) {
    for (let variant = 0; variant < ISO_TILE_VARIANTS; variant += 1) {
      const frame = id * ISO_TILE_VARIANTS + variant;
      const ox = frame * ISO_TILE_W;
      const p = palette[id];
      const rng = seededRand(700 + id * 97 + variant * 1009);
      paintIsoDiamond(ctx, ox, p.top);

      ctx.save();
      clipIsoDiamond(ctx, ox);
      if (p.dither) {
        ctx.fillStyle = p.dither;
        for (let i = 0; i < 14 + variant * 2; i += 1) {
          ctx.fillRect(ox + Math.floor(rng() * ISO_TILE_W), Math.floor(rng() * ISO_TILE_H), 1 + (i % 4 === 0 ? 1 : 0), 1);
        }
      }
      if (p.accent) {
        ctx.fillStyle = p.accent;
        for (let i = 0; i < 5 + variant; i += 1) {
          ctx.fillRect(ox + Math.floor(rng() * ISO_TILE_W), Math.floor(rng() * ISO_TILE_H), 1, 1);
        }
      }
      paintIsoDecal(ctx, ox, id as TileId, variant, rng, p);
      ctx.restore();

      ctx.strokeStyle = p.outline ?? p.dither ?? "#111820";
      ctx.lineWidth = 1;
      traceIsoDiamond(ctx, ox);
      ctx.stroke();
    }
  }
  canvas.refresh();
}

function paintIsoDiamond(ctx: CanvasRenderingContext2D, ox: number, color: string): void {
  const half = ISO_TILE_H / 2;
  ctx.fillStyle = color;
  for (let y = 0; y < ISO_TILE_H; y += 1) {
    const dy = Math.abs(y - half + 0.5);
    const rowHalfWidth = (1 - dy / half) * (ISO_TILE_W / 2);
    const x0 = Math.floor(ISO_TILE_W / 2 - rowHalfWidth);
    const x1 = Math.ceil(ISO_TILE_W / 2 + rowHalfWidth);
    ctx.fillRect(ox + x0, y, x1 - x0, 1);
  }
}

function traceIsoDiamond(ctx: CanvasRenderingContext2D, ox: number): void {
  ctx.beginPath();
  ctx.moveTo(ox + ISO_TILE_W / 2, 0.5);
  ctx.lineTo(ox + ISO_TILE_W - 0.5, ISO_TILE_H / 2);
  ctx.lineTo(ox + ISO_TILE_W / 2, ISO_TILE_H - 0.5);
  ctx.lineTo(ox + 0.5, ISO_TILE_H / 2);
  ctx.closePath();
}

function clipIsoDiamond(ctx: CanvasRenderingContext2D, ox: number): void {
  traceIsoDiamond(ctx, ox);
  ctx.clip();
}

function paintIsoDecal(
  ctx: CanvasRenderingContext2D,
  ox: number,
  tile: TileId,
  variant: number,
  rng: () => number,
  colors: { top: string; dither?: string; accent?: string; outline?: string }
): void {
  const accent = colors.accent ?? "#ffffff";
  const dark = colors.outline ?? colors.dither ?? "#111111";
  ctx.lineWidth = 1;

  if (tile === TileId.Grass || tile === TileId.Forest) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = tile === TileId.Forest ? 0.42 : 0.58;
    for (let i = 0; i < 3 + variant; i += 1) {
      const x = ox + 15 + Math.floor(rng() * 34);
      const y = 10 + Math.floor(rng() * 13);
      ctx.beginPath();
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x - 1, y);
      ctx.moveTo(x, y + 3);
      ctx.lineTo(x + 2, y + 1);
      ctx.stroke();
    }
  } else if (tile === TileId.Water) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.58;
    for (let i = 0; i < 2 + (variant % 2); i += 1) {
      const x = ox + 14 + Math.floor(rng() * 25);
      const y = 10 + i * 6 + Math.floor(rng() * 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10 + Math.floor(rng() * 8), y);
      ctx.stroke();
    }
  } else if (tile === TileId.Sand) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.34;
    const y = 11 + variant * 3;
    ctx.beginPath();
    ctx.moveTo(ox + 19, y);
    ctx.quadraticCurveTo(ox + 31, y + 3, ox + 45, y);
    ctx.stroke();
  } else if (tile === TileId.Swamp) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.48;
    ctx.strokeRect(ox + 24 + variant * 3, 12 + (variant % 2) * 4, 3, 2);
    ctx.fillStyle = accent;
    ctx.fillRect(ox + 41 - variant * 2, 18, 2, 1);
  } else if (tile === TileId.Road || tile === TileId.TownStone || tile === TileId.DungeonFloor) {
    ctx.strokeStyle = dark;
    ctx.globalAlpha = tile === TileId.TownStone ? 0.62 : 0.48;
    const shift = variant * 4;
    ctx.beginPath();
    ctx.moveTo(ox + 8 + shift, 16);
    ctx.lineTo(ox + 56, 16);
    ctx.moveTo(ox + 24 + shift, 8);
    ctx.lineTo(ox + 30 + shift, 16);
    ctx.lineTo(ox + 25 + shift, 23);
    ctx.stroke();
  } else if (tile === TileId.Rock || tile === TileId.DungeonWall) {
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.72;
    const x = ox + 26 + variant * 3;
    ctx.beginPath();
    ctx.moveTo(x, 7);
    ctx.lineTo(x + 5, 14);
    ctx.lineTo(x + 1, 20);
    ctx.lineTo(x + 7, 25);
    ctx.stroke();
  } else if (tile === TileId.Snow) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.72;
    const x = ox + 25 + variant * 4;
    const y = 12 + (variant % 2) * 5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x, y + 3);
    ctx.stroke();
  } else if (tile === TileId.Deep) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.5;
    const x = ox + 28 + variant * 2;
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x + 4, 16);
    ctx.lineTo(x, 22);
    ctx.lineTo(x - 4, 16);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function isoTileIndex(tile: number, x: number, y: number): number {
  // Hash rẻ và deterministic: các client cùng nhìn một biến thể tại cùng ô.
  const hash = Math.imul(x + 17, 73856093) ^ Math.imul(y + 29, 19349663) ^ Math.imul(tile + 7, 83492791);
  return tile * ISO_TILE_VARIANTS + ((hash >>> 0) % ISO_TILE_VARIANTS);
}

export function buildIsoTileData(tiles: number[][]): number[][] {
  return tiles.map((row, y) => row.map((tile, x) => isoTileIndex(tile, x, y)));
}

function createTexture(scene: Phaser.Scene, key: string, pixels: string[], colors: Record<string, string>): void {
  const height = pixels.length;
  const width = Math.max(...pixels.map((row) => row.length));
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return;
  const ctx = canvas.getContext();
  for (let y = 0; y < pixels.length; y += 1) {
    for (let x = 0; x < pixels[y].length; x += 1) {
      const color = colors[pixels[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvas.refresh();
}

// ------- per-tile painters -------

type Ctx = CanvasRenderingContext2D;

// Deterministic pseudo-random per tile so the dithering looks the same
// across reloads (and matches the server's seeded world).
function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillBase(ctx: Ctx, x: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, 0, TILE_PX, TILE_PX);
}

function dither(ctx: Ctx, x: number, color: string, count: number, rng: () => number, w = 2, h = 1): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const dx = Math.floor(rng() * (TILE_PX - w));
    const dy = Math.floor(rng() * (TILE_PX - h));
    ctx.fillRect(x + dx, dy, w, h);
  }
}

function createTileSheet(scene: Phaser.Scene): void {
  const canvas = scene.textures.createCanvas("tiles", TILE_SHEET_WIDTH, TILE_PX);
  if (!canvas) return;
  const ctx = canvas.getContext();

  // Grass
  {
    const x = TileId.Grass * TILE_PX;
    const rng = seededRand(101);
    fillBase(ctx, x, "#2f6b3f");
    dither(ctx, x, "#4f9a4d", 28, rng);
    dither(ctx, x, "#6dba5d", 12, rng, 1, 2);
  }
  // Road
  {
    const x = TileId.Road * TILE_PX;
    const rng = seededRand(102);
    fillBase(ctx, x, "#9b865f");
    dither(ctx, x, "#7d6a47", 10, rng, 1, 1);
    dither(ctx, x, "#bba37b", 12, rng, 1, 1);
  }
  // Forest
  {
    const x = TileId.Forest * TILE_PX;
    const rng = seededRand(103);
    fillBase(ctx, x, "#1f4a2a");
    dither(ctx, x, "#326b3d", 20, rng, 2, 2);
    // tiny tree silhouettes
    for (let i = 0; i < 3; i += 1) {
      const tx = x + Math.floor(rng() * (TILE_PX - 6)) + 2;
      const ty = Math.floor(rng() * (TILE_PX - 8)) + 2;
      ctx.fillStyle = "#0f3119";
      ctx.fillRect(tx + 2, ty + 5, 2, 3);
      ctx.fillStyle = "#45843a";
      ctx.fillRect(tx, ty, 6, 5);
      ctx.fillStyle = "#2a5e26";
      ctx.fillRect(tx + 1, ty + 1, 4, 3);
    }
  }
  // Water
  {
    const x = TileId.Water * TILE_PX;
    const rng = seededRand(104);
    fillBase(ctx, x, "#23538a");
    for (let i = 0; i < 9; i += 1) {
      const dx = Math.floor(rng() * (TILE_PX - 6));
      const dy = Math.floor(rng() * TILE_PX);
      ctx.fillStyle = "#5fa6d1";
      ctx.fillRect(x + dx, dy, 6, 1);
    }
    dither(ctx, x, "#7fd2e8", 6, rng, 1, 1);
  }
  // Sand
  {
    const x = TileId.Sand * TILE_PX;
    const rng = seededRand(105);
    fillBase(ctx, x, "#d9c378");
    dither(ctx, x, "#c2a857", 14, rng, 1, 1);
    dither(ctx, x, "#efe1a2", 10, rng, 1, 1);
  }
  // Snow
  {
    const x = TileId.Snow * TILE_PX;
    const rng = seededRand(106);
    fillBase(ctx, x, "#e3ecf2");
    dither(ctx, x, "#c7d6e0", 14, rng, 1, 1);
    dither(ctx, x, "#ffffff", 10, rng, 1, 1);
  }
  // Swamp
  {
    const x = TileId.Swamp * TILE_PX;
    const rng = seededRand(107);
    fillBase(ctx, x, "#2f4326");
    dither(ctx, x, "#456033", 22, rng, 2, 1);
    // bubble blobs
    for (let i = 0; i < 4; i += 1) {
      const dx = Math.floor(rng() * (TILE_PX - 4));
      const dy = Math.floor(rng() * (TILE_PX - 4));
      ctx.fillStyle = "#5c7e3a";
      ctx.fillRect(x + dx, dy, 3, 3);
      ctx.fillStyle = "#7a9b58";
      ctx.fillRect(x + dx + 1, dy + 1, 1, 1);
    }
  }
  // Rock
  {
    const x = TileId.Rock * TILE_PX;
    const rng = seededRand(108);
    fillBase(ctx, x, "#6f6f73");
    dither(ctx, x, "#4d4d50", 20, rng, 2, 1);
    dither(ctx, x, "#a0a0a3", 10, rng, 1, 1);
    // dark crack lines
    ctx.strokeStyle = "#3a3a3d";
    ctx.beginPath();
    ctx.moveTo(x + 3, 4);
    ctx.lineTo(x + 12, 14);
    ctx.lineTo(x + 9, 26);
    ctx.stroke();
  }
  // DungeonFloor
  {
    const x = TileId.DungeonFloor * TILE_PX;
    const rng = seededRand(109);
    fillBase(ctx, x, "#3a3148");
    dither(ctx, x, "#28213a", 16, rng, 1, 1);
    dither(ctx, x, "#544870", 8, rng, 1, 1);
    // mortar lines
    ctx.strokeStyle = "#1e1830";
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x + TILE_PX, 16);
    ctx.moveTo(x + 16, 0);
    ctx.lineTo(x + 16, TILE_PX);
    ctx.stroke();
  }
  // DungeonWall
  {
    const x = TileId.DungeonWall * TILE_PX;
    fillBase(ctx, x, "#1a1426");
    ctx.fillStyle = "#0e0820";
    ctx.fillRect(x + 2, 2, TILE_PX - 4, TILE_PX - 4);
    ctx.strokeStyle = "#5b3f86";
    ctx.strokeRect(x + 4, 4, TILE_PX - 8, TILE_PX - 8);
  }
  // TownStone
  {
    const x = TileId.TownStone * TILE_PX;
    const rng = seededRand(111);
    fillBase(ctx, x, "#a18d6c");
    dither(ctx, x, "#85714f", 14, rng, 2, 1);
    dither(ctx, x, "#c4b186", 10, rng, 1, 1);
    // brick lines
    ctx.strokeStyle = "#5b4a30";
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x + TILE_PX, 10);
    ctx.moveTo(x, 22);
    ctx.lineTo(x + TILE_PX, 22);
    ctx.moveTo(x + 10, 0);
    ctx.lineTo(x + 10, 10);
    ctx.moveTo(x + 22, 10);
    ctx.lineTo(x + 22, 22);
    ctx.moveTo(x + 10, 22);
    ctx.lineTo(x + 10, TILE_PX);
    ctx.stroke();
  }
  // Deep
  {
    const x = TileId.Deep * TILE_PX;
    const rng = seededRand(112);
    fillBase(ctx, x, "#2b2947");
    dither(ctx, x, "#5c4fa3", 22, rng, 2, 1);
    ctx.strokeStyle = "#17142b";
    ctx.strokeRect(x, 0, TILE_PX, TILE_PX);
  }

  canvas.refresh();
}

function palette(): Record<string, string> {
  return {
    "2": "#151515",
    "3": "#5ea1ff",
    "4": "#558f3b",
    "5": "#f1d0a2",
    "6": "#8fd36b",
    "7": "#8a4fdd",
    "8": "#e9c349",
    "9": "#6f2634"
  };
}
