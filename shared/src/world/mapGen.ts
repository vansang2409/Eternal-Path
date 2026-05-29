// Procedural world generator.
//
// Deterministic: same (seed, width, height) -> identical tile layout.
// Pipeline:
//   1. Two layers of value noise (elevation + moisture).
//   2. Lookup table mapping (elevation, moisture) -> biome.
//   3. Carve a few rivers from high to low elevation.
//   4. Stamp town + 2 main roads to guarantee connectivity from spawn.
//   5. Place 3 dungeon clusters in remote, high-elevation tiles.
//   6. Flood-fill from town; any walkable pocket disconnected from town
//      gets bridged by converting a thin wall ring back to grass.

import { BIOME_INFO, BiomeCluster, TileId, WorldMap, isWalkableTile } from "./biomes.js";

// ---------- PRNG + noise primitives ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash to a deterministic [0,1) value at integer grid corners.
function cornerHash(seed: number, ix: number, iy: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (ix * 374761393), 0x85ebca6b);
  h = Math.imul(h ^ (iy * 668265263), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth interpolation (smoothstep).
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// 2D value noise sampled at (x, y) in tile-space. `freq` is the period in
// tiles — larger = smoother, slower-changing biome features.
function valueNoise(seed: number, x: number, y: number, freq: number): number {
  const sx = x / freq;
  const sy = y / freq;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const v00 = cornerHash(seed, ix, iy);
  const v10 = cornerHash(seed, ix + 1, iy);
  const v01 = cornerHash(seed, ix, iy + 1);
  const v11 = cornerHash(seed, ix + 1, iy + 1);
  const ux = smooth(fx);
  const uy = smooth(fy);
  const a = v00 + (v10 - v00) * ux;
  const b = v01 + (v11 - v01) * ux;
  return a + (b - a) * uy;
}

// Fractal noise: sum of octaves for richer detail.
function fbm(seed: number, x: number, y: number, baseFreq: number, octaves: number): number {
  let amp = 1;
  let freq = baseFreq;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise(seed + i * 1013, x, y, freq);
    norm += amp;
    amp *= 0.5;
    freq *= 0.5; // each octave doubles the spatial frequency (halves the period)
  }
  return sum / norm;
}

// ---------- biome lookup ----------

function pickBiome(elevation: number, moisture: number): TileId {
  if (elevation > 0.78) return TileId.Rock; // high mountains: impassable
  if (elevation > 0.66) {
    if (moisture > 0.6) return TileId.Snow;
    return TileId.Rock;
  }
  if (elevation < 0.32 && moisture > 0.55) return TileId.Water;
  if (elevation < 0.34) {
    return moisture < 0.35 ? TileId.Sand : TileId.Swamp;
  }
  if (moisture < 0.3) return TileId.Sand;
  if (moisture > 0.7) return TileId.Forest;
  if (moisture > 0.5) return TileId.Forest;
  return TileId.Grass;
}

// ---------- main entrypoint ----------

