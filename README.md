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

See [DECISIONS.md](./DECISIONS.md) for architecture decisions and their rationale.
