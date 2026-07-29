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

## Checkpoint 3

**Persistent nav shell (`AppShell`) added ahead of schedule**: discussed with the user before building — a public `/` vs. protected pages already needed structure, and future sections (nutrition, strength tracking) the user wants to add later get a slot to land in without a nav restructure. Cheap now, disruptive later.

**`packages/plan-engine` has zero dependencies, not even on `@firstloop/db`**: originally imported Prisma's `DayOfWeek`/`WorkoutType` enums for convenience. Adding the seed script (which needs both Prisma writes and `generatePlan()`) would have made that a circular workspace dependency (`db → plan-engine → db`). Fixed by having plan-engine define its own string-literal-union types that mirror the Prisma enums by value — genuinely standalone now, matching what "swappable module" was supposed to mean in the first place.

**One active plan per user, most-recent-wins**: `getDashboard`/`createPlan` don't do multi-plan selection UI. `TrainingPlan` is still one-to-many from `User` in the schema, so old plans aren't lost — just not surfaced yet. Simplest thing that works for a single-plan-at-a-time product today.

**Plan `startDate` truncated to midnight UTC at creation**: found via manual testing — `new Date()` (with time-of-day) as `startDate` combined with midnight-aligned session-log dates (from a plain `<input type="date">`) meant a session logged on a plan's creation day could fall *before* that plan's own week boundary and silently vanish from "this week." Both now align to day boundaries.

**Seed script hardcodes the demo user's email instead of calling Clerk's API**: avoids `packages/db` needing `@clerk/express`/`CLERK_SECRET_KEY` just to run a one-off script — the real `getOrCreateUser` path (used by every actual request) still fetches the authoritative email from Clerk on first real login.

## Checkpoint 4

**`packages/contracts` gets an explicit `exports` map with a `./schemas/*` subpath**: the intake form needed a real (value, not type) import of `createPlanInputSchema` for client-side validation. Importing anything through the main barrel (`@firstloop/contracts`) risks pulling in `router.ts` — which imports `@firstloop/db`, and `db`'s `client.ts` instantiates a real `PrismaClient()` at module scope. Whether a bundler tree-shakes that away is not something to gamble on for "does server code end up in the browser." The `./schemas/*` subpath resolves straight to a schema file, never touching `router.ts`. Verified by grepping the built client bundle for Prisma/Clerk-backend strings (zero matches).

**`packages/contracts`'s schemas no longer import Prisma enum values from `@firstloop/db`**: `session.ts`/`dashboard.ts` used `z.nativeEnum(WorkoutType)` from `@firstloop/db` — same PrismaClient-instantiation risk as above, since importing the enum meant loading `db`'s `client.ts` module. Replaced with local `z.enum([...])` schemas (`schemas/enums.ts`) mirroring the same values, same pattern already established for `packages/plan-engine`.

## Checkpoint 6

**Light is the primary, designed identity — not dark**: the app has no dark-mode toggle today and light is what a reviewer actually sees; dark tokens still extend the existing `.dark` scaffold via `prefers-color-scheme` for completeness, but weren't the design's starting point. Register: an instrument panel / GPS watch face, not a wellness app, for a persona (lifter + cyclist + first-time marathoner) who already lives inside training data.

**Signature element is a phase-arc, computed client-side, Dashboard-only**: `apps/web` now depends on `@firstloop/plan-engine` directly (previously server-only) to call `computePhaseBoundaries` — a pure, zero-dependency function — so the arc reflects each plan's actual base/build/peak/taper proportions instead of a hardcoded shape. No new data fetching; it lives only on Dashboard, not the nav shell, so `AppShell` stays presentational and doesn't need its own query.

**Three type roles (Big Shoulders Display / IBM Plex Sans / IBM Plex Mono), loaded via Google Fonts `<link>`**: deliberately not Inter or Space Grotesk. Numbers — mileage, pace, duration, RPE, dates — get their own monospaced, tabular register everywhere, distinct from prose; this was judged the single highest-leverage typographic decision for an app whose users already read a watch face all day.

