import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "node:http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@mmorpg/shared";
import { GameWorld } from "./game/GameWorld.js";
import { PlayerRepository } from "./db/PlayerRepository.js";
import { createPool } from "./db/pool.js";

const port = Number(process.env.PORT ?? 3000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "*";

const app = express();
app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Serve the built client when the dist/ folder is present (production
// container or single-port deploy). Vite still handles the dev server.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/socket.io") || req.path === "/health") return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`[server] Serving client from ${clientDist}`);
}

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: clientOrigin }
});

const repository = new PlayerRepository(createPool());

// Sprint 302: channel sharding — several independent worlds in one process.
// Players pick a channel via the Socket.IO handshake query (default 1);
// guild/market/mail stores stay global, world state is per channel.
const channelCount = Math.max(1, Math.min(16, Number(process.env.CHANNELS ?? 2)));
const worlds = new Map<number, GameWorld>();
for (let channel = 1; channel <= channelCount; channel += 1) {
  const world = new GameWorld(io, repository, channel);
  world.start();
  worlds.set(channel, world);
}
console.log(`[server] ${channelCount} channel(s) online`);

io.on("connection", (socket) => {
  const requested = Number((socket.handshake.query?.channel as string) ?? 1);
  const channel = worlds.has(requested) ? requested : 1;
  worlds.get(channel)!.connect(socket);
});

server.listen(port, () => {
  console.log(`MMORPG server listening on http://localhost:${port}`);
});
