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
  { id: "talent-spent",    title: "Tài Năng Lộ Diện",    description: "Nâng cấp 1 skill bằng điểm tài năng." },
  // Sprint 67 — achievements tied to the newer systems, each with a reward.
  { id: "guild-founder",   title: "Khai Quốc Công Thần",  description: "Thành lập một guild.",          reward: { gems: 20 } },
  { id: "merchant",        title: "Thương Nhân",          description: "Bán được 1 món ở Chợ.",        reward: { gold: 500 } },
  { id: "big-spender",     title: "Tay Chơi",             description: "Mua 1 món ở Chợ.",             reward: { gold: 300 } },
  { id: "beast-tamer",     title: "Người Thuần Thú",      description: "Thu phục 1 linh thú.",         reward: { gems: 10 } },
  { id: "beast-master",    title: "Bá Chủ Linh Thú",      description: "Nuôi 1 linh thú đạt cấp 5.",   reward: { gems: 30 } },
  { id: "raid-slayer",     title: "Diệt Ma Vương",        description: "Góp công hạ 1 Boss Guild.",    reward: { gems: 25 } },
  { id: "devout",          title: "Lòng Thành",           description: "Đạt chuỗi điểm danh 7 ngày.",  reward: { gems: 15 } },
  { id: "titled",          title: "Người Có Danh",        description: "Gắn 1 danh hiệu.",             reward: { gold: 200 } },
  // Sprint 82 — economy-feature achievements.
  { id: "bag-master",      title: "Túi Thần Kỳ",          description: "Mở rộng túi đồ tối đa.",       reward: { gems: 20 } },
  { id: "high-roller",     title: "Con Bạc",              description: "Mở 1 Rương Bí Ẩn.",            reward: { gold: 500 } },
  { id: "philanthropist",  title: "Mạnh Thường Quân",     description: "Góp vàng vào Quỹ Guild.",      reward: { gems: 10 } },
  // Sprint 146 — achievements for crafting-loop & cosmetic features.
  { id: "salvager",        title: "Thợ Tháo Dỡ",          description: "Phân giải 1 trang bị thành nguyên liệu.", reward: { gems: 10 } },
  { id: "enchanter",       title: "Nghệ Nhân Tinh Luyện", description: "Tinh luyện 1 trang bị.",       reward: { gems: 10 } },
  { id: "fashionista",     title: "Tín Đồ Thời Trang",    description: "Trang bị 1 bộ trang phục.",    reward: { gold: 300 } },
  // Sprint 159 — achievements for the gear-deepening loop (S151-158).
  { id: "enhancer",        title: "Thợ Cường Hóa",        description: "Cường hóa trang bị thành công lần đầu.", reward: { gems: 10 } },
  { id: "recycler",        title: "Bậc Thầy Tái Chế",     description: "Phân giải hàng loạt trang bị.",          reward: { gems: 10 } },
  { id: "apex-smith",      title: "Thợ Rèn Thượng Thừa",  description: "Chế tạo 1 trang bị apex.",               reward: { gems: 15 } },
  // Sprint 179 — achievements for mounts / alchemy / arena streak.
  { id: "rider",           title: "Kỵ Sĩ Đường Trường",   description: "Tậu 1 thú cưỡi.",                        reward: { gems: 10 } },
  { id: "alchemist",       title: "Luyện Đan Sư",         description: "Luyện 1 bình thuốc.",                    reward: { gems: 10 } },
  { id: "streak-master",   title: "Chuỗi Bất Bại",        description: "Đạt chuỗi 5 hạ gục tại Đấu Trường.",    reward: { gems: 25 } },
  // Sprint 187 — achievements for gem socketing & fusion.
  { id: "jeweler",         title: "Thợ Kim Hoàn",         description: "Khảm 1 viên đá quý vào trang bị.",       reward: { gems: 10 } },
  { id: "fusionist",       title: "Bậc Thầy Hợp Nhất",    description: "Hợp nhất 3 trang bị Thường thành 1 Hiếm.", reward: { gems: 10 } },
  // Sprint 196 — collection completionist achievements.
  { id: "pet-collector",      title: "Nhà Sưu Thú",        description: "Sở hữu 6 linh thú.",   reward: { gems: 20 } },
  { id: "cosmetic-collector", title: "Tủ Đồ Hoành Tráng",  description: "Sở hữu 6 trang phục.", reward: { gems: 20 } },
  // Sprint 204 — mailbox achievement.
  { id: "pen-pal",         title: "Bưu Tá",              description: "Gửi 1 lá thư cho người chơi khác.",      reward: { gems: 10 } },
  // Sprint 217 — bestiary achievement.
  { id: "scholar",         title: "Học Giả Quái Vật",    description: "Đạt hạng Đồng một loại quái trong Sổ Tay.", reward: { gems: 10 } },
  // Sprint 224 — fishing achievements.
  { id: "angler",          title: "Cần Thủ",             description: "Câu được 10 con cá.",                       reward: { gems: 10 } },
  { id: "master-angler",   title: "Ngư Ông Đắc Lợi",     description: "Câu được 100 con cá.",                      reward: { gems: 25 } },
  { id: "giant-hunter",    title: "Săn Cá Khổng Lồ",     description: "Câu được CÁ KHỔNG LỒ huyền thoại.",         reward: { gems: 20 } },
  // Sprint 259 — achievements for the S225-243 loops.
  { id: "scratch-addict",  title: "Vua Vé Số",           description: "Cào 10 Vé Cào May Mắn.",                    reward: { gems: 10 } },
  { id: "story-hero",      title: "Anh Hùng Linh Vực",   description: "Hoàn thành toàn bộ chuỗi cốt truyện.",      reward: { gems: 20 } },
  { id: "piggy-breaker",   title: "Đập Heo Phát Tài",    description: "Đập Heo Đất lần đầu tiên.",                 reward: { gems: 5 } },
  // Sprint 273 — pet evolution achievement.
  { id: "evolver",         title: "Bậc Thầy Tiến Hoá",   description: "Tiến hoá 1 linh thú đạt cấp tối đa.",       reward: { gems: 20 } }
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