export function generateWorld(seed: number, width: number, height: number): WorldMap {
  const tiles: TileId[][] = Array.from({ length: height }, () => new Array<TileId>(width).fill(TileId.Grass));

  // Pass 1: biome from noise.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const elev = fbm(seed, x, y, 38, 4);
      const moist = fbm(seed + 7919, x, y, 30, 4);
      tiles[y][x] = pickBiome(elev, moist);

      // Far-from-town high-level region: tint as "deep" purple zone.
      const dx = x - 7;
      const dy = y - 7;
      const distFromTown = Math.sqrt(dx * dx + dy * dy);
      const distNorm = distFromTown / Math.sqrt(width * width + height * height);
      if (distNorm > 0.55 && tiles[y][x] === TileId.Grass) {
        tiles[y][x] = TileId.Deep;
      }
    }
  }

  // Pass 2: rivers. Start from a handful of high-elevation seeds, walk
  // downhill toward lower elevation, marking water along the way.
  const rng = mulberry32(seed ^ 0xbeef);
  const riverCount = Math.max(3, Math.floor((width * height) / 8000));
  for (let i = 0; i < riverCount; i += 1) {
    let rx = Math.floor(rng() * width);
    let ry = Math.floor(rng() * height);
    for (let step = 0; step < 200; step += 1) {
      if (rx < 0 || ry < 0 || rx >= width || ry >= height) break;
      // Don't carve rivers through town spawn area.
      if (rx < 11 && ry < 11) break;
      const cur = tiles[ry][rx];
      if (cur !== TileId.Rock && cur !== TileId.DungeonWall && cur !== TileId.TownStone) {
        tiles[ry][rx] = TileId.Water;
      }
      // Move toward lowest-elevation 4-neighbour.
      const candidates: { x: number; y: number; e: number }[] = [];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ] as const) {
        const nx = rx + dx;
        const ny = ry + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        candidates.push({ x: nx, y: ny, e: fbm(seed, nx, ny, 38, 4) });
      }
      if (!candidates.length) break;
      candidates.sort((a, b) => a.e - b.e);
      rx = candidates[0].x;
      ry = candidates[0].y;
    }
  }

  // Pass 3: stamp town. Always at top-left, 11x11 stone area, fully walkable.
  for (let y = 0; y < 11; y += 1) {
    for (let x = 0; x < 11; x += 1) {
      if (x < width && y < height) tiles[y][x] = TileId.TownStone;
    }
  }

  // Pass 4: main roads ensuring connectivity from town.
  const drawRoad = (fromX: number, fromY: number, toX: number, toY: number) => {
    // L-shaped road: first horizontal, then vertical.
    let cx = fromX;
    let cy = fromY;
    while (cx !== toX) {
      if (inBounds(cx, cy, width, height) && tiles[cy][cx] !== TileId.TownStone) {
        tiles[cy][cx] = TileId.Road;
      }
      cx += cx < toX ? 1 : -1;
    }
    while (cy !== toY) {
      if (inBounds(cx, cy, width, height) && tiles[cy][cx] !== TileId.TownStone) {
        tiles[cy][cx] = TileId.Road;
      }
      cy += cy < toY ? 1 : -1;
    }
    if (inBounds(cx, cy, width, height) && tiles[cy][cx] !== TileId.TownStone) {
      tiles[cy][cx] = TileId.Road;
    }
  };

  // Highway from town reaching the far corners + middle waypoints, so the
  // player can always walk anywhere they can see on the map.
  const waypoints: { x: number; y: number }[] = [
    { x: Math.floor(width * 0.5), y: 10 },
    { x: width - 5, y: 10 },
    { x: 10, y: Math.floor(height * 0.5) },
    { x: 10, y: height - 5 },
    { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
    { x: width - 5, y: Math.floor(height * 0.5) },
    { x: Math.floor(width * 0.5), y: height - 5 },
    { x: width - 5, y: height - 5 }
  ];
  for (const wp of waypoints) {
    drawRoad(10, 10, wp.x, wp.y);
  }

  // Pass 5: dungeon clusters. Place a few small dungeon "rooms" in remote
  // high-level areas. Each is a 9x7 stamp with floor inside and wall outline.
  const dungeons: { x: number; y: number }[] = [];
  const dungeonSites: { x: number; y: number }[] = [
    { x: Math.floor(width * 0.78), y: Math.floor(height * 0.28) },
    { x: Math.floor(width * 0.32), y: Math.floor(height * 0.82) },
    { x: Math.floor(width * 0.86), y: Math.floor(height * 0.82) }
  ];
  for (const site of dungeonSites) {
    const w = 9;
    const h = 7;
    const x0 = Math.max(2, site.x - Math.floor(w / 2));
    const y0 = Math.max(2, site.y - Math.floor(h / 2));
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        const tx = x0 + dx;
        const ty = y0 + dy;
        if (!inBounds(tx, ty, width, height)) continue;
        const isEdge = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
        tiles[ty][tx] = isEdge ? TileId.DungeonWall : TileId.DungeonFloor;
      }
    }
    // Carve a doorway on the side closest to the road grid.
    const doorX = x0 + Math.floor(w / 2);
    const doorY = y0 + h - 1;
    if (inBounds(doorX, doorY, width, height)) tiles[doorY][doorX] = TileId.DungeonFloor;
    // Carve a road from town toward the dungeon doorway.
    drawRoad(10, 10, doorX, doorY + 1);
    dungeons.push({ x: doorX, y: doorY });
  }

  // Pass 6: ensure connectivity. Flood-fill from town. Anywhere a walkable
  // pocket is disconnected, knock out a single ring of walls in the direction
  // of the town to bridge it.
  bridgeIsolatedRegions(tiles, width, height, 7, 7);

  return {
    width,
    height,
    seed,
    tiles,
    landmarks: {
      town: { x: 7, y: 7 },
      dungeons
    }
  };
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

// Find walkable pockets isolated from (startX, startY) and convert their
// border walls back to grass so the player can reach them. Cheap heuristic:
// for each isolated component, swap the most-connected wall neighbour of the
// component to grass; repeat until everything connects.
function bridgeIsolatedRegions(tiles: TileId[][], width: number, height: number, startX: number, startY: number): void {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reached = floodReachable(tiles, width, height, startX, startY);
    const isolated: { x: number; y: number; size: number }[] = [];
    const seen = new Uint8Array(width * height);
    // copy reached into seen for quick skip
    for (let i = 0; i < reached.length; i += 1) seen[i] = reached[i];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (seen[idx]) continue;
        if (!isWalkableTile(tiles[y][x])) continue;
        // BFS this pocket.
        const queue: number[] = [idx];
        seen[idx] = 1;
        let size = 0;
        let cx = x;
        let cy = y;
        while (queue.length) {
          const cur = queue.shift()!;
          const px = cur % width;
          const py = Math.floor(cur / width);
          size += 1;
          cx = px;
          cy = py;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ] as const) {
            const nx = px + dx;
            const ny = py + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            const nidx = ny * width + nx;
            if (seen[nidx]) continue;
            if (!isWalkableTile(tiles[ny][nx])) continue;
            seen[nidx] = 1;
            queue.push(nidx);
          }
        }
        if (size >= 8) isolated.push({ x: cx, y: cy, size });
      }
    }
    if (!isolated.length) return;
    // Bridge each isolated pocket toward the start point by carving a road.
    for (const pocket of isolated) {
      carveRoadLine(tiles, width, height, pocket.x, pocket.y, startX, startY);
    }
  }
}

