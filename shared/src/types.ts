export type Direction = "up" | "down" | "left" | "right";

export type Rarity = "common" | "rare" | "epic";

export type EquipmentSlot = "weapon" | "helmet" | "armor" | "boots" | "ring";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Stats {
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  level: number;
  gold: number;
}

export interface ItemStats {
  attack?: number;
  defense?: number;
  maxHp?: number;
}

export interface Item {
  id: string;
  name: string;
  rarity: Rarity;
  slot: EquipmentSlot;
  stats: ItemStats;
  value: number;
}

export interface InventoryState {
  items: Item[];
  equipped: Partial<Record<EquipmentSlot, Item>>;
}

export interface PlayerState {
  id: string;
  email: string;
  accountName: string;
  position: Vec2;
  velocity: Vec2;
  facing: Direction;
  stats: Stats;
  inventory: InventoryState;
  lastAttackAt: number;
  targetId?: string;
}

export interface MonsterState {
  id: string;
  type: string;
  name: string;
  position: Vec2;
  velocity: Vec2;
  spawn: Vec2;
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  aggroRadius: number;
  leashRadius: number;
  targetPlayerId?: string;
  respawnsAt?: number;
  lastAttackAt: number;
}

export interface FloatingTextEvent {
  id: string;
  entityId: string;
  position: Vec2;
  amount: number;
  kind: "damage" | "heal" | "exp" | "level" | "loot";
  text?: string;
}

export interface LootEvent {
  playerId: string;
  gold: number;
  item?: Item;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  accountName: string;
  message: string;
  sentAt: number;
}

export interface ShopItem extends Item {
  shopId: string;
}

export interface GroundItem {
  id: string;
  item: Item;
  position: Vec2;
  droppedBy: string;
  createdAt: number;
}

export interface WorldSnapshot {
  serverTime: number;
  players: PlayerState[];
  monsters: MonsterState[];
  groundItems: GroundItem[];
}

export interface ClientInput {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  moveTarget?: Vec2;
}

export interface LoginPayload {
  email: string;
  accountName?: string;
}

export interface EquipItemPayload {
  itemId: string;
}

export interface TargetMonsterPayload {
  monsterId?: string;
}

export interface TargetPlayerPayload {
  playerId?: string;
}

export interface ChatPayload {
  message: string;
}

export interface ServerToClientEvents {
  init: (data: { selfId: string; snapshot: WorldSnapshot }) => void;
  snapshot: (snapshot: WorldSnapshot) => void;
  player: (player: PlayerState) => void;
  floatingText: (event: FloatingTextEvent) => void;
  loot: (event: LootEvent) => void;
  chatHistory: (messages: ChatMessage[]) => void;
  chatMessage: (message: ChatMessage) => void;
  shopStock: (items: ShopItem[]) => void;
  system: (message: string) => void;
}

export interface ClientToServerEvents {
  login: (payload: LoginPayload) => void;
  input: (input: ClientInput) => void;
  setAutoRetarget: (payload: { enabled: boolean }) => void;
  equipItem: (payload: EquipItemPayload) => void;
  unequipItem: (payload: { slot: EquipmentSlot }) => void;
  targetMonster: (payload: TargetMonsterPayload) => void;
  targetPlayer: (payload: TargetPlayerPayload) => void;
  buyShopItem: (payload: { shopId: string }) => void;
  sellItem: (payload: { itemId: string }) => void;
  dropItem: (payload: { itemId: string }) => void;
  pickupGroundItem: (payload: { groundItemId: string }) => void;
  chatMessage: (payload: ChatPayload) => void;
}