**Log-a-run form got the token/type/layout system but not a full ShadCN rebuild**: full validation + component rebuild for that form is explicit Checkpoint 7 scope (closes issue #12). Checkpoint 6 restyled it in place (colors, type, focus states, Card wrapper) so it's visually consistent with everything else in the meantime, without front-running the next checkpoint's work.

## Checkpoint 7

**Session history is a real `/history` page, not just a polished weekly list**: the brief's "session history view" was ambiguous between styling the existing "Logged this week" list and building actual multi-week browsing. Asked the user directly — they chose the full page. New `getSessionHistory` procedure returns all of a user's session logs, most recent first, no pagination (data volume for one runner's training cycle doesn't need it). This meaningfully overlaps with issue #11 (dashboard only shows the current week) but doesn't close it — #11 is also about browsing *planned* past/future weeks, which this doesn't touch, so it's left open with a progress comment instead of closed.

**Dashboard's weekly mileage chart extends `getDashboard` instead of adding a new procedure**: planned-vs-actual turned out to be a clean lift — `prescription.distanceMiles` already exists per planned workout, and the data's one query away from what Dashboard already fetches on mount. Returns the full `1..totalWeeks` array (not just weeks-so-far) so the chart shows the whole planned arc with actuals filling in as weeks pass, consistent with how PhaseArc already shows the whole plan's shape rather than just "so far."

**New test types (Testcontainers, Playwright) stay out of `bun run check`, but are still CI-required**: both add real external dependencies — Testcontainers needs Docker, Playwright needs the whole app running — that would slow down every local check. Added as separate `test:integration`/`test:e2e` scripts and separate `integration`/`e2e` CI jobs alongside `check`, all three required in branch protection. `bun run check` keeps doing exactly what it did before.

**Testcontainers integration test uses dynamic imports, not static ones**: `@firstloop/db`'s Prisma client is a module-scope singleton built from `DATABASE_URL` at import time. Since Testcontainers only knows the container's port after it starts, the test starts the container first, sets `DATABASE_URL`, *then* dynamically `import()`s `@firstloop/db`/`@firstloop/contracts` so the singleton picks up the right connection string. Also mocks `@clerk/express`'s `clerkClient.users.getUser` via `bun:test`'s `mock.module`, so `getOrCreateUser`'s create path is exercised for real without the test suite depending on live Clerk network calls — same principle already planned for Checkpoint 9's AI Coach mock.

**Playwright's e2e test lives in a root-level `e2e/` directory with its own `tsconfig.json`, not nested under `apps/web`**: it exercises the whole integrated system (server + web + Postgres + Clerk), not one package, so it doesn't belong to any single workspace. The dedicated `e2e/tsconfig.json` (and moving `playwright.config.ts` into `e2e/`) was also a practical fix — Playwright's own TS loader couldn't resolve the root `tsconfig.json`'s solution-style project references the way `tsc -b` does, and choked trying. Auth uses `@clerk/testing`'s official Playwright helpers (ticket-based sign-in by email against the existing dev Clerk instance) rather than driving the interactive sign-in modal.

**Playwright test asserts on a per-run-unique duration value, not notes text**: first attempt used a unique marker string in the session's `notes` field, but neither Dashboard nor History render `notes` at all, so the assertion could never find it. Switched to a duration value derived from `Date.now()`, which *is* rendered — and made it unique per run (not a fixed constant) after discovering a fixed value collided with itself on a second local run against the same persistent dev database, since Playwright's `webServer` reuses whatever's already running locally rather than a fresh DB per run like CI gets.

## Checkpoint 8

**Attempted a pre-prod/prod split, reverted it — staying on a single Railway environment**: built out the repo/CI side (a `prod` branch, matching branch protection, a CI push trigger, Railway-Environments-vs-Clerk-instance-split decisions logged and later refined) before discovering Railway requires a paid plan to run a second environment. Decided against paying for a second environment purely to demonstrate the pattern on a take-home project — the cost isn't justified by what it'd prove here. Reverted the `prod` branch, its branch protection, and the CI trigger change; this project deploys to the one Railway environment that's been live since Checkpoint 3, tracking `main`, and stays that way going forward. A real, plain engineering tradeoff: infrastructure cost vs. a nice-to-have pattern that doesn't change what the project demonstrates.

## Checkpoint 9

**Strength scheduling lives in its own zero-dependency package, `packages/strength-engine`, not folded into `plan-engine`**: mirrors `plan-engine`'s exact design (pure functions, no DB, program defined as swappable data) for the same reason — a future different program is a data change, not a rewrite. It doesn't import `plan-engine`'s types either; the scheduler takes a plain `WeekContext` shape, so it stays a genuinely generic "place a program's sessions around fixed days" capability, not code specific to Glute Gladiator.

**"Down/deload week" maps to the running plan's existing `taper` phase**: discussed with the user before building. Plan-engine has no periodic within-block cutback-week concept (mileage grows monotonically through base/build, holds at peak, then tapers) — adding one would touch working, already-tested running-plan behavior just to serve strength scheduling. Taper is a real, already-computed reduced-load signal, so the scheduler keys off that instead.

**Strength sessions claim REST-day placeholders, never RUN or BIKE days**: `generatePlan` already fills every day of the week (RUN, then BIKE, then REST catches whatever's left) — removing the old naive `liftDaysPerWeek`-driven LIFT block just means REST fills those days instead. The orchestration in `createPlan` treats each week's REST rows as the scheduler's available slots and drops any REST row the scheduler actually claims before persisting, so RUN/BIKE days are never touched.

**`liftDaysPerWeek` removed from `PlanIntake`/the intake form entirely**: once a real program dictates its own weekly session count and structure, a user-chosen lift-day count doesn't mean anything anymore — same reasoning the app already applies to running (nobody picks "how many quality-run days," that's derived from phase). Every generated plan now includes the strength program automatically.

**Found via verification, not by inspection: the interference rule was silently dropping Lower A for the entire peak phase.** Spot-checking seeded data (not just unit tests) showed weeks 31–36 scheduling only 2 of the reduced 3 sessions, every single week — Upper A and Upper B, never Lower A. Root cause: this plan's specific day layout (quality runs Wed/Fri, long run Sun) leaves only Tue/Thu/Sat open during peak weeks, and all three sit immediately before a run day, so the interference rule (never place a lower session the day before a quality/long run) had no legal day to place Lower A on at all — and the scheduler's original fallback logic just dropped the session rather than degrade the rule. Fixed by adding a third fallback tier: prefer full spacing, then prefer any interference-respecting day, and only as a last resort place on the least-bad day regardless of interference — because the source program's own peak-week rule explicitly keeps Lower A in the reduced set, so silently disappearing it for six straight weeks was further from the doc's intent than the fallback is. Added a regression test for this exact scenario. This is the kind of gap that unit tests alone (synthetic, individually-reasonable week contexts) don't catch — it only showed up once real data was eyeballed across a full plan.

**Two exercises share "(block reps)" in the source doc, only one is the session's "primary" lift**: Lower A lists both Barbell Hip Thrust (explicitly "the primary progression lift") and Barbell RDL as `(block reps)`, but only Hip Thrust's notes call it primary. Modeled both as `usesBlockReps: true` (their reps resolve from the block's `mainLiftReps` at generation time) while reserving `isMainLift` for the one exercise per session the doc explicitly names — a literal reading of what's actually in the table rather than assuming "block reps" and "primary lift" are the same thing.

**Session drop order beyond the documented 4→3 cut is inferred, not specified**: the doc explicitly says Lower B drops first when cutting to 3 sessions during peak weeks, but says nothing about a deeper cut. `sessionDropOrder` in the program data continues past that point as a reasonable fallback (kept in code as an explicit "not a documented rule" comment) rather than leaving the scheduler with no defined behavior if it's ever needed.

## Post-Checkpoint-9 fix: three strength modes on intake

**`SessionTemplate.isLowerBody` split into `respectsInterference` + `spacingGroup`**: product review asked for a "custom" strength mode that respects the interference rule (no session the day before a quality/long run) but explicitly skips the 48-hour lower-body spacing rule, since we don't know which of a user's own sessions are lower-body-heavy. One boolean couldn't express "needs interference avoidance but not spacing" — Glute Gladiator happened to need both together for the same sessions, which is what let `isLowerBody` get away with doing two jobs at once. Decoupled them properly (spacing keyed by an optional group name, multiple sessions can share a group via `Map<string, number[]>`) rather than a same-boolean workaround, so "feed the same generic scheduler a minimal synthetic program" is actually true, not just true for Glute Gladiator. `SessionName` also widened from a literal union naming Glute Gladiator's four sessions to a plain `string` — a "generic" scheduler hardcoding one program's session names in its type was already a smell, custom mode just made it obviously wrong.

**Custom mode is a data trick, not a second scheduler**: `buildCustomProgram(n)` produces N sessions with `respectsInterference: true`, no `spacingGroup` (so the existing spacing check is trivially always-satisfied — nothing to compare against), `exercises: []`, and a 1-week cycle with no real block progression. Fed through the exact same `scheduleStrengthSessions` Checkpoint 9 built. No peak-mileage cutback (`fullSessionCount === reducedSessionCount`), matching how `bikeDaysPerWeek` already behaves — bike doesn't reduce during peak weeks either, so custom lifting shouldn't either.

**Verified, not assumed: Dashboard already showed real session names/exercise counts, not generic "Lift" placeholders** — this was built correctly in Checkpoint 9 and confirmed again here by reading the code before claiming it either way. What building custom mode *did* surface: `describePrescription`'s exercises check was truthy for an empty array (would've shown "Lift session · 0 exercises," reading like a bug even though it's real data), and `LogSession`'s initial `type` field was derived from whether the linked prescription had exercises rather than the actual workout type — a custom lift session (no exercises) would have silently defaulted the form to "Run." Both fixed; both would only have shown up once custom mode existed to exercise them.
