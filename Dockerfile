# Multi-stage Dockerfile for Eternal Path / Linh Vực
# Builds shared + server + client and serves them from a single container.
# Exposes :3000 for Socket.IO + a static file server for the built client.

FROM node:24-alpine AS builder
WORKDIR /app

# Copy workspace package files first for better layer caching.
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --workspaces --include-workspace-root

# Copy source code.
COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build

# ──────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Bring over the compiled artifacts + node_modules.
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Persist player data across container restarts.
VOLUME ["/app/data"]
ENV MEMORY_SAVE_PATH=/app/data/saves.json

# Static file server for built client + Socket.IO are both on PORT.
EXPOSE 3000

CMD ["node", "server/dist/index.js"]
