// Mount system (Sprint 172): gold-bought rides that grant a permanent move-
// speed bonus while active. A pure gold sink with a movement-QoL payoff.
export interface MountDef {
  id: string;
  name: string;
  desc: string;
  /** Move-speed bonus percentage while this mount is active. */
  speedPct: number;
  goldPrice: number;
  /** Tint (hex int) for the little mount sprite. */
  color: number;
}

export const MOUNT_CATALOG: MountDef[] = [
  { id: "pony", name: "Ngựa Con", desc: "+15% tốc chạy", speedPct: 15, goldPrice: 15_000, color: 0xc9a36a },
  { id: "warhorse", name: "Chiến Mã", desc: "+25% tốc chạy", speedPct: 25, goldPrice: 50_000, color: 0x8a6b4a },
  { id: "direwolf", name: "Lang Vương", desc: "+35% tốc chạy", speedPct: 35, goldPrice: 120_000, color: 0x6a7a8a }
];

const MOUNT_BY_ID = new Map(MOUNT_CATALOG.map((m) => [m.id, m]));
export function getMount(id: string | undefined): MountDef | undefined {
  return id ? MOUNT_BY_ID.get(id) : undefined;
}
export function mountSpeedBonus(activeMount: string | undefined): number {
  return getMount(activeMount)?.speedPct ?? 0;
}
export function mountLabel(id: string | undefined): string | undefined {
  return getMount(id)?.name;
}
