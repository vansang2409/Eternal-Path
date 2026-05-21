import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mmorpg/shared";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): GameSocket {
  const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";
  return io(serverUrl, { autoConnect: true });
}
