import type { Achievement } from "./types.js";

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-blood",
    title: "First Blood",
    description: "Defeat any monster for the first time."
  },
  {
    id: "reach-level-5",
    title: "Level 5",
    description: "Reach character level 5."
  },
  {
    id: "reach-level-10",
    title: "Level 10",
    description: "Reach character level 10."
  },
  {
    id: "slay-elite",
    title: "Elite Slayer",
    description: "Defeat any elite monster."
  },
  {
    id: "slay-boss",
    title: "Warden Breaker",
    description: "Defeat the world boss."
  },
  {
    id: "epic-find",
    title: "Epic Find",
    description: "Loot an Epic item."
  },
  {
    id: "idler",
    title: "While You Were Away",
    description: "Receive offline rewards for the first time."
  },
  {
    id: "socialite",
    title: "Socialite",
    description: "Join a party for the first time."
  }
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
