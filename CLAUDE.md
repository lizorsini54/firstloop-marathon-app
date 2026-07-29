# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cadenza (repo/package names still say `firstloop-marathon-app` / `@firstloop/*` — not renamed) is a marathon training app: goal intake, a generated periodized training plan, session logging, and a dashboard showing planned vs. logged. Built as a technical work sample — code quality, test coverage, and a clean verification loop matter as much as features.

## Commands

```bash
# First-time setup
cp .env.example .env
docker compose up -d                              # Postgres only — apps run natively
bun install                                        # also runs packages/db's postinstall (prisma generate)
bun run --filter '@firstloop/db' db:migrate         # apply migrations locally
bun run --filter '@firstloop/db' db:seed            # seed demo data (see below)

# Day to day
bun run dev            # server (:3001) + web (:5173) together, via bun --filter
bun run check           # tsc -b && eslint . && knip && bun test — the pre-commit gate, must be clean
bun run typecheck        # tsc -b alone
bun run lint             # eslint . alone
bun run knip              # unused files/deps/exports alone
bun run test               # bun test alone (plan-engine's *.test.ts; dist/ excluded from discovery)

# Single test file
bun test packages/plan-engine/src/generate.test.ts

# Prisma (run from repo root; packages/db has no root-hoisted bin)
bun packages/db/node_modules/.bin/prisma studio --schema packages/db/prisma/schema.prisma
# or: bun run --filter '@firstloop/db' db:studio
```

**Never run `bunx prisma ...` directly** — it fetches the latest Prisma from the registry instead of the workspace's pinned v6, and the v7 schema format (`datasource { url = ... }` unsupported) breaks immediately. Always go through `packages/db`'s scripts (`db:migrate`, `db:deploy`, `db:generate`, `db:seed`) or the local binary path above.

The seed script (`packages/db/prisma/seed.ts`) hardcodes a specific Clerk test account's ID/email and generates ~8 weeks of realistic training history for it — see `DECISIONS.md` for why.

## Architecture

Bun workspaces monorepo, a strict one-way dependency graph:

```
packages/scheduling     — zero dependencies (generic day-placement primitive)
packages/plan-engine    — depends on scheduling only (not even @firstloop/db)
packages/strength-engine — depends on scheduling only
packages/db              — depends on plan-engine + strength-engine (seed script)
packages/contracts       — depends on db + plan-engine + strength-engine + @clerk/express
apps/server                — depends on contracts
apps/web                    — depends on contracts (type-only for the router; value-only for ./schemas/*)
                              and directly on plan-engine (live feasibility check on Intake)
```

**`packages/scheduling`** is the generic day-of-week placement primitive extracted from strength-engine's original scheduler (Checkpoint 11): `placeSlots(slots, availableDays, interferenceDays, minDaysBetweenGroupedSessions)` places a set of named `Slot`s (`respectsInterference`/`spacingGroup`) into a week, three-tier fallback (full spacing → interference-respecting → any day, never silently dropping a slot). Both `plan-engine` (run frequency) and `strength-engine` (lift session placement) call it — one placement algorithm, two independent callers with different data.

**`packages/plan-engine`** is the running-plan-generation logic: pure functions, no DB, no network. `generatePlan(intake)` implements base/build/peak/taper periodization and returns the full week-by-week workout schedule (long run + phase-appropriate quality/easy runs, placed via `@firstloop/scheduling`) plus any injury-related warnings. `estimateAvailableWeeks`/`checkFeasibility` are the timeline-feasibility check (a stated coaching judgment call, not hard science — see DECISIONS.md). Defines its own `WorkoutType` string-literal type rather than importing Prisma's enum (`DayOfWeek` now comes from `@firstloop/scheduling` instead) — kept genuinely standalone on purpose (see DECISIONS.md, Checkpoint 3) so it stays swappable and has no risk of pulling `packages/db` into any consumer's bundle.

**`packages/strength-engine`** is the strength-program logic, same "pure, swappable, zero DB dependency" shape as `plan-engine`: `scheduleStrengthSessions(program, weeks)` resolves each week's block (with a deload override when the running plan is tapering) and places that program's sessions via `@firstloop/scheduling`. `programs/glute-gladiator.ts` is the one real program (transcribed from `docs/strength-program.md`); `programs/custom.ts` builds a minimal synthetic program on the fly for "custom" strength mode — same scheduler, no second placement system.

