import { MONSTER_DEFINITIONS, type MonsterDefinition } from "@mmorpg/shared";

// Procedural cel-shaded monster sprites (Sprint 305).
//
// Mỗi loại quái có một CanvasTexture riêng, nhưng dùng chung một bộ painter theo
// family. Toàn bộ chi tiết được quyết định từ hash của `type`, vì vậy texture
// luôn ổn định giữa các phiên chơi và không cần asset/dependency bên ngoài.

export const MONSTER_TEX_W = 64;
export const MONSTER_TEX_H = 72;
export const MONSTER_FEET_FRAC = 68 / MONSTER_TEX_H;
export const MONSTER_CENTER_FRAC = 0.5;

const CX = MONSTER_TEX_W / 2;
const FEET_Y = MONSTER_TEX_H * MONSTER_FEET_FRAC;
const OUTLINE = "#211823";

type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
type MonsterFamily =
  | "slime"
  | "beast"
  | "winged"
  | "humanoid"
  | "plant"
  | "construct"
  | "specter"
  | "reptile"
  | "knight"
  | "insect";

interface Palette {
  base: string;
  light: string;
  highlight: string;
  shadow: string;
  deep: string;
  accent: string;
  eye: string;
}

interface PaintInfo {
  definition: MonsterDefinition;
  type: string;
  seed: number;
  palette: Palette;
}

type MonsterPainter = (ctx: Ctx, info: PaintInfo) => void;

