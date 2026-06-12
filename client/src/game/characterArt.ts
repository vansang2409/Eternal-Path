// Anime hero sprite painters — high-resolution class characters (Sprint 304).
//
// Each class is drawn with vector Canvas2D primitives (cel-shaded gradients +
// clean dark outlines + big anime eyes) in a ~56x72 "design space", then baked
// into a 60x84 Phaser CanvasTexture. The translate (TX,TY) leaves headroom for
// the mage's hat tip and the ranger's bow so nothing clips at the canvas edge.
//
// The game runs with pixelArt:true (nearest sampling), so we bake at roughly the
// on-screen size and display the sprite near scale ~0.8 (see GameScene).
// The SAME drawing code is validated in a node @napi-rs/canvas harness, so what
// renders here matches the design previews exactly.

export const TEX_W = 60;
export const TEX_H = 84;
const TX = 4;
const TY = 14;
// Feet rest at this fraction of the texture height -> use as sprite origin Y so
// the character stands on the iso tile point. Body centre -> origin X.
export const FEET_FRAC = 0.955;
export const CENTER_FRAC = 0.533;

type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;

const OUT = "#241726"; // warm near-black outline shared across all sprites

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}
function fill(ctx: Ctx, c: Paint): void { ctx.fillStyle = c; ctx.fill(); }
function stroke(ctx: Ctx, c: Paint, w: number): void {
  ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
}
function vgrad(ctx: Ctx, x: number, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
}

function drawFace(ctx: Ctx, cx: number, faceY: number, skin: string, skinSh: string, iris: string): void {
  ellipse(ctx, cx, faceY, 11, 12);
  fill(ctx, vgrad(ctx, cx, faceY - 12, faceY + 12, skin, skinSh)); stroke(ctx, OUT, 1.4);
  ctx.globalAlpha = 0.5;
  ellipse(ctx, cx - 6.5, faceY + 4, 2.4, 1.5); fill(ctx, "#ffb3b3");
  ellipse(ctx, cx + 6.5, faceY + 4, 2.4, 1.5); fill(ctx, "#ffb3b3");
  ctx.globalAlpha = 1;
  for (const s of [-1, 1]) {
    const ex = cx + s * 4.3, ey = faceY + 1.5;
    ellipse(ctx, ex, ey, 3.0, 4.0); fill(ctx, "#ffffff");
    ellipse(ctx, ex, ey + 0.6, 2.3, 3.0); fill(ctx, vgrad(ctx, ex, ey - 2, ey + 3, iris, "#10131f"));
    ellipse(ctx, ex, ey + 1.0, 1.1, 1.5); fill(ctx, "#0a0a12");
    ellipse(ctx, ex - 0.9, ey - 1.2, 0.9, 1.1); fill(ctx, "#ffffff");
    ellipse(ctx, ex + 0.8, ey + 1.8, 0.5, 0.6); fill(ctx, "#cfe6ff");
    ctx.beginPath(); ctx.moveTo(ex - 3.1, ey - 2.4); ctx.quadraticCurveTo(ex, ey - 4.2, ex + 3.1, ey - 2.2); stroke(ctx, OUT, 1.3);
    ctx.beginPath(); ctx.moveTo(ex - 2.8, ey - 4.6); ctx.quadraticCurveTo(ex, ey - 5.6, ex + 2.8, ey - 4.6); stroke(ctx, "#5a3d2a", 1.1);
  }
  ctx.beginPath(); ctx.moveTo(cx, faceY + 4.6); ctx.lineTo(cx + 0.8, faceY + 5.6); stroke(ctx, skinSh, 1);
  ctx.beginPath(); ctx.moveTo(cx - 1.8, faceY + 7.4); ctx.quadraticCurveTo(cx, faceY + 8.6, cx + 1.8, faceY + 7.4); stroke(ctx, "#a85a4a", 1.1);
}

