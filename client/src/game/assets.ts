// Pixel art generator. Tiles are baked into a single horizontal strip so a
// Phaser tilemap can address them by index. Tile index must match the
// TileId enum from shared (Grass=0, Road=1, Forest=2, ... Deep=11).

import { TileId } from "@mmorpg/shared";

const TILE_PX = 32;
const TILE_COUNT = 12;
const TILE_SHEET_WIDTH = TILE_PX * TILE_COUNT;

export function createPixelArt(scene: Phaser.Scene): void {
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
}

function createTexture(scene: Phaser.Scene, key: string, pixels: string[], colors: Record<string, string>): void {
  const canvas = scene.textures.createCanvas(key, 8, 8);
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
