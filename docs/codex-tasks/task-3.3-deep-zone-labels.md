# Task 3.3 — Deep zone + zone labels

> Sprint 3 · Priority 3. Read AGENTS.md first. Keep the server fully authoritative.

## Goal

Give the map a sense of place and progression: a clearly labeled "deep" region where the higher-level monsters live, so players understand where to go as they get stronger. This is mostly presentation plus tidying spawn placement — no new gameplay systems.

## Context files

- `server/src/game/GameWorld.ts` — `createMonsterSpawns` (spawn coordinates).
- `client/src/game/GameScene.ts` — `createMap` (where the town label is drawn); add zone labels here.
- `shared/src/formulas.ts` — `WORLD_WIDTH`, `WORLD_HEIGHT`, `TILE_SIZE` (do not change these).
- `client/src/i18n.ts` — zone name strings.

## Requirements

- Group the existing monster spawns into clear bands by difficulty: low-level monsters near town, mid-level in a middle area, and the highest-level monsters (and the boss from Task 3.2, if present) clustered in a far "deep" region. Reposition spawn coordinates only; do not change monster stats or counts.
- Draw on-map zone labels (like the existing town label) at the center of each region, e.g. "Town", "Greenwood", "Deeplands", localized via i18n. Keep them subtle and readable, matching the existing dark-fantasy style.
- Optionally tint the deep region's ground tiles slightly differently to make the boundary readable, reusing the existing tilemap approach (no new assets).

## DO NOT

- Do not change `WORLD_WIDTH`, `WORLD_HEIGHT`, or `TILE_SIZE`.
- Do not change monster stats, the monster catalog, or the number of spawns.
- Do not add new npm dependencies or external art assets.

## Acceptance criteria

- [ ] Monsters are grouped by difficulty: easy near town, hardest in the far "deep" region.
- [ ] On-map zone labels are visible and localized (VI/EN).
- [ ] The deep region is visually distinguishable from the starting area.
- [ ] `npm run typecheck` and `npm run build` pass.

When done, explain how to navigate to each zone to verify.