function drawLegs(ctx: Ctx, cx: number, top: number, pant: string, pantSh: string, boot: string): void {
  for (const s of [-1, 1]) {
    rr(ctx, cx + s * 5 - 3.2, top, 6.4, 13, 2.6);
    fill(ctx, vgrad(ctx, cx, top, top + 13, pant, pantSh)); stroke(ctx, OUT, 1.3);
    rr(ctx, cx + s * 5 - 3.6, top + 10, 7.2, 5.2, 2);
    fill(ctx, boot); stroke(ctx, OUT, 1.3);
  }
}
function drawArm(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, cSh: string): void {
  rr(ctx, x, y, w, h, w / 2); fill(ctx, vgrad(ctx, x, y, y + h, c, cSh)); stroke(ctx, OUT, 1.2);
}
function hand(ctx: Ctx, x: number, y: number, skin: string): void {
  ellipse(ctx, x, y, 2.6, 2.6); fill(ctx, skin); stroke(ctx, OUT, 1.1);
}
function drawStar(ctx: Ctx, cx: number, cy: number, r: number, c: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const r2 = i % 2 ? r * 0.45 : r;
    const x = cx + Math.cos(ang) * r2, y = cy + Math.sin(ang) * r2;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath(); fill(ctx, c); stroke(ctx, OUT, 0.8);
}

function drawWarrior(ctx: Ctx): void {
  const cx = 28, skin = "#ffd9ad", skinSh = "#e0a878";
  drawLegs(ctx, cx, 50, "#3a3550", "#27233b", "#8a5a32");
  drawArm(ctx, cx + 8, 30, 7, 16, "#9aa3ad", "#5f6873");
  rr(ctx, cx - 12, 30, 24, 22, 6); fill(ctx, vgrad(ctx, cx, 30, 52, "#cfd6dd", "#7e8893")); stroke(ctx, OUT, 1.5);
  ellipse(ctx, cx, 39, 6, 7); fill(ctx, "#e8edf2");
  rr(ctx, cx - 3.5, 33, 7, 18, 2); fill(ctx, vgrad(ctx, cx, 33, 51, "#d23b46", "#8e2530")); stroke(ctx, OUT, 1.1);
  ellipse(ctx, cx, 41, 2.2, 2.2); fill(ctx, "#f2c84a");
  for (const s of [-1, 1]) { ellipse(ctx, cx + s * 12, 32, 5.5, 4.5); fill(ctx, vgrad(ctx, cx, 28, 36, "#e8edf2", "#8d97a1")); stroke(ctx, OUT, 1.4); }
  drawArm(ctx, cx - 15, 31, 7, 15, "#9aa3ad", "#5f6873"); hand(ctx, cx - 12, 45, skin);
  rr(ctx, cx - 3, 26, 6, 6, 2); fill(ctx, skinSh);
  drawFace(ctx, cx, 16, skin, skinSh, "#5b86c4");
  ctx.beginPath();
  ctx.moveTo(cx - 11, 13); ctx.quadraticCurveTo(cx - 12, 2, cx, 3); ctx.quadraticCurveTo(cx + 12, 2, cx + 11, 13);
  ctx.quadraticCurveTo(cx + 7, 8, cx + 4, 11); ctx.quadraticCurveTo(cx + 1, 7, cx - 1, 11); ctx.quadraticCurveTo(cx - 4, 7, cx - 6, 11); ctx.quadraticCurveTo(cx - 9, 8, cx - 11, 13);
  ctx.closePath(); fill(ctx, vgrad(ctx, cx, 2, 14, "#7a4a28", "#4a2c17")); stroke(ctx, OUT, 1.3);
  ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(cx - 6, 6); ctx.quadraticCurveTo(cx - 1, 4, cx + 5, 6); stroke(ctx, "#b07c4a", 1.6); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(cx + 13, 34); ctx.rotate(0.26);
  rr(ctx, -2.2, -34, 4.4, 30, 2); fill(ctx, vgrad(ctx, 0, -34, -4, "#eef3f8", "#aab4bd")); stroke(ctx, OUT, 1.2);
  ctx.beginPath(); ctx.moveTo(0, -36.5); ctx.lineTo(2.4, -33); ctx.lineTo(-2.4, -33); ctx.closePath(); fill(ctx, "#eef4fa"); stroke(ctx, OUT, 1);
  ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(-0.7, -33); ctx.lineTo(-0.7, -6); stroke(ctx, "#ffffff", 1); ctx.globalAlpha = 1;
  rr(ctx, -6, -5, 12, 3.4, 1.6); fill(ctx, "#f2c84a"); stroke(ctx, OUT, 1.1);
  rr(ctx, -1.8, -2, 3.6, 8, 1.6); fill(ctx, "#8a5a32"); stroke(ctx, OUT, 1.1);
  ellipse(ctx, 0, 7, 2.2, 2.2); fill(ctx, "#f2c84a"); stroke(ctx, OUT, 1);
  ctx.restore(); hand(ctx, cx + 12, 33, skin);
}

