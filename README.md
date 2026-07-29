# FirstLoop — marathon training app

Technical work sample. Bun workspaces monorepo: Express + Prisma/Postgres backend, Vite/React frontend, Zod + oRPC as the shared typed contract.

## Local development

```bash
cp .env.example .env
docker compose up -d
bun install
bun run --filter '@firstloop/db' db:migrate
bun run dev
```

Web app: http://localhost:5173
Server: http://localhost:3001

## Verification

```bash
bun run check   # tsc -b + eslint + knip
```

CI runs the same check on every PR and is required to merge into `main`.

## Deploy (Railway)

Three services, deployed from this repo with **Root Directory** left at `/` for both app services (build/start commands use Bun workspace filters from the repo root):

| Service | Build Command | Start Command |
|---|---|---|
| Postgres | — (managed plugin) | — |
| server | *(none — default install only)* | `bun packages/db/node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma && bun run --filter '@firstloop/server' start` |
| web | `bun install && bun run --filter '@firstloop/web' build` | `bun run --filter '@firstloop/web' start` |

Notes:
- Migrations run at server **start**, not build — Railway's build containers can't reach `*.railway.internal` (private network is runtime-only).
- `bunx prisma` fetches the latest Prisma from the registry, not the workspace's pinned version — use `packages/db/node_modules/.bin/prisma` directly (or `bun run --filter '@firstloop/db' db:deploy`).
- `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY` on the web service are baked in at **build** time, not runtime — set them before the first build.
- `WEB_ORIGIN` (server) and `VITE_API_URL` (web) both need the full URL **including scheme** (`https://...`) — Railway's dashboard displays domains without it, and pasting the bare domain silently breaks CORS / URL parsing.

See [DECISIONS.md](./DECISIONS.md) for architecture decisions and their rationale.