**`packages/contracts`** is the shared typed contract: Zod schemas + an oRPC router, with the actual procedure handlers (including Prisma calls) living directly in `router.ts` rather than a separate contract-first layer. `apps/server` mounts the router as-is. `apps/web` only ever imports `AppRouter`'s *type* from the package root (`import type`), and imports individual Zod schemas *as values* from the `./schemas/*` subpath (`@firstloop/contracts/schemas/plan`) — never from the root barrel for a value import. The root barrel re-exports `router`, which imports `@firstloop/db`, whose `client.ts` instantiates a real `PrismaClient()` at module scope; a value import through the barrel risks that ending up in the browser bundle depending on tree-shaking. The `./schemas/*` subpath resolves straight to a schema file and never touches `router.ts`. This is a real constraint, not a style preference — see DECISIONS.md, Checkpoint 4, for how it was caught (verified by grepping the built client bundle).

Auth: `protectedProcedure` (in `procedures.ts`) wraps `publicProcedure` with middleware that throws `UNAUTHORIZED` if `context.auth` is missing. `context.auth` is populated per-request in `apps/server/src/index.ts` from Clerk's `getAuth(req)`. `getOrCreateUser` (`packages/contracts/src/lib/getOrCreateUser.ts`) does get-or-create-by-clerkId, fetching the user's email from Clerk's backend API on first creation (the `User` table's `email` is required but the auth context only carries `userId`).

**Data model** (`packages/db/prisma/schema.prisma`): `User` → `TrainingPlan` (raceDate, startDate, `config: Json` for intake inputs) → `PlannedWorkout` (weekNumber, day, type, `prescription: Json`). `SessionLog` belongs to `User` and optionally links to a `PlannedWorkout`. `config`/`prescription` are deliberately `Json` rather than normalized columns — the plan-generation module's exact shape was still evolving when the schema was written, and it keeps room for later additions (e.g. structured strength-set data) without a migration. One active plan per user: "most recent `TrainingPlan` wins," no multi-plan selection UI yet (tracked as an issue).

**Frontend routing**: public `/` (ping demo + sign-in) vs. protected routes (`/dashboard`, `/intake`, `/log`) wrapped in `RequireAuth` (redirects to `/` if signed out) and `AppShell` (persistent nav). The oRPC client (`apps/web/src/lib/orpc.ts`) is a module-level singleton; since Clerk's `getToken()` is only available inside React, a small `setClerkTokenGetter`/bridge pattern wires it into the client's `headers` callback for Bearer-token auth (not cookies — web and server can live on different domains).

**Local dev port note**: the server prefers `process.env.PORT` over `SERVER_PORT` (Railway injects `PORT`; this matters for local dev tooling that also sets `PORT`, e.g. some preview/proxy setups — use `env -u PORT bun run dev` if you hit a port collision locally).

**Deploy**: three independent Railway services (Postgres managed plugin, server, web) from this one repo, root directory `/` for both app services, build/start commands using `bun run --filter`. Migrations run at server *start* (not Railway's build step — build containers can't reach the internal network `*.railway.internal` hostnames). Full commands and gotchas are in `README.md`'s Deploy section.

## Testing

`bun test` (Bun's built-in runner, Jest-compatible API) — no Vitest. Unit tests live in `packages/scheduling`, `packages/plan-engine`, and `packages/strength-engine`; `packages/contracts/src/router.integration.test.ts` (Testcontainers, real Postgres) is excluded from the fast `bun run test` path and run separately via `bun run test:integration`. `dist/` is excluded from discovery via `--path-ignore-patterns` in the root `test` script, since `tsc -b`'s compiled output would otherwise get picked up alongside the source and silently double every test run.

## Decisions log

`DECISIONS.md` is a running log of every real architecture/scope decision, two lines each (what + why), grouped by checkpoint. Check it before assuming something is arbitrary — most non-obvious choices in this codebase (Json fields, the contracts export split, the plan-engine/db dependency direction, env var naming) are explained there with the actual reasoning and, often, the bug that prompted the decision.
