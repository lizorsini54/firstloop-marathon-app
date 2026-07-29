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

One Railway project, two **environments** — pre-prod (tracks `main`) and prod (tracks `prod`) — each with its own three services and its own Postgres instance. Both environments use the same **Root Directory** (`/`) and commands for the app services (build/start use Bun workspace filters from the repo root):

| Service | Build Command | Start Command |
|---|---|---|
| Postgres | — (managed plugin, one instance per environment) | — |
| server | *(none — default install only)* | `bun packages/db/node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma && bun run --filter '@firstloop/server' start` |
| web | `bun install && bun run --filter '@firstloop/web' build` | `bun run --filter '@firstloop/web' start` |

Notes:
- Migrations run at server **start**, not build — Railway's build containers can't reach `*.railway.internal` (private network is runtime-only).
- `bunx prisma` fetches the latest Prisma from the registry, not the workspace's pinned version — use `packages/db/node_modules/.bin/prisma` directly (or `bun run --filter '@firstloop/db' db:deploy`).
- `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY` on the web service are baked in at **build** time, not runtime — set them before the first build.
- `WEB_ORIGIN` (server) and `VITE_API_URL` (web) both need the full URL **including scheme** (`https://...`) — Railway's dashboard displays domains without it, and pasting the bare domain silently breaks CORS / URL parsing.
- Pre-prod and prod use **separate Clerk applications**, not just separate keys within one app — prod's user pool stays clean of pre-prod's test/seed accounts. Each environment's `CLERK_SECRET_KEY`/`CLERK_PUBLISHABLE_KEY`/`VITE_CLERK_PUBLISHABLE_KEY` point at its own Clerk app.
- Promotion flow: land changes on `main` (pre-prod, auto-deploys, CI-gated), verify there, then open a PR from `main` into `prod` — `prod` has the same required-checks branch protection as `main`, and merging triggers prod's own deploy.

See [DECISIONS.md](./DECISIONS.md) for architecture decisions and their rationale.
