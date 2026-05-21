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

  createTile(scene, "tiles", palette());
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

function createTile(scene: Phaser.Scene, key: string, colors: Record<string, string>): void {
  const canvas = scene.textures.createCanvas(key, 96, 32);
  if (!canvas) return;
  const ctx = canvas.getContext();
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = colors.grass;
  for (let i = 0; i < 28; i += 1) ctx.fillRect(Math.random() * 30, Math.random() * 30, 2, 1);
  ctx.fillStyle = colors.town;
  ctx.fillRect(32, 0, 32, 32);
  ctx.fillStyle = colors.road;
  ctx.fillRect(64, 0, 32, 32);
  ctx.strokeStyle = "#4d463c";
  ctx.strokeRect(64, 0, 32, 32);
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
    "9": "#6f2634",
    ground: "#2f6b3f",
    grass: "#4f9a4d",
    town: "#736453",
    road: "#9b865f"
  };
}
