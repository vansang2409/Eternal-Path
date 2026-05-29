// Tile / biome catalog for the procedural world.
//
// TileId is intentionally numeric so the full map (200x150 = 30 000 cells) can be
// sent over the wire as a 2D number array without any string overhead.

export const TileId = {
  Grass: 0,
  Road: 1,
  Forest: 2,
  Water: 3,
  Sand: 4,
  Snow: 5,
  Swamp: 6,
  Rock: 7,
  DungeonFloor: 8,
  DungeonWall: 9,
  TownStone: 10,
  Deep: 11
} as const;

export type TileId = (typeof TileId)[keyof typeof TileId];

export interface BiomeInfo {
  id: TileId;
  key: string; // i18n / debug key
  walkable: boolean;
  // suggested label color when this biome is used as a zone label
  labelColor: string;
  // monster level band hint (for spawn distribution)
  levelMin: number;
  levelMax: number;
}

export const BIOME_INFO: Record<TileId, BiomeInfo> = {
  [TileId.Grass]: { id: TileId.Grass, key: "grass", walkable: true, labelColor: "#d8e9bf", levelMin: 1, levelMax: 3 },
  [TileId.Road]: { id: TileId.Road, key: "road", walkable: true, labelColor: "#f3e7bf", levelMin: 0, levelMax: 0 },
  [TileId.Forest]: { id: TileId.Forest, key: "forest", walkable: true, labelColor: "#7fbf6a", levelMin: 2, levelMax: 4 },
  [TileId.Water]: { id: TileId.Water, key: "water", walkable: false, labelColor: "#6fb3d8", levelMin: 0, levelMax: 0 },
  [TileId.Sand]: { id: TileId.Sand, key: "sand", walkable: true, labelColor: "#e5d39a", levelMin: 4, levelMax: 6 },
  [TileId.Snow]: { id: TileId.Snow, key: "snow", walkable: true, labelColor: "#eaf2ff", levelMin: 5, levelMax: 7 },
  [TileId.Swamp]: { id: TileId.Swamp, key: "swamp", walkable: true, labelColor: "#8ca06a", levelMin: 4, levelMax: 6 },
  [TileId.Rock]: { id: TileId.Rock, key: "rock", walkable: false, labelColor: "#a3a3a3", levelMin: 0, levelMax: 0 },
  [TileId.DungeonFloor]: { id: TileId.DungeonFloor, key: "dungeon", walkable: true, labelColor: "#c79bff", levelMin: 7, levelMax: 10 },
  [TileId.DungeonWall]: { id: TileId.DungeonWall, key: "dungeonWall", walkable: false, labelColor: "#7a5a99", levelMin: 0, levelMax: 0 },
  [TileId.TownStone]: { id: TileId.TownStone, key: "town", walkable: true, labelColor: "#f3e7bf", levelMin: 0, levelMax: 0 },
  [TileId.Deep]: { id: TileId.Deep, key: "deep", walkable: true, labelColor: "#e5b0ff", levelMin: 6, levelMax: 9 }
};

export function isWalkableTile(tile: TileId): boolean {
  return BIOME_INFO[tile]?.walkable ?? false;
}

export interface WorldMap {
  width: number;
  height: number;
  seed: number;
  tiles: TileId[][]; // [y][x]
  landmarks: {
    town: { x: number; y: number }; // tile coords
    dungeons: { x: number; y: number }[];
  };
}

// Cluster of same-biome tiles, used for placing zone labels.
export interface BiomeCluster {
  biome: TileId;
  centroid: { x: number; y: number }; // tile coords
  size: number; // number of tiles
}
