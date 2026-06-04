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
const world = new GameWorld(io, repository);
world.start();

io.on("connection", (socket) => {
  world.connect(socket);
});

server.listen(port, () => {
  console.log(`MMORPG server listening on http://localhost:${port}`);
});
