import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@mmorpg/shared";
import { GameWorld } from "./game/GameWorld.js";
import { PlayerRepository } from "./db/PlayerRepository.js";
import { createPool } from "./db/pool.js";

const port = Number(process.env.PORT ?? 3000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

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
