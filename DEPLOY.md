# Deploying Eternal Path

Single-port deploy: the production server hosts the Socket.IO game **and** serves the built client on the same port (default 3000).

## Quick start with Docker

```bash
# Build and run locally
docker compose up -d --build

# Open the game
open http://localhost:3000
```

Player saves persist to a Docker named volume `eternal-path-data` (mounted at `/app/data` inside the container). To back up:

```bash
docker run --rm -v eternal-path-data:/data -v $PWD:/backup busybox tar czf /backup/saves-backup.tar.gz /data
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | Port the HTTP server listens on |
| `CLIENT_ORIGIN` | `*` | CORS allow-list; lock this down in production |
| `DATABASE_URL` | (unset) | Postgres connection string. If unset the server uses file-based saves at `MEMORY_SAVE_PATH` |
| `MEMORY_SAVE_PATH` | `data/saves.json` | Where to persist the in-memory store between restarts |

## Deploying to free hosts

### Railway

1. Connect the GitHub repo.
2. Add a new service from the repo root — Railway will use the Dockerfile.
3. Set env vars (above). For persistent saves add a volume mounted at `/app/data`.
4. Set the public port to the Railway-injected `$PORT` value — `process.env.PORT` already honours it.

### Fly.io

1. Install `flyctl` and run `fly launch --no-deploy`. Accept the existing Dockerfile.
2. Add a persistent volume: `fly volumes create data --size 1`.
3. Set `MEMORY_SAVE_PATH=/data/saves.json` so the game writes to the mount.
4. `fly deploy`.

### Render

1. New → Web Service → connect repo.
2. Runtime: Docker. Default port 3000.
3. Add a disk mounted at `/app/data` for persistence.

## Switching to Postgres

Uncomment the `db` service in `docker-compose.yml` and the `DATABASE_URL` line in the `game` service. Existing JSON saves are not auto-migrated — restart with an empty database.

## Public origin checklist

When you deploy publicly, set:

- `CLIENT_ORIGIN=https://your-domain.tld`
- `NODE_ENV=production`
- Lock down anonymous registrations if abuse becomes an issue (the auth flow currently creates new accounts on first login).
- Put a CDN / reverse proxy in front (Cloudflare is fine — make sure WebSockets are enabled on the proxy).

## Health check

`GET /health` returns `{"ok": true, "uptime": <seconds>}`. Use this in your container orchestrator's healthcheck.