function drawMage(ctx: Ctx): void {
  const cx = 28, skin = "#ffe0c0", skinSh = "#e2b48c";
  drawLegs(ctx, cx, 52, "#2a2350", "#1b1638", "#46307a");
  ctx.beginPath(); ctx.moveTo(cx - 11, 32); ctx.lineTo(cx + 11, 32); ctx.lineTo(cx + 16, 60); ctx.quadraticCurveTo(cx, 64, cx - 16, 60); ctx.closePath();
  fill(ctx, vgrad(ctx, cx, 32, 62, "#6b4bd0", "#34206e")); stroke(ctx, OUT, 1.5);
  ctx.globalAlpha = .85; rr(ctx, cx - 2.2, 33, 4.4, 27, 2); fill(ctx, vgrad(ctx, cx, 33, 60, "#fff0a0", "#c9a73a")); stroke(ctx, OUT, 1); ctx.globalAlpha = 1;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 10, 33); ctx.lineTo(cx + s * 15, 50); ctx.lineTo(cx + s * 7, 48); ctx.closePath(); fill(ctx, vgrad(ctx, cx, 33, 50, "#7a5be0", "#3c2680")); stroke(ctx, OUT, 1.3); }
  hand(ctx, cx - 12, 49, skin);
  rr(ctx, cx - 3, 27, 6, 6, 2); fill(ctx, skinSh);
  drawFace(ctx, cx, 17, skin, skinSh, "#39c6c0");
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 9, 12); ctx.quadraticCurveTo(cx + s * 14, 24, cx + s * 8, 30); ctx.lineTo(cx + s * 5, 24); ctx.closePath(); fill(ctx, vgrad(ctx, cx, 12, 30, "#f6e7b6", "#caa766")); stroke(ctx, OUT, 1.2); }
  ctx.beginPath(); ctx.moveTo(cx - 13, 9); ctx.quadraticCurveTo(cx - 2, 11, cx + 13, 9); ctx.quadraticCurveTo(cx + 6, 7, cx + 5, 4); ctx.quadraticCurveTo(cx + 9, -10, cx - 2, -9); ctx.quadraticCurveTo(cx - 6, 1, cx - 13, 9); ctx.closePath();
  fill(ctx, vgrad(ctx, cx, -10, 9, "#5a3bb0", "#2d1a5e")); stroke(ctx, OUT, 1.5);
  rr(ctx, cx - 11, 6, 22, 3.4, 1.6); fill(ctx, "#f0d65a"); stroke(ctx, OUT, 1);
  drawStar(ctx, cx + 2, 0, 2.6, "#ffe88a");
  ellipse(ctx, cx + 6, -9, 1.8, 1.8); fill(ctx, "#ffe88a"); stroke(ctx, OUT, 1);
  ctx.save(); ctx.translate(cx - 15, 31);
  rr(ctx, -1.6, -2, 3.2, 34, 1.6); fill(ctx, vgrad(ctx, 0, -2, 32, "#8a5a32", "#5a381e")); stroke(ctx, OUT, 1.2);
  const og = ctx.createRadialGradient(0, -8, 0, 0, -8, 8); og.addColorStop(0, "#dffaff"); og.addColorStop(.45, "#4fd6e8"); og.addColorStop(1, "rgba(79,214,232,0)");
  ellipse(ctx, 0, -8, 8, 8); fill(ctx, og);
  ellipse(ctx, 0, -8, 3.6, 3.6); fill(ctx, "#eafdff"); stroke(ctx, "#39c6c0", 1.2);
  ctx.restore(); hand(ctx, cx - 15, 32, skin);
}

