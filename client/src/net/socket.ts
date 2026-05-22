import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mmorpg/shared";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): GameSocket {
  // Default to the host that served the page (so LAN players connect to the
  // host machine, not their own localhost). Override with VITE_SERVER_URL.
  const fallback = `${window.location.protocol}//${window.location.hostname}:3000`;
  const serverUrl = import.meta.env.VITE_SERVER_URL ?? fallback;
  return io(serverUrl, { autoConnect: true });
}
