# Decisions

Architecture and scope decisions, in the order they were made. Two lines each: what, why.

## Checkpoint 1

**Contract sharing pattern**: oRPC router is defined directly in `packages/contracts` (procedures + handlers together), not split into a separate contract-first layer. `apps/web` imports the router's type only (`import type`), so server code never reaches the frontend bundle — simplest path to full type safety, mirrors tRPC's ergonomics.

**Docker Compose scope**: only Postgres runs in Docker locally; `apps/server` and `apps/web` run natively via `bun run dev`. Matches how Railway will run them as three separate native services, so no Dockerfiles are needed until deploy.

**Typecheck strategy**: per-package `tsconfig.json`s use TS project references (`composite: true`), so a single root `tsc -b` incrementally typechecks every workspace and catches cross-package breaks.

**`TrainingPlan.config` / `PlannedWorkout.prescription` as `Json`, not `String`**: keeps the schema flexible while the plan-generation module's exact shape is still being designed (Checkpoint 3+), avoiding a migration when it settles.

**`PlannedWorkout.day` and `*.type` fields as Prisma enums, not free strings**: compile-time safety for the plan-generation logic. Actual calendar date is derived from `startDate + week + day`, never stored directly.

**Unit test runner: `bun test`, no Vitest**: the stack is already Bun-native; avoids an extra dependency for behavior Bun already provides.

## Checkpoint 2

**GitHub repo made public**: GitHub Free doesn't allow required status checks (branch protection or rulesets) on private repos. Confirmed with the user; also reasonable for a work sample meant to be shared with an interviewer.

**CI runs `bun run check` only, no DB service**: `tsc`/`eslint`/`knip` never touch Postgres. DB-backed tests (Checkpoint 4) will use Testcontainers, which spin up their own ephemeral Postgres rather than a shared CI service container.

**Prisma client generation moved to a `postinstall` hook** (`packages/db/package.json`): CI does a from-scratch `bun install` with no prior `migrate dev` step, so `@prisma/client`'s types silently fell back to `any` until generated — caught by CI failing on `packages/db/src/client.ts`, not locally, since local `node_modules` already had a generated client from Checkpoint 1.

**Auth transport: Bearer token, not cookies**: the web and server will live on different Railway domains, so a header-based token (via Clerk's `getToken()`, bridged into the oRPC client's `headers` callback) avoids cross-origin cookie/`credentials` complexity entirely.

**Reusable `protectedProcedure` middleware** (`packages/contracts/src/procedures.ts`) over ad hoc per-procedure auth checks: uses oRPC's `os.$context<AppContext>()` + `.use()` to throw `UNAUTHORIZED` once, centrally, so Checkpoint 3's real procedures (`createPlan`, `logSession`) just extend `protectedProcedure` instead of re-checking `context.auth` everywhere.

**`me` procedure returns only the Clerk `userId`, no DB lookup**: syncing Clerk users into the `User` table (get-or-create by `clerkId`) happens naturally in Checkpoint 3 when `createPlan` first needs a real `userId` FK — doing it now would be speculative.

**`react-router-dom` for client-side routing**: introduced now because a public `/` vs. protected `/dashboard` split needs distinct URLs, and Checkpoint 3 adds more pages regardless.

**`db:deploy` script instead of `bunx prisma migrate deploy`**: `bunx prisma` from the repo root fetched a fresh latest Prisma (v7, breaking schema-format change) rather than the workspace's pinned v6 devDependency. `bun run --filter '@firstloop/db' db:deploy` resolves the local pinned binary correctly.

**Prisma migration runs at server *start*, not Railway's build step**: Railway's build containers can't reach `*.railway.internal` hostnames — that private network is only available to running/deployed services. `prisma migrate deploy` is chained into the server's start command instead; it's idempotent (no-ops with no pending migrations), so this is safe on every deploy.

**Server listens on `PORT` (Railway's convention) falling back to `SERVER_PORT`**: added `PORT` as an optional env var that wins when present; `SERVER_PORT` stays the local-only default so it doesn't collide with tooling that injects its own `PORT` for local preview.
