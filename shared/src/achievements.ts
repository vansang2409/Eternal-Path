import type { Achievement } from "./types.js";

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-blood",     title: "Khai Trận",          description: "Hạ 1 quái đầu tiên." },
  { id: "reach-level-5",   title: "Tân Binh",            description: "Đạt cấp 5." },
  { id: "reach-level-10",  title: "Chiến Sĩ",            description: "Đạt cấp 10." },
  { id: "reach-level-20",  title: "Lão Làng",            description: "Đạt cấp 20." },
  { id: "slay-elite",      title: "Sát Tinh",            description: "Hạ 1 quái elite." },
  { id: "slay-boss",       title: "Kẻ Phá Sấu",          description: "Hạ world boss Eternal Warden." },
  { id: "slay-dungeon-boss",title:"Khắc Tinh Của Khắc Tinh",description:"Hạ 1 mini-boss trong dungeon." },
  { id: "epic-find",       title: "Vũ Khí Sử Thi",       description: "Nhặt 1 đồ Epic." },
  { id: "idler",           title: "Người Vắng Mặt",      description: "Nhận offline rewards lần đầu." },
  { id: "socialite",       title: "Hòa Nhập",            description: "Vào party lần đầu." },
  { id: "kill-100",        title: "Thợ Săn Lành Nghề",   description: "Hạ tổng 100 quái." },
  { id: "kill-500",        title: "Bậc Thầy Săn Bắt",    description: "Hạ tổng 500 quái." },
  { id: "treasure-hoard",  title: "Kho Báu Đầy",         description: "Mở 10 rương kho báu." },
  { id: "craft-master",    title: "Thợ Rèn",             description: "Chế tạo 5 trang bị." },
  { id: "pvp-victor",      title: "Chiến Thắng Đầu Tay", description: "Hạ 1 player tại Đấu Trường." },
  { id: "pvp-champion",    title: "Vô Địch Đấu Trường",  description: "Hạ 10 player tại Đấu Trường." },
  { id: "mount-rider",     title: "Kỵ Sĩ",               description: "Nhận Bùa Cưỡi Gió từ world boss." },
  { id: "homeward",        title: "Đường Về Nhà",        description: "Dùng 1 Cuộn Hồi Thành." },
  { id: "deep-explorer",   title: "Người Đi Vực Sâu",    description: "Hạ 1 quái cấp 8 trở lên." },
  { id: "talent-spent",    title: "Tài Năng Lộ Diện",    description: "Nâng cấp 1 skill bằng điểm tài năng." }
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
