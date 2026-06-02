// Class system: Warrior / Mage / Ranger. Defines starting stat bonuses and
// the subset of skills each class may learn.

import type { SkillId } from "./types.js";

export type PlayerClass = "warrior" | "mage" | "ranger";

export const PLAYER_CLASSES: PlayerClass[] = ["warrior", "mage", "ranger"];

export interface ClassInfo {
  id: PlayerClass;
  name: string;
  description: string;
  // Bonuses applied to starting stats (one-time at class pick).
  startBonusMaxHp: number;
  startBonusAttack: number;
  startBonusDefense: number;
  // Skills the class is allowed to learn.
  skills: SkillId[];
}

export const CLASS_CATALOG: Record<PlayerClass, ClassInfo> = {
  warrior: {
    id: "warrior",
    name: "Chiến Binh",
    description: "Cận chiến, thể lực cao. Dùng đòn vật lý + AoE cận thân.",
    startBonusMaxHp: 50,
    startBonusAttack: 2,
    startBonusDefense: 3,
    skills: ["powerStrike", "cleave", "whirlwind", "heal", "piercingStrike", "divineLight"]
  },
  mage: {
    id: "mage",
    name: "Pháp Sư",
    description: "Phép thuật tầm xa, AoE diện rộng. Mong manh nhưng dồn sát thương lớn.",
    startBonusMaxHp: 10,
    startBonusAttack: 6,
    startBonusDefense: 0,
    skills: ["flameBurst", "thunderStrike", "icicleStorm", "voidNova", "healingWave", "greaterHeal"]
  },
  ranger: {
    id: "ranger",
    name: "Du Hiệp",
    description: "Đánh nhanh, hồi máu qua hút máu. Đa nhiệm giữa tốc độ và sát thương đơn lẻ.",
    startBonusMaxHp: 25,
    startBonusAttack: 3,
    startBonusDefense: 1,
    skills: ["swiftStrike", "swiftBlade", "shadowAssault", "lifedrain", "heal", "piercingStrike"]
  }
};

export function isPlayerClass(value: unknown): value is PlayerClass {
  return value === "warrior" || value === "mage" || value === "ranger";
}

export function classCanLearnSkill(playerClass: PlayerClass | undefined, skillId: SkillId): boolean {
  if (!playerClass) return false;
  return CLASS_CATALOG[playerClass].skills.includes(skillId);
}