function drawRanger(ctx: Ctx): void {
  const cx = 28, skin = "#ffd9ad", skinSh = "#e0a878";
  drawLegs(ctx, cx, 51, "#5a3a1e", "#3c2512", "#6e4a26");
  rr(ctx, cx - 11, 31, 22, 22, 6); fill(ctx, vgrad(ctx, cx, 31, 53, "#5bb85a", "#2f7d3c")); stroke(ctx, OUT, 1.5);
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx - 9, 33); ctx.lineTo(cx + 9, 50); ctx.lineWidth = 3; ctx.strokeStyle = "#6e4a26"; ctx.stroke(); ctx.restore();
  ellipse(ctx, cx + 2, 42, 1.8, 1.8); fill(ctx, "#caa24a");
  rr(ctx, cx - 11, 49, 22, 4, 1.5); fill(ctx, "#5a3a1e"); stroke(ctx, OUT, 1.1);
  drawArm(ctx, cx - 15, 32, 6.5, 14, "#4f9a4d", "#2f6b3f"); drawArm(ctx, cx + 9, 32, 6.5, 14, "#4f9a4d", "#2f6b3f");
  hand(ctx, cx - 14, 45, skin); hand(ctx, cx + 12, 45, skin);
  rr(ctx, cx - 3, 27, 6, 6, 2); fill(ctx, skinSh);
  drawFace(ctx, cx, 17, skin, skinSh, "#4fae5a");
  ctx.beginPath(); ctx.moveTo(cx - 12, 18); ctx.quadraticCurveTo(cx - 14, 2, cx, 1); ctx.quadraticCurveTo(cx + 14, 2, cx + 12, 18); ctx.quadraticCurveTo(cx + 8, 12, cx + 9, 9); ctx.quadraticCurveTo(cx, 6, cx - 9, 9); ctx.quadraticCurveTo(cx - 8, 12, cx - 12, 18); ctx.closePath();
  fill(ctx, vgrad(ctx, cx, 1, 18, "#3f8a4a", "#24612f")); stroke(ctx, OUT, 1.4);
  ellipse(ctx, cx, 2, 3, 2.4); fill(ctx, "#2f6b3f");
  ctx.beginPath(); ctx.moveTo(cx - 8, 9); ctx.quadraticCurveTo(cx, 6, cx + 8, 9); ctx.quadraticCurveTo(cx + 4, 12, cx + 3, 10); ctx.quadraticCurveTo(cx, 13, cx - 3, 10); ctx.quadraticCurveTo(cx - 4, 12, cx - 8, 9); ctx.closePath();
  fill(ctx, "#7a4a28"); stroke(ctx, OUT, 1);
  ctx.save(); ctx.translate(cx - 15, 38);
  ctx.beginPath(); ctx.arc(4, 0, 17, Math.PI * 0.62, Math.PI * 1.38); stroke(ctx, vgrad(ctx, 0, -16, 16, "#caa24a", "#7a5320"), 2.4);
  const ax = 4 + Math.cos(Math.PI * 0.62) * 17, ay = Math.sin(Math.PI * 0.62) * 17;
  const bx = 4 + Math.cos(Math.PI * 1.38) * 17, by = Math.sin(Math.PI * 1.38) * 17;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); stroke(ctx, "#e9e2c4", 1);
  ctx.restore();
}

const PAINTERS: Record<string, (ctx: Ctx) => void> = {
  warrior: drawWarrior, mage: drawMage, ranger: drawRanger
};

/** Paint a class hero into a 2D context already sized TEX_W x TEX_H. */
export function paintHero(ctx: Ctx, playerClass: string): void {
  const painter = PAINTERS[playerClass];
  if (!painter) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(TX, TY);
  painter(ctx);
  ctx.restore();
}

/** Bake (or rebuild) the Phaser canvas texture for a class hero sprite. */
export function bakeClassTexture(scene: Phaser.Scene, key: string, playerClass: string): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = scene.textures.createCanvas(key, TEX_W, TEX_H);
  if (!canvas) return;
  const ctx = canvas.getContext() as unknown as CanvasRenderingContext2D;
  paintHero(ctx, playerClass);
  canvas.refresh();
}

export const CLASS_SPRITE_KEYS: Record<string, string> = {
  warrior: "player-warrior",
  mage: "player-mage",
  ranger: "player-ranger"
};