function floodReachable(tiles: TileId[][], width: number, height: number, sx: number, sy: number): Uint8Array {
  const reached = new Uint8Array(width * height);
  if (!inBounds(sx, sy, width, height) || !isWalkableTile(tiles[sy][sx])) return reached;
  const queue: number[] = [sy * width + sx];
  reached[queue[0]] = 1;
  while (queue.length) {
    const cur = queue.shift()!;
    const px = cur % width;
    const py = Math.floor(cur / width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ] as const) {
      const nx = px + dx;
      const ny = py + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      const nidx = ny * width + nx;
      if (reached[nidx]) continue;
      if (!isWalkableTile(tiles[ny][nx])) continue;
      reached[nidx] = 1;
      queue.push(nidx);
    }
  }
  return reached;
}

function carveRoadLine(tiles: TileId[][], width: number, height: number, fromX: number, fromY: number, toX: number, toY: number): void {
  let cx = fromX;
  let cy = fromY;
  let safety = width + height + 10;
  while ((cx !== toX || cy !== toY) && safety > 0) {
    safety -= 1;
    if (inBounds(cx, cy, width, height)) {
      const t = tiles[cy][cx];
      if (t === TileId.Water || t === TileId.Rock || t === TileId.DungeonWall) {
        tiles[cy][cx] = TileId.Road;
      } else if (!isWalkableTile(t)) {
        tiles[cy][cx] = TileId.Road;
      }
    }
    if (cx !== toX) cx += cx < toX ? 1 : -1;
    else if (cy !== toY) cy += cy < toY ? 1 : -1;
  }
}

// ---------- spawn hints + cluster labels ----------

export interface SpawnHint {
  biome: TileId;
  position: { x: number; y: number };
}

// Pick representative walkable spots per biome so the server can place
// monsters in the right environments.
export function gatherSpawnHints(map: WorldMap, perBiome = 4): SpawnHint[] {
  const out: SpawnHint[] = [];
  const pools = new Map<TileId, { x: number; y: number }[]>();
  for (let y = 4; y < map.height - 4; y += 1) {
    for (let x = 4; x < map.width - 4; x += 1) {
      const t = map.tiles[y][x];
      if (!isWalkableTile(t)) continue;
      // Skip town and road as spawn candidates.
      if (t === TileId.TownStone || t === TileId.Road) continue;
      if (x < 14 && y < 14) continue; // keep spawn-safe ring around town
      const arr = pools.get(t);
      if (!arr) pools.set(t, [{ x, y }]);
      else arr.push({ x, y });
    }
  }
  const rng = mulberry32(map.seed ^ 0xc0ffee);
  for (const [biome, arr] of pools) {
    for (let i = 0; i < perBiome && arr.length; i += 1) {
      const idx = Math.floor(rng() * arr.length);
      const [pick] = arr.splice(idx, 1);
      out.push({ biome, position: pick });
    }
  }
  return out;
}

// Largest cluster per biome by flood fill — used to place zone labels at
// the cluster centroid.
export function clusterByBiome(map: WorldMap): BiomeCluster[] {
  const seen = new Uint8Array(map.width * map.height);
  const clusters: BiomeCluster[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = y * map.width + x;
      if (seen[idx]) continue;
      const target = map.tiles[y][x];
      if (target === TileId.Road) {
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
        const px = cur % map.width;
        const py = Math.floor(cur / map.width);
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
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          const nidx = ny * map.width + nx;
          if (seen[nidx]) continue;
          if (map.tiles[ny][nx] !== target) continue;
          seen[nidx] = 1;
          queue.push(nidx);
        }
      }
      if (count >= 20) {
        clusters.push({
          biome: target,
          centroid: { x: Math.round(sumX / count), y: Math.round(sumY / count) },
          size: count
        });
      }
    }
  }
  clusters.sort((a, b) => b.size - a.size);
  return clusters;
}

// Re-export for convenience.
export { BIOME_INFO, TileId, isWalkableTile } from "./biomes.js";
export type { WorldMap, BiomeCluster } from "./biomes.js";
