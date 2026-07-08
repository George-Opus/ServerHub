import type { Server } from "@/lib/api";

export function serverUnits(server: Server): number {
  return Math.max(1, server.rack_units ?? 1);
}

/** U positions occupied by a server (rack_u = lowest U). */
export function occupiedSlots(server: Server): number[] {
  if (!server.rack_u) return [];
  const units = serverUnits(server);
  return Array.from({ length: units }, (_, i) => server.rack_u! + i);
}

export function serverAtSlot(servers: Server[], u: number): Server | null {
  return (
    servers.find((s) => {
      if (!s.rack_u) return false;
      const end = s.rack_u + serverUnits(s) - 1;
      return u >= s.rack_u && u <= end;
    }) ?? null
  );
}

/** Highest U index of the server (visual top in rack column). */
export function serverTopU(server: Server): number {
  return server.rack_u! + serverUnits(server) - 1;
}

export function canPlaceAt(
  servers: Server[],
  u: number,
  units: number,
  capacity: number,
  excludeServerId?: number,
): boolean {
  if (u < 1 || u + units - 1 > capacity) return false;
  const requested = new Set(Array.from({ length: units }, (_, i) => u + i));
  for (const s of servers) {
    if (s.id === excludeServerId || !s.rack_u) continue;
    for (const slot of occupiedSlots(s)) {
      if (requested.has(slot)) return false;
    }
  }
  return true;
}