const FAMILY_BY_TYPE: Record<string, MonsterFamily> = {
  forestSlime: "slime",
  wildBoar: "beast",
  caveBat: "winged",
  goblinScout: "humanoid",
  direWolf: "beast",
  mossCrawler: "insect",
  stoneImp: "humanoid",
  emberSprite: "specter",
  cursedTreant: "plant",
  ashWraith: "specter",
  frostRevenant: "specter",
  crystalGolem: "construct",
  bloodHarpy: "winged",
  ancientDrake: "reptile",
  voidKnight: "knight",
  elderHydra: "reptile",
  eternalWarden: "knight",
  desertScarab: "insect",
  bogWitch: "humanoid",
  tundraYeti: "beast",
  crystalLich: "specter",
  sandStalker: "insect",
  frostWolfAlpha: "beast",
  bogLurker: "slime",
  crystalWatcher: "construct",
  thornBeast: "plant",
  magmaGolem: "construct",
  voidReaper: "specter",
  frostWraith: "specter",
  sandColossus: "construct",
  bloodFiend: "humanoid"
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rgb(color: number): [number, number, number] {
  return [(color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff];
}

function hex(channels: [number, number, number]): string {
  return `#${channels.map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: number, b: number, amount: number): number {
  const ac = rgb(a);
  const bc = rgb(b);
  return Number.parseInt(hex([
    ac[0] + (bc[0] - ac[0]) * amount,
    ac[1] + (bc[1] - ac[1]) * amount,
    ac[2] + (bc[2] - ac[2]) * amount
  ]).slice(1), 16);
}

function colorHex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

function hashType(type: string): number {
  let hash = 2166136261;
  for (let i = 0; i < type.length; i += 1) {
    hash ^= type.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Giá trị giả ngẫu nhiên ổn định trong khoảng 0..1, không dùng Math.random. */
function detail(seed: number, salt: number): number {
  let value = (seed + Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad);
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function paletteFor(tint: number, seed: number): Palette {
  const eyeChoices = [0xffd75e, 0x72efff, 0xff6b8b, 0xb9ff7a, 0xe8b0ff];
  const eyeColor = eyeChoices[seed % eyeChoices.length] ?? 0xffd75e;
  return {
    base: colorHex(tint),
    light: colorHex(mix(tint, 0xffffff, 0.3)),
    highlight: colorHex(mix(tint, 0xffffff, 0.62)),
    shadow: colorHex(mix(tint, 0x15131d, 0.35)),
    deep: colorHex(mix(tint, 0x15131d, 0.62)),
    accent: colorHex(mix(tint, eyeColor, 0.42)),
    eye: colorHex(eyeColor)
  };
}

function beginPolygon(ctx: Ctx, points: ReadonlyArray<readonly [number, number]>): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rotation = 0): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
  ctx.closePath();
}

function roundedRect(ctx: Ctx, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillStroke(ctx: Ctx, fillStyle: Paint, lineWidth = 1.7, strokeStyle = OUTLINE): void {
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

function stroke(ctx: Ctx, color = OUTLINE, width = 1.5): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function celGradient(ctx: Ctx, y0: number, y1: number, palette: Palette): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  gradient.addColorStop(0, palette.light);
  gradient.addColorStop(0.42, palette.base);
  gradient.addColorStop(0.7, palette.base);
  gradient.addColorStop(0.71, palette.shadow);
  gradient.addColorStop(1, palette.deep);
  return gradient;
}

function drawEye(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  pupilScale = 0.48
): void {
  ellipse(ctx, x, y, radius, radius * 1.18);
  fillStroke(ctx, "#f8fbff", 1.1);
  ellipse(ctx, x, y + radius * 0.12, radius * pupilScale, radius * 0.7);
  ctx.fillStyle = color;
  ctx.fill();
  ellipse(ctx, x, y + radius * 0.22, radius * 0.22, radius * 0.39);
  ctx.fillStyle = "#100f18";
  ctx.fill();
  ellipse(ctx, x - radius * 0.28, y - radius * 0.3, radius * 0.2, radius * 0.22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

function drawAngryEye(ctx: Ctx, x: number, y: number, flip: number, color: string): void {
  drawEye(ctx, x, y, 2.5, color, 0.55);
  ctx.beginPath();
  ctx.moveTo(x - 3 * flip, y - 3.5);
  ctx.lineTo(x + 2.8 * flip, y - 1.8);
  stroke(ctx, OUTLINE, 1.45);
}

function drawClaw(ctx: Ctx, x: number, y: number, flip: number, color: string): void {
  beginPolygon(ctx, [[x, y], [x + 3.4 * flip, y + 0.8], [x + 0.7 * flip, y + 2.5]]);
  fillStroke(ctx, color, 0.9);
}

function drawGroundContact(ctx: Ctx, width: number): void {
  // Một nét tối cực mỏng giúp chân/root đọc rõ trên nền map sáng, nhưng vẫn
  // giữ phần bóng mềm ở GameScene độc lập với texture.
  ctx.save();
  ctx.globalAlpha = 0.26;
  ellipse(ctx, CX, FEET_Y + 0.6, width / 2, 1.7);
  ctx.fillStyle = "#08070c";
  ctx.fill();
  ctx.restore();
}

function drawSpots(ctx: Ctx, info: PaintInfo, count: number, area: { x: number; y: number; w: number; h: number }): void {
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (let i = 0; i < count; i += 1) {
    const x = area.x + detail(info.seed, i * 2 + 11) * area.w;
    const y = area.y + detail(info.seed, i * 2 + 12) * area.h;
    const radius = 0.8 + detail(info.seed, i + 31) * 1.35;
    ellipse(ctx, x, y, radius, radius * 0.72, detail(info.seed, i + 52));
    ctx.fillStyle = i % 2 === 0 ? info.palette.highlight : info.palette.deep;
    ctx.fill();
  }
  ctx.restore();
}

function paintSlime(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isBog = info.type.includes("bog");
  drawGroundContact(ctx, 39);

  // Các chân giả nhỏ khiến silhouette không còn là một hình tròn đơn thuần.
  for (const side of [-1, 1]) {
    ellipse(ctx, CX + side * 13, 63, 7.5, 4.3, side * 0.12);
    fillStroke(ctx, p.shadow, 1.55);
  }
  ctx.beginPath();
  ctx.moveTo(11, 62);
  ctx.quadraticCurveTo(8, 50, 14, 39);
  ctx.quadraticCurveTo(18, 29, 25, 33);
  ctx.quadraticCurveTo(31, 22, 38, 33);
  ctx.quadraticCurveTo(48, 29, 51, 42);
  ctx.quadraticCurveTo(58, 51, 52, 62);
  ctx.quadraticCurveTo(44, 69, 34, 65);
  ctx.quadraticCurveTo(26, 70, 17, 65);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, 26, 68, p), 2.1);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.moveTo(18, 43);
  ctx.quadraticCurveTo(24, 31, 33, 31);
  ctx.quadraticCurveTo(27, 36, 24, 47);
  ctx.quadraticCurveTo(20, 49, 18, 43);
  ctx.closePath();
  ctx.fillStyle = p.highlight;
  ctx.fill();
  ctx.restore();

  if (isBog) {
    // Mầm đầm lầy / xúc tu rủ là dấu hiệu riêng của Bog Lurker.
    ctx.beginPath();
    ctx.moveTo(25, 33);
    ctx.quadraticCurveTo(19, 22, 13, 26);
    ctx.quadraticCurveTo(20, 27, 22, 36);
    stroke(ctx, p.deep, 2.1);
    ellipse(ctx, 12, 25, 4, 2.3, -0.3);
    fillStroke(ctx, p.accent, 1.1);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(CX + side * 11, 61);
      ctx.quadraticCurveTo(CX + side * 17, 67, CX + side * 21, 63);
      stroke(ctx, p.deep, 2.2);
    }
  } else {
    // Lá nhỏ tạo identity "forest" mà không cần icon hay text.
    beginPolygon(ctx, [[29, 31], [25, 23], [32, 25], [37, 20], [37, 30]]);
    fillStroke(ctx, p.accent, 1.3);
    ctx.beginPath();
    ctx.moveTo(29, 29);
    ctx.lineTo(36, 23);
    stroke(ctx, p.deep, 0.9);
  }

  drawEye(ctx, 26, 48, 3.5, p.eye);
  drawEye(ctx, 39, 47, 3.5, p.eye);
  ctx.beginPath();
  ctx.moveTo(29, 56);
  ctx.quadraticCurveTo(33, 59, 37, 55.5);
  stroke(ctx, p.deep, 1.35);
  drawSpots(ctx, info, isBog ? 5 : 3, { x: 17, y: 51, w: 31, h: 11 });
}

function paintBeast(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isWolf = info.type.includes("Wolf") || info.type.includes("wolf");
  const isYeti = info.type.includes("Yeti");
  const isBoar = info.type.includes("Boar");
  drawGroundContact(ctx, isYeti ? 38 : 48);

  if (isYeti) {
    // Yeti vẫn dùng family beast nhưng có dáng ape/biped rất rộng.
    for (const side of [-1, 1]) {
      roundedRect(ctx, CX + side * 11 - 5, 51, 10, 17, 4);
      fillStroke(ctx, celGradient(ctx, 51, 68, p), 1.8);
      ellipse(ctx, CX + side * 17, 49, 7, 16, side * -0.3);
      fillStroke(ctx, p.shadow, 1.8);
      drawClaw(ctx, CX + side * 21, 61, side, p.highlight);
    }
    ellipse(ctx, CX, 45, 17, 20);
    fillStroke(ctx, celGradient(ctx, 25, 66, p), 2.2);
    ellipse(ctx, CX, 38, 10, 9);
    fillStroke(ctx, p.light, 1.4);
    drawAngryEye(ctx, 28, 37, -1, p.eye);
    drawAngryEye(ctx, 36, 37, 1, p.eye);
    ellipse(ctx, CX, 44, 4, 2.6);
    fillStroke(ctx, p.deep, 1);
    for (const side of [-1, 1]) {
      beginPolygon(ctx, [[CX + side * 9, 29], [CX + side * 13, 20], [CX + side * 4, 27]]);
      fillStroke(ctx, p.highlight, 1.25);
    }
    drawSpots(ctx, info, 5, { x: 19, y: 48, w: 26, h: 14 });
    return;
  }

  // Tail is behind the body.
  ctx.beginPath();
  ctx.moveTo(15, 46);
  ctx.quadraticCurveTo(isWolf ? 3 : 6, isWolf ? 35 : 43, 8, isWolf ? 28 : 50);
  ctx.quadraticCurveTo(10, 40, 18, 51);
  fillStroke(ctx, isWolf ? p.light : p.shadow, 2);

  for (const x of [21, 40]) {
    roundedRect(ctx, x - 3.5, 51, 7, 16, 2.8);
    fillStroke(ctx, celGradient(ctx, 51, 68, p), 1.55);
    for (const side of [-1, 1]) drawClaw(ctx, x + side * 1.2, 66, side, p.highlight);
  }

  ellipse(ctx, 30, 47, 20, 13, -0.04);
  fillStroke(ctx, celGradient(ctx, 34, 62, p), 2);
  ctx.beginPath();
  ctx.moveTo(15, 42);
  ctx.quadraticCurveTo(24, 36, 34, 39);
  stroke(ctx, p.highlight, 2.1);

  // Head and muzzle point right; GameScene flipX handles movement direction.
  ctx.beginPath();
  ctx.moveTo(40, 42);
  ctx.quadraticCurveTo(42, 29, 52, 30);
  ctx.quadraticCurveTo(60, 34, 56, 45);
  ctx.quadraticCurveTo(52, 52, 42, 48);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, 29, 51, p), 2);

  beginPolygon(ctx, isWolf
    ? [[43, 33], [43, 21], [50, 30]]
    : [[43, 34], [47, 25], [51, 33]]);
  fillStroke(ctx, p.shadow, 1.5);
  beginPolygon(ctx, isWolf
    ? [[50, 30], [56, 22], [55, 35]]
    : [[51, 32], [57, 27], [56, 38]]);
  fillStroke(ctx, p.light, 1.5);

  ellipse(ctx, isWolf ? 55 : 54, 42, isWolf ? 7 : 8, isWolf ? 4 : 5);
  fillStroke(ctx, p.light, 1.25);
  ellipse(ctx, 59, 41, 2.1, 1.8);
  ctx.fillStyle = p.deep;
  ctx.fill();
  drawAngryEye(ctx, 50, 36, 1, p.eye);

  if (isBoar) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(57, 44 + side * 1.5);
      ctx.quadraticCurveTo(61, 47 + side * 2, 61.5, 42 + side * 1.5);
      stroke(ctx, p.highlight, 1.8);
    }
  } else {
    beginPolygon(ctx, [[42, 39], [35, 30], [38, 43]]);
    fillStroke(ctx, p.accent, 1.15);
  }

  drawSpots(ctx, info, 4 + (info.seed % 3), { x: 14, y: 40, w: 28, h: 14 });
}

function paintWinged(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isHarpy = info.type.includes("Harpy");
  drawGroundContact(ctx, 24);

  // Wings occupy almost the full canvas width and make this family readable
  // even at normal monster scale.
  for (const side of [-1, 1]) {
    const sx = side;
    ctx.beginPath();
    ctx.moveTo(CX + sx * 6, 40);
    ctx.quadraticCurveTo(CX + sx * 19, 20, CX + sx * 30, 28);
    ctx.lineTo(CX + sx * 23, 39);
    ctx.lineTo(CX + sx * 29, 44);
    ctx.lineTo(CX + sx * 18, 46);
    ctx.lineTo(CX + sx * 20, 55);
    ctx.quadraticCurveTo(CX + sx * 9, 48, CX + sx * 5, 44);
    ctx.closePath();
    fillStroke(ctx, celGradient(ctx, 23, 55, p), 1.85);
    ctx.beginPath();
    ctx.moveTo(CX + sx * 7, 41);
    ctx.lineTo(CX + sx * 24, 30);
    ctx.moveTo(CX + sx * 9, 43);
    ctx.lineTo(CX + sx * 23, 42);
    ctx.moveTo(CX + sx * 8, 45);
    ctx.lineTo(CX + sx * 18, 51);
    stroke(ctx, p.deep, 1);
  }

  if (isHarpy) {
    // Feathered lower body and talons.
    for (const side of [-1, 1]) {
      roundedRect(ctx, CX + side * 5 - 2, 52, 4, 13, 2);
      fillStroke(ctx, p.shadow, 1.2);
      for (let claw = -1; claw <= 1; claw += 1) {
        drawClaw(ctx, CX + side * 5 + claw * 1.3, 64, claw === 0 ? side : claw, p.highlight);
      }
    }
    beginPolygon(ctx, [[23, 43], [41, 43], [39, 60], [35, 56], [32, 63], [29, 56], [25, 60]]);
    fillStroke(ctx, celGradient(ctx, 42, 62, p), 1.8);
    ellipse(ctx, CX, 34, 9, 10);
    fillStroke(ctx, p.light, 1.7);
    beginPolygon(ctx, [[27, 29], [24, 21], [31, 25], [34, 19], [36, 27]]);
    fillStroke(ctx, p.accent, 1.25);
    beginPolygon(ctx, [[39, 35], [46, 38], [39, 40]]);
    fillStroke(ctx, p.highlight, 1.1);
    drawAngryEye(ctx, 35, 33, 1, p.eye);
  } else {
    // Cave bat: compact fur body, huge ears, feet hook.
    ellipse(ctx, CX, 45, 9, 16);
    fillStroke(ctx, celGradient(ctx, 29, 62, p), 1.9);
    ellipse(ctx, CX, 34, 10, 9);
    fillStroke(ctx, p.light, 1.7);
    beginPolygon(ctx, [[24, 30], [23, 17], [31, 28]]);
    fillStroke(ctx, p.shadow, 1.45);
    beginPolygon(ctx, [[34, 28], [42, 17], [40, 32]]);
    fillStroke(ctx, p.shadow, 1.45);
    drawAngryEye(ctx, 28, 34, -1, p.eye);
    drawAngryEye(ctx, 36, 34, 1, p.eye);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(CX + side * 4, 58);
      ctx.quadraticCurveTo(CX + side * 7, 68, CX + side * 11, 64);
      stroke(ctx, p.deep, 1.8);
    }
  }
}

function paintHumanoid(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isWitch = info.type.includes("Witch");
  const isImp = info.type.includes("Imp");
  const isFiend = info.type.includes("Fiend");
  drawGroundContact(ctx, 31);

  // Weapon/staff behind the body.
  if (isWitch) {
    roundedRect(ctx, 47, 26, 3, 40, 1.5);
    fillStroke(ctx, p.deep, 1.1);
    ellipse(ctx, 48.5, 23, 5.2, 5.2);
    fillStroke(ctx, p.eye, 1.3);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ellipse(ctx, 48.5, 23, 8, 8);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(48, 45);
    ctx.rotate(isFiend ? 0.22 : -0.18);
    roundedRect(ctx, -1.5, -9, 3, 25, 1.3);
    fillStroke(ctx, p.deep, 1);
    beginPolygon(ctx, [[0, -16], [4, -8], [0, -10], [-4, -8]]);
    fillStroke(ctx, p.highlight, 1.1);
    ctx.restore();
  }

  for (const side of [-1, 1]) {
    roundedRect(ctx, CX + side * 6 - 3.5, 51, 7, 17, 2.5);
    fillStroke(ctx, celGradient(ctx, 51, 68, p), 1.5);
    roundedRect(ctx, CX + side * 7 - 4.5, 63, 9, 5, 2.2);
    fillStroke(ctx, p.deep, 1.25);
  }

  ctx.beginPath();
  ctx.moveTo(22, 37);
  ctx.quadraticCurveTo(32, 31, 42, 37);
  ctx.lineTo(45, 57);
  ctx.quadraticCurveTo(32, 63, 19, 57);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, 33, 61, p), 1.9);

  // Belt/insignia separates head and body at tiny display sizes.
  roundedRect(ctx, 20, 52, 25, 4, 1.5);
  fillStroke(ctx, p.deep, 1);
  ellipse(ctx, CX, 54, 2.6, 2.6);
  fillStroke(ctx, p.accent, 0.9);

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + side * 10, 39);
    ctx.quadraticCurveTo(CX + side * 18, 43, CX + side * 16, 57);
    stroke(ctx, p.shadow, isFiend ? 5 : 4.5);
    if (isFiend) drawClaw(ctx, CX + side * 17, 58, side, p.highlight);
    else {
      ellipse(ctx, CX + side * 16, 57, 3, 3);
      fillStroke(ctx, p.light, 1);
    }
  }

  ellipse(ctx, CX, 28, isFiend ? 10 : 9, 10);
  fillStroke(ctx, celGradient(ctx, 18, 39, p), 1.85);

  // Pointed ears are shared by goblin/imp; horns and hat specialize variants.
  for (const side of [-1, 1]) {
    beginPolygon(ctx, [[CX + side * 8, 27], [CX + side * 16, 23], [CX + side * 9, 33]]);
    fillStroke(ctx, p.light, 1.25);
  }

  if (isWitch) {
    ctx.beginPath();
    ctx.moveTo(20, 21);
    ctx.quadraticCurveTo(29, 17, 31, 4);
    ctx.quadraticCurveTo(39, 10, 42, 23);
    ctx.closePath();
    fillStroke(ctx, p.deep, 1.8);
    roundedRect(ctx, 17, 20, 29, 4, 2);
    fillStroke(ctx, p.accent, 1.15);
  } else if (isImp || isFiend) {
    for (const side of [-1, 1]) {
      beginPolygon(ctx, [
        [CX + side * 5, 20],
        [CX + side * (isFiend ? 12 : 9), isFiend ? 7 : 11],
        [CX + side * 10, 24]
      ]);
      fillStroke(ctx, p.deep, 1.3);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(23, 24);
    ctx.quadraticCurveTo(31, 15, 41, 22);
    ctx.lineTo(39, 27);
    ctx.quadraticCurveTo(31, 22, 24, 29);
    ctx.closePath();
    fillStroke(ctx, p.deep, 1.3);
  }

  drawAngryEye(ctx, 28, 29, -1, p.eye);
  drawAngryEye(ctx, 36, 29, 1, p.eye);
  beginPolygon(ctx, [[32, 31], [29.5, 35], [34.5, 35]]);
  fillStroke(ctx, p.shadow, 0.8);
  if (isFiend) {
    for (const side of [-1, 1]) {
      beginPolygon(ctx, [[CX + side * 3, 37], [CX + side * 6, 42], [CX + side * 1, 39]]);
      ctx.fillStyle = "#f5efe4";
      ctx.fill();
    }
  }
}

function paintPlant(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isThornBeast = info.type.includes("thorn") || info.type.includes("Thorn");
  drawGroundContact(ctx, isThornBeast ? 48 : 43);

  if (isThornBeast) {
    // Thorn Beast is a low, charging shrub rather than a second treant.
    for (const x of [18, 42]) {
      ctx.beginPath();
      ctx.moveTo(x - 4, 51);
      ctx.lineTo(x - 5, 67);
      ctx.lineTo(x + 4, 67);
      ctx.lineTo(x + 5, 51);
      ctx.closePath();
      fillStroke(ctx, p.deep, 1.5);
    }
    ctx.beginPath();
    ctx.moveTo(10, 54);
    ctx.quadraticCurveTo(15, 34, 33, 36);
    ctx.quadraticCurveTo(50, 34, 55, 48);
    ctx.quadraticCurveTo(53, 60, 35, 61);
    ctx.quadraticCurveTo(19, 63, 10, 54);
    ctx.closePath();
    fillStroke(ctx, celGradient(ctx, 34, 63, p), 2);
    for (let i = 0; i < 7; i += 1) {
      const x = 15 + i * 5.8;
      const height = 6 + detail(info.seed, i + 80) * 8;
      beginPolygon(ctx, [[x - 2.5, 39], [x, 39 - height], [x + 2.5, 39]]);
      fillStroke(ctx, i % 2 ? p.accent : p.light, 1.1);
    }
    beginPolygon(ctx, [[49, 43], [61, 38], [54, 49]]);
    fillStroke(ctx, p.highlight, 1.4);
    drawAngryEye(ctx, 45, 48, 1, p.eye);
    drawSpots(ctx, info, 5, { x: 15, y: 44, w: 33, h: 12 });
    return;
  }

  // Cursed treant: branch arms, hollow face, roots at the feet.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + side * 10, 41);
    ctx.lineTo(CX + side * 23, 31);
    ctx.lineTo(CX + side * 29, 20);
    ctx.moveTo(CX + side * 21, 33);
    ctx.lineTo(CX + side * 29, 35);
    ctx.moveTo(CX + side * 24, 29);
    ctx.lineTo(CX + side * 22, 20);
    stroke(ctx, p.deep, 5);
  }
  ctx.beginPath();
  ctx.moveTo(23, 28);
  ctx.quadraticCurveTo(19, 45, 22, 58);
  ctx.lineTo(15, 67);
  ctx.lineTo(28, 64);
  ctx.lineTo(32, 68);
  ctx.lineTo(36, 64);
  ctx.lineTo(50, 67);
  ctx.lineTo(42, 57);
  ctx.quadraticCurveTo(45, 41, 40, 28);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, 25, 68, p), 2.1);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + side * 5, 31);
    ctx.quadraticCurveTo(CX + side * 8, 45, CX + side * 5, 60);
    stroke(ctx, side > 0 ? p.deep : p.light, 1.6);
  }

  // Leaf crown.
  for (let i = 0; i < 9; i += 1) {
    const angle = -Math.PI + (i / 8) * Math.PI;
    const x = CX + Math.cos(angle) * (12 + (i % 2) * 3);
    const y = 28 + Math.sin(angle) * 10;
    ellipse(ctx, x, y, 6, 3.5, angle + 0.4);
    fillStroke(ctx, i % 3 === 0 ? p.accent : p.base, 1.05);
  }
  drawAngryEye(ctx, 27, 43, -1, p.eye);
  drawAngryEye(ctx, 37, 43, 1, p.eye);
  ctx.beginPath();
  ctx.moveTo(29, 51);
  ctx.lineTo(35, 51);
  stroke(ctx, p.deep, 2);
}

function drawFacet(ctx: Ctx, points: ReadonlyArray<readonly [number, number]>, fillColor: Paint, width = 1.35): void {
  beginPolygon(ctx, points);
  fillStroke(ctx, fillColor, width);
}

function paintConstruct(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isWatcher = info.type.includes("Watcher");
  const isMagma = info.type.includes("Magma");
  const isCrystal = info.type.includes("Crystal");
  drawGroundContact(ctx, isWatcher ? 37 : 45);

  if (isWatcher) {
    // Floating single-eye crystal with three articulated legs.
    for (const side of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(CX + side * 8, 49);
      ctx.lineTo(CX + side * 13, 62);
      ctx.lineTo(CX + side * 16, 67);
      stroke(ctx, p.deep, 3.2);
      drawClaw(ctx, CX + side * 16, 66, side || 1, p.highlight);
    }
    drawFacet(ctx, [[32, 16], [47, 29], [44, 49], [32, 59], [18, 48], [17, 29]], celGradient(ctx, 16, 59, p), 2);
    drawFacet(ctx, [[32, 16], [32, 58], [18, 48], [17, 29]], p.shadow, 1);
    ellipse(ctx, CX, 36, 9, 8);
    fillStroke(ctx, p.deep, 1.8);
    drawEye(ctx, CX, 35, 5.4, p.eye, 0.58);
    for (const side of [-1, 1]) {
      drawFacet(ctx, [[CX + side * 8, 25], [CX + side * 17, 17], [CX + side * 14, 31]], p.accent, 1.1);
    }
    return;
  }

  // Blocky limbs are painted behind the faceted core.
  for (const side of [-1, 1]) {
    drawFacet(ctx, [
      [CX + side * 10, 38],
      [CX + side * 20, 35],
      [CX + side * 25, 51],
      [CX + side * 18, 58],
      [CX + side * 10, 51]
    ], side > 0 ? p.shadow : p.base, 1.8);
    drawFacet(ctx, [
      [CX + side * 4, 52],
      [CX + side * 13, 52],
      [CX + side * 15, 68],
      [CX + side * 3, 68]
    ], p.shadow, 1.7);
  }

  drawFacet(ctx, [[20, 28], [32, 20], [45, 29], [43, 53], [32, 61], [19, 52]], celGradient(ctx, 20, 61, p), 2.15);
  drawFacet(ctx, [[20, 28], [32, 34], [32, 60], [19, 52]], p.shadow, 1.05);
  drawFacet(ctx, [[32, 20], [45, 29], [32, 34], [20, 28]], p.light, 1.05);

  // Cracks glow for magma, cool facets for crystal, dark seams for sand.
  const seam = isMagma ? "#ffe36e" : isCrystal ? p.highlight : p.deep;
  ctx.beginPath();
  ctx.moveTo(31, 34);
  ctx.lineTo(27, 42);
  ctx.lineTo(32, 46);
  ctx.lineTo(29, 54);
  ctx.moveTo(34, 35);
  ctx.lineTo(39, 42);
  ctx.lineTo(36, 49);
  stroke(ctx, seam, isMagma ? 2 : 1.45);
  for (const side of [-1, 1]) drawAngryEye(ctx, CX + side * 5, 36, side, p.eye);

  if (isCrystal) {
    for (const side of [-1, 1]) {
      drawFacet(ctx, [[CX + side * 7, 24], [CX + side * 12, 10], [CX + side * 15, 29]], p.accent, 1.25);
    }
  } else if (isMagma) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ellipse(ctx, CX, 47, 4.5, 4.5);
    ctx.fillStyle = "#ffcf58";
    ctx.fill();
    ctx.restore();
  }
}

function paintSpecter(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isEmber = info.type.includes("Ember");
  const isLich = info.type.includes("Lich");
  const isReaper = info.type.includes("Reaper");
  const isRevenant = info.type.includes("Revenant");

  if (isEmber) {
    // Sprite lửa nhỏ có silhouette giọt lửa nhiều chóp.
    ctx.beginPath();
    ctx.moveTo(CX, 11);
    ctx.quadraticCurveTo(40, 23, 36, 34);
    ctx.quadraticCurveTo(48, 42, 41, 55);
    ctx.quadraticCurveTo(36, 64, 28, 58);
    ctx.quadraticCurveTo(16, 53, 23, 42);
    ctx.quadraticCurveTo(17, 29, 29, 24);
    ctx.quadraticCurveTo(27, 17, CX, 11);
    ctx.closePath();
    fillStroke(ctx, celGradient(ctx, 11, 62, p), 2);
    ctx.beginPath();
    ctx.moveTo(31, 26);
    ctx.quadraticCurveTo(38, 37, 32, 49);
    ctx.quadraticCurveTo(24, 45, 28, 36);
    ctx.closePath();
    ctx.fillStyle = p.highlight;
    ctx.fill();
    drawEye(ctx, 28, 42, 2.8, p.eye);
    drawEye(ctx, 36, 42, 2.8, p.eye);
    return;
  }

  // Arms/robes behind hood.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + side * 9, 39);
    ctx.quadraticCurveTo(CX + side * 20, 41, CX + side * 24, 56);
    ctx.lineTo(CX + side * 16, 52);
    ctx.lineTo(CX + side * 10, 58);
    ctx.closePath();
    fillStroke(ctx, p.shadow, 1.6);
  }

  ctx.beginPath();
  ctx.moveTo(22, 34);
  ctx.quadraticCurveTo(32, 27, 42, 34);
  ctx.quadraticCurveTo(48, 48, 44, 61);
  ctx.lineTo(39, 56);
  ctx.lineTo(35, 67);
  ctx.lineTo(30, 59);
  ctx.lineTo(24, 66);
  ctx.lineTo(22, 57);
  ctx.lineTo(17, 61);
  ctx.quadraticCurveTo(17, 46, 22, 34);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, 29, 67, p), 2);

  // Deep hood makes the glowing eyes legible over every palette.
  ctx.beginPath();
  ctx.moveTo(21, 35);
  ctx.quadraticCurveTo(21, 18, 32, 15);
  ctx.quadraticCurveTo(44, 18, 43, 35);
  ctx.quadraticCurveTo(37, 44, 32, 43);
  ctx.quadraticCurveTo(26, 44, 21, 35);
  ctx.closePath();
  fillStroke(ctx, p.deep, 1.9);
  drawAngryEye(ctx, 28, 33, -1, p.eye);
  drawAngryEye(ctx, 36, 33, 1, p.eye);

  if (isLich || isRevenant) {
    // Crown/ice crest.
    beginPolygon(ctx, [[22, 21], [23, 10], [29, 17], [32, 7], [36, 17], [42, 10], [42, 23]]);
    fillStroke(ctx, p.accent, 1.5);
    ellipse(ctx, CX, 21, 2.3, 2.3);
    ctx.fillStyle = p.eye;
    ctx.fill();
  }

  if (isReaper) {
    // Scythe silhouette on the right edge.
    ctx.beginPath();
    ctx.moveTo(49, 61);
    ctx.lineTo(53, 22);
    stroke(ctx, p.highlight, 2.2);
    ctx.beginPath();
    ctx.moveTo(52, 23);
    ctx.quadraticCurveTo(59, 15, 62, 24);
    ctx.quadraticCurveTo(57, 21, 52, 31);
    ctx.closePath();
    fillStroke(ctx, p.accent, 1.2);
  } else {
    // Wisps orbit all other wraiths.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(CX + side * 18, 43);
      ctx.quadraticCurveTo(CX + side * 27, 34, CX + side * 24, 26);
      stroke(ctx, p.accent, 1.25);
      ellipse(ctx, CX + side * 24, 24, 2.3, 3.2);
      ctx.fillStyle = p.highlight;
      ctx.fill();
    }
  }
}

function drawReptileHead(ctx: Ctx, x: number, y: number, flip: number, info: PaintInfo, scale = 1): void {
  const p = info.palette;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * scale, scale);
  ctx.beginPath();
  ctx.moveTo(-7, 3);
  ctx.quadraticCurveTo(-6, -7, 2, -8);
  ctx.lineTo(10, -3);
  ctx.lineTo(8, 5);
  ctx.quadraticCurveTo(0, 10, -7, 3);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, -8, 9, p), 1.7 / scale);
  beginPolygon(ctx, [[-4, -6], [-2, -13], [2, -7]]);
  fillStroke(ctx, p.accent, 1.05 / scale);
  drawAngryEye(ctx, 2, -3, 1, p.eye);
  ellipse(ctx, 8, 1, 1, 0.8);
  ctx.fillStyle = p.deep;
  ctx.fill();
  ctx.restore();
}

function paintReptile(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isHydra = info.type.includes("Hydra");
  drawGroundContact(ctx, isHydra ? 49 : 54);

  if (isHydra) {
    // Three independent neck curves are readable immediately as Hydra.
    const necks = [
      { x: 19, y: 25, flip: -1, bend: -7 },
      { x: 32, y: 18, flip: 1, bend: 0 },
      { x: 46, y: 27, flip: 1, bend: 8 }
    ];
    for (const [index, neck] of necks.entries()) {
      ctx.beginPath();
      ctx.moveTo(CX + (index - 1) * 7, 55);
      ctx.quadraticCurveTo(neck.x + neck.bend, 38, neck.x, neck.y + 5);
      stroke(ctx, index === 1 ? p.base : p.shadow, 8);
      drawReptileHead(ctx, neck.x, neck.y, neck.flip, info, index === 1 ? 0.9 : 0.82);
    }
    ellipse(ctx, CX, 56, 20, 11);
    fillStroke(ctx, celGradient(ctx, 44, 67, p), 2);
    ctx.beginPath();
    ctx.moveTo(16, 57);
    ctx.quadraticCurveTo(4, 52, 4, 63);
    ctx.quadraticCurveTo(13, 59, 22, 62);
    fillStroke(ctx, p.shadow, 1.6);
    drawSpots(ctx, info, 6, { x: 17, y: 50, w: 31, h: 11 });
    return;
  }

  // Drake: long tail + dorsal wing + side-facing head.
  ctx.beginPath();
  ctx.moveTo(18, 51);
  ctx.quadraticCurveTo(4, 46, 3, 61);
  ctx.quadraticCurveTo(12, 55, 25, 59);
  fillStroke(ctx, p.shadow, 1.8);
  for (const x of [24, 42]) {
    roundedRect(ctx, x - 3.5, 52, 7, 15, 2.5);
    fillStroke(ctx, p.shadow, 1.45);
    drawClaw(ctx, x + 1, 66, 1, p.highlight);
  }
  ellipse(ctx, 31, 50, 20, 12, 0.05);
  fillStroke(ctx, celGradient(ctx, 37, 63, p), 2);
  ctx.beginPath();
  ctx.moveTo(27, 44);
  ctx.quadraticCurveTo(22, 27, 10, 29);
  ctx.lineTo(18, 46);
  ctx.closePath();
  fillStroke(ctx, p.accent, 1.65);
  ctx.beginPath();
  ctx.moveTo(22, 44);
  ctx.lineTo(15, 31);
  ctx.lineTo(19, 45);
  stroke(ctx, p.deep, 1);
  ctx.beginPath();
  ctx.moveTo(40, 45);
  ctx.quadraticCurveTo(43, 35, 49, 33);
  stroke(ctx, p.base, 7);
  drawReptileHead(ctx, 51, 31, 1, info);
  drawSpots(ctx, info, 5, { x: 18, y: 45, w: 27, h: 10 });
}

function paintKnight(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isWarden = info.type.includes("Warden");
  drawGroundContact(ctx, isWarden ? 43 : 35);

  if (isWarden) {
    // Halo/rune arch uniquely marks the world boss.
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(CX, 30, 22, Math.PI * 1.08, Math.PI * 1.92);
    stroke(ctx, p.accent, 3);
    for (let i = 0; i < 5; i += 1) {
      const angle = Math.PI * (1.12 + i * 0.19);
      const x = CX + Math.cos(angle) * 22;
      const y = 30 + Math.sin(angle) * 22;
      ellipse(ctx, x, y, 2.2, 2.2);
      ctx.fillStyle = p.highlight;
      ctx.fill();
    }
    ctx.restore();
  }

  // Cape, legs, sword and shield are layered behind the armor.
  ctx.beginPath();
  ctx.moveTo(24, 34);
  ctx.lineTo(40, 34);
  ctx.lineTo(47, 63);
  ctx.lineTo(32, 57);
  ctx.lineTo(17, 63);
  ctx.closePath();
  fillStroke(ctx, p.deep, 1.7);
  for (const side of [-1, 1]) {
    roundedRect(ctx, CX + side * 6 - 4, 50, 8, 18, 2.5);
    fillStroke(ctx, p.shadow, 1.5);
  }

  // Sword.
  ctx.save();
  ctx.translate(isWarden ? 51 : 49, 42);
  ctx.rotate(0.18);
  beginPolygon(ctx, [[-2.5, 15], [-2, -21], [0, -27], [2, -21], [2.5, 15]]);
  fillStroke(ctx, p.highlight, 1.25);
  roundedRect(ctx, -6, 10, 12, 3, 1.2);
  fillStroke(ctx, p.accent, 1);
  ctx.restore();

  // Shield.
  ctx.beginPath();
  ctx.moveTo(12, 39);
  ctx.lineTo(24, 36);
  ctx.lineTo(24, 56);
  ctx.quadraticCurveTo(18, 64, 12, 56);
  ctx.closePath();
  fillStroke(ctx, p.shadow, 1.8);
  ctx.beginPath();
  ctx.moveTo(18, 40);
  ctx.lineTo(18, 59);
  ctx.moveTo(14, 48);
  ctx.lineTo(22, 48);
  stroke(ctx, p.accent, 1.5);

  // Armored torso and oversized pauldrons.
  drawFacet(ctx, [[22, 34], [32, 29], [42, 34], [44, 54], [32, 60], [20, 54]], celGradient(ctx, 29, 60, p), 2);
  for (const side of [-1, 1]) {
    ellipse(ctx, CX + side * 12, 36, isWarden ? 7 : 6, 5);
    fillStroke(ctx, p.light, 1.55);
    if (isWarden) {
      beginPolygon(ctx, [[CX + side * 13, 32], [CX + side * 18, 24], [CX + side * 18, 36]]);
      fillStroke(ctx, p.accent, 1.15);
    }
  }
  roundedRect(ctx, 22, 50, 20, 5, 1.5);
  fillStroke(ctx, p.deep, 1);
  ellipse(ctx, CX, 52.5, 2.6, 2.6);
  fillStroke(ctx, p.accent, 0.8);

  // Helmet with narrow glowing visor.
  ctx.beginPath();
  ctx.moveTo(22, 29);
  ctx.quadraticCurveTo(22, 14, 32, 12);
  ctx.quadraticCurveTo(42, 14, 42, 29);
  ctx.lineTo(38, 35);
  ctx.lineTo(26, 35);
  ctx.closePath();
  fillStroke(ctx, celGradient(ctx, 12, 35, p), 1.9);
  beginPolygon(ctx, [[24, 25], [40, 25], [37, 31], [27, 31]]);
  fillStroke(ctx, p.deep, 1.1);
  ctx.beginPath();
  ctx.moveTo(27, 28);
  ctx.lineTo(37, 28);
  stroke(ctx, p.eye, 2);
  if (!isWarden) {
    for (const side of [-1, 1]) {
      beginPolygon(ctx, [[CX + side * 5, 15], [CX + side * 12, 6], [CX + side * 9, 20]]);
      fillStroke(ctx, p.deep, 1.2);
    }
  } else {
    beginPolygon(ctx, [[28, 14], [32, 4], [36, 14]]);
    fillStroke(ctx, p.highlight, 1.2);
  }
}

function paintInsect(ctx: Ctx, info: PaintInfo): void {
  const p = info.palette;
  const isStalker = info.type.includes("Stalker");
  const isCrawler = info.type.includes("Crawler");
  drawGroundContact(ctx, 50);

  // Six legs/mandibles behind the shell.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y = 42 + i * 7;
      ctx.beginPath();
      ctx.moveTo(CX + side * 10, y);
      ctx.lineTo(CX + side * (18 + i * 2), y + (i - 1) * 4);
      ctx.lineTo(CX + side * (24 + i * 2), y + 7);
      stroke(ctx, i === 1 ? p.base : p.deep, isStalker ? 2.8 : 2.3);
      drawClaw(ctx, CX + side * (24 + i * 2), y + 7, side, p.highlight);
    }
  }

  if (isStalker) {
    // Scorpion tail arch distinguishes Sand Stalker from beetles.
    ctx.beginPath();
    ctx.moveTo(21, 48);
    ctx.quadraticCurveTo(5, 39, 12, 23);
    ctx.quadraticCurveTo(17, 14, 23, 23);
    stroke(ctx, p.shadow, 5);
    beginPolygon(ctx, [[23, 19], [28, 14], [27, 24], [20, 26]]);
    fillStroke(ctx, p.accent, 1.2);
  }

  ellipse(ctx, CX, 47, isStalker ? 15 : 13, 18);
  fillStroke(ctx, celGradient(ctx, 28, 65, p), 2);
  ctx.beginPath();
  ctx.moveTo(CX, 30);
  ctx.lineTo(CX, 64);
  stroke(ctx, p.deep, 1.4);
  ctx.beginPath();
  ctx.arc(CX, 47, 10, Math.PI * 1.1, Math.PI * 1.9);
  stroke(ctx, p.light, 1.5);

  ellipse(ctx, CX, 31, isStalker ? 10 : 9, 8);
  fillStroke(ctx, p.shadow, 1.7);
  for (const side of [-1, 1]) {
    drawAngryEye(ctx, CX + side * 4, 31, side, p.eye);
    ctx.beginPath();
    ctx.moveTo(CX + side * 5, 26);
    ctx.quadraticCurveTo(CX + side * 12, 18, CX + side * 16, 23);
    stroke(ctx, p.deep, 1.25);
  }

  if (isCrawler) {
    // Moss growth on the carapace.
    for (let i = 0; i < 5; i += 1) {
      const x = 23 + i * 4.5;
      ellipse(ctx, x, 39 + (i % 2) * 3, 3, 2);
      ctx.fillStyle = i % 2 ? p.accent : p.highlight;
      ctx.fill();
    }
  } else {
    drawSpots(ctx, info, 5, { x: 23, y: 39, w: 18, h: 19 });
  }
}

const FAMILY_PAINTERS: Record<MonsterFamily, MonsterPainter> = {
  slime: paintSlime,
  beast: paintBeast,
  winged: paintWinged,
  humanoid: paintHumanoid,
  plant: paintPlant,
  construct: paintConstruct,
  specter: paintSpecter,
  reptile: paintReptile,
  knight: paintKnight,
  insect: paintInsect
};

function familyFor(type: string): MonsterFamily {
  return FAMILY_BY_TYPE[type] ?? "slime";
}

const KNOWN_MONSTER_TYPES = new Set(Object.values(MONSTER_DEFINITIONS).map((definition) => definition.type));

/** Texture key ổn định để GameScene đổi sprite theo monster.type. */
export function monsterTextureKey(type: string): string {
  // Version-skew safety: the shared definition lookup already falls back to
  // forestSlime, so rendering should do the same instead of using a missing
  // CanvasTexture key for a monster type this client does not know yet.
  const resolvedType = KNOWN_MONSTER_TYPES.has(type) ? type : "forestSlime";
  return `monster-${resolvedType}`;
}

/**
 * Chuyển scale gameplay cũ (thiết kế cho placeholder 8-12px) thành scale hiển
 * thị cho texture 64x72. Boss/elite lớn hơn nhưng vẫn giữ hit-area gọn trên map.
 */
export function monsterDisplayScale(definitionScale: number, elite = false, boss = false): number {
  const normalized = clamp(0.52 + (definitionScale - 2.25) * 0.18, 0.5, 1.04);
  const rankMultiplier = boss ? 1.12 : elite ? 1.1 : 1;
  return normalized * rankMultiplier;
}

/** Chiều cao texture sau scale, hữu ích để đặt nameplate/status VFX. */
export function monsterDisplayHeight(definitionScale: number, elite = false, boss = false): number {
  return MONSTER_TEX_H * monsterDisplayScale(definitionScale, elite, boss);
}

/** Vẽ một definition vào context 64x72 đã được clear. */
export function paintMonster(ctx: Ctx, definition: MonsterDefinition): void {
  const seed = hashType(definition.type);
  const info: PaintInfo = {
    definition,
    type: definition.type,
    seed,
    palette: paletteFor(definition.tint, seed)
  };
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  FAMILY_PAINTERS[familyFor(definition.type)](ctx, info);
  ctx.restore();
}

/**
 * Bake đúng một CanvasTexture cho mọi entry trong MONSTER_DEFINITIONS.
 * Texture đã tồn tại sẽ được giữ lại để không phát sinh canvas work khi scene
 * được khởi tạo lại trong cùng một Phaser game.
 */
export function bakeMonsterTextures(scene: Phaser.Scene): void {
  for (const definition of Object.values(MONSTER_DEFINITIONS)) {
    const key = monsterTextureKey(definition.type);
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, MONSTER_TEX_W, MONSTER_TEX_H);
    if (!texture) continue;
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, MONSTER_TEX_W, MONSTER_TEX_H);
    paintMonster(ctx, definition);
    texture.refresh();
  }
}
