# Decisions

Architecture and scope decisions, in the order they were made. Two lines each: what, why.

## Checkpoint 1

**Contract sharing pattern**: oRPC router is defined directly in `packages/contracts` (procedures + handlers together), not split into a separate contract-first layer. `apps/web` imports the router's type only (`import type`), so server code never reaches the frontend bundle — simplest path to full type safety, mirrors tRPC's ergonomics.

**Docker Compose scope**: only Postgres runs in Docker locally; `apps/server` and `apps/web` run natively via `bun run dev`. Matches how Railway will run them as three separate native services, so no Dockerfiles are needed until deploy.

**Typecheck strategy**: per-package `tsconfig.json`s use TS project references (`composite: true`), so a single root `tsc -b` incrementally typechecks every workspace and catches cross-package breaks.

**`TrainingPlan.config` / `PlannedWorkout.prescription` as `Json`, not `String`**: keeps the schema flexible while the plan-generation module's exact shape is still being designed (Checkpoint 3+), avoiding a migration when it settles.

**`PlannedWorkout.day` and `*.type` fields as Prisma enums, not free strings**: compile-time safety for the plan-generation logic. Actual calendar date is derived from `startDate + week + day`, never stored directly.

**Unit test runner: `bun test`, no Vitest**: the stack is already Bun-native; avoids an extra dependency for behavior Bun already provides.
