import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Exercises createPlan/logSession against a real Postgres (via Testcontainers),
 * not mocks. The Prisma client in @firstloop/db is a module-scope singleton
 * built from process.env.DATABASE_URL at import time, so the container must
 * be up and DATABASE_URL set *before* any of these packages are imported —
 * hence the dynamic imports below instead of static top-level ones.
 */

let container: StartedPostgreSqlContainer;
let call: (typeof import("@orpc/server"))["call"];
let router: (typeof import("./router"))["router"];
let prisma: (typeof import("@firstloop/db"))["prisma"];

const CLERK_ID_NEW = "clerk_test_new_user";
const CLERK_ID_EXISTING = "clerk_test_existing_user";

function emailFor(clerkId: string) {
  return `${clerkId}@example.test`;
}

let getUserCalls = 0;

beforeAll(async () => {
  const dbRoot = path.resolve(import.meta.dir, "../../db");
  const packageRoot = path.resolve(import.meta.dir, "..");

  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = container.getConnectionUri();

  const migrate = spawnSync(path.join(dbRoot, "node_modules/.bin/prisma"), ["migrate", "deploy"], {
    cwd: dbRoot,
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    encoding: "utf-8",
  });
  if (migrate.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${migrate.stdout}\n${migrate.stderr}`);
  }

  void mock.module("@clerk/express", () => ({
    clerkClient: {
      users: {
        getUser: (clerkId: string) => {
          getUserCalls++;
          return Promise.resolve({
            id: clerkId,
            primaryEmailAddress: { emailAddress: emailFor(clerkId) },
            emailAddresses: [{ emailAddress: emailFor(clerkId) }],
          });
        },
      },
    },
  }));

  ({ call } = await import("@orpc/server"));
  ({ prisma } = await import("@firstloop/db"));
  const routerModule = (await import(path.join(packageRoot, "src/router.ts"))) as typeof import(
    "./router"
  );
  ({ router } = routerModule);
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
});

describe("getOrCreateUser (via createPlan)", () => {
  test("creates a new user from the Clerk profile on first use", async () => {
    const before = getUserCalls;

    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "program",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: CLERK_ID_NEW } } },
    );

    expect(getUserCalls).toBe(before + 1);
    const user = await prisma.user.findUnique({ where: { clerkId: CLERK_ID_NEW } });
    expect(user?.email).toBe(emailFor(CLERK_ID_NEW));
  });

  test("reuses an existing user without calling Clerk again", async () => {
    await prisma.user.create({
      data: { clerkId: CLERK_ID_EXISTING, email: "existing@example.test" },
    });
    const before = getUserCalls;

    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 15,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "program",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: CLERK_ID_EXISTING } } },
    );

    expect(getUserCalls).toBe(before);
  });
});

describe("createPlan -> logSession", () => {
  test("a session logged the same day the plan is created lands in week 1", async () => {
    // Regression guard for the Checkpoint 3 bug: plan.startDate must be
    // midnight-UTC-aligned with session dates, or a same-day log falls
    // before the plan's own week-1 start and silently drops out of "this week."
    const clerkId = "clerk_test_alignment";
    const created = await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "program",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: clerkId } } },
    );

    await call(
      router.logSession,
      {
        date: new Date(),
        type: "RUN",
        distanceMiles: 5,
        durationMin: 45,
        rpe: 6,
      },
      { context: { auth: { userId: clerkId } } },
    );

    const dashboard = await call(
      router.getDashboard,
      undefined,
      { context: { auth: { userId: clerkId } } },
    );

    expect(dashboard.plan?.id).toBe(created.planId);
    expect(dashboard.plan?.currentWeek).toBe(1);
    expect(dashboard.sessionLogs).toHaveLength(1);
    expect(dashboard.weeklyMileageTotal).toBe(5);
  });
});

describe("createPlan strengthMode", () => {
  test("custom mode generates the requested number of unprescribed LIFT sessions", async () => {
    const clerkId = "clerk_test_strength_custom";
    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "custom",
        customLiftDaysPerWeek: 2,
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: clerkId } } },
    );

    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId: clerkId } },
    });

    const liftWorkouts = dashboard.plannedWorkouts.filter((w) => w.type === "LIFT");
    expect(liftWorkouts).toHaveLength(2);
    for (const w of liftWorkouts) {
      expect(w.prescription.exercises).toEqual([]);
    }
  });

  test("none mode generates no LIFT sessions at all", async () => {
    const clerkId = "clerk_test_strength_none";
    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "none",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: clerkId } } },
    );

    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId: clerkId } },
    });

    expect(dashboard.plannedWorkouts.some((w) => w.type === "LIFT")).toBe(false);
  });
});

describe("getPlanOverview", () => {
  test("returns every PlannedWorkout row for the active plan, grouped by week", async () => {
    const clerkId = "clerk_test_plan_overview";
    const created = await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "program",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: clerkId } } },
    );

    const overview = await call(router.getPlanOverview, undefined, {
      context: { auth: { userId: clerkId } },
    });

    expect(overview.plan?.id).toBe(created.planId);
    expect(overview.weeks).toHaveLength(created.totalWeeks);

    const week1 = overview.weeks.find((w) => w.weekNumber === 1);
    expect(week1?.workouts).toHaveLength(7);

    const allWorkouts = overview.weeks.flatMap((w) => w.workouts);
    expect(allWorkouts.some((w) => w.type === "RUN" && w.prescription.quality === "long")).toBe(true);
    // Program mode was requested, so LIFT rows (Glute Gladiator) should show
    // up somewhere across the plan, same as running does.
    expect(allWorkouts.some((w) => w.type === "LIFT")).toBe(true);
  });

  test("returns an empty overview when the user has no plan yet", async () => {
    const clerkId = "clerk_test_plan_overview_none";
    const overview = await call(router.getPlanOverview, undefined, {
      context: { auth: { userId: clerkId } },
    });

    expect(overview.plan).toBeNull();
    expect(overview.weeks).toEqual([]);
  });
});

describe("day-economy warning", () => {
  test("flags a plan whose running/bike days leave no room for the strength program", async () => {
    // 7 running days claims every day of the week, leaving zero room for
    // Glute Gladiator despite "program" mode being requested.
    const clerkId = "clerk_test_day_economy_conflict";
    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 40,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 7,
        strengthMode: "program",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: clerkId } } },
    );

    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId: clerkId } },
    });

    expect(dashboard.plan?.strengthWarning).not.toBeNull();
  });

  test("stays quiet when running/bike days leave enough room for the strength program", async () => {
    const clerkId = "clerk_test_day_economy_roomy";
    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 3,
        strengthMode: "program",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId: clerkId } } },
    );

    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId: clerkId } },
    });

    expect(dashboard.plan?.strengthWarning).toBeNull();
  });
});

describe("injury-aware strength scheduling", () => {
  test("a Knee flag substitutes Back Squat and drops Bulgarian Split Squat across the whole plan, and the injury note persists past creation", async () => {
    const clerkId = "clerk_test_injury_knee";
    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 4,
        strengthMode: "program",
        bikeDaysPerWeek: 1,
        injuryFlags: ["Knee"],
      },
      { context: { auth: { userId: clerkId } } },
    );

    const overview = await call(router.getPlanOverview, undefined, {
      context: { auth: { userId: clerkId } },
    });
    const allExerciseNames = overview.weeks
      .flatMap((w) => w.workouts)
      .flatMap((w) => w.prescription.exercises ?? [])
      .map((e) => e.name);

    expect(allExerciseNames).toContain("Leg Press");
    expect(allExerciseNames).not.toContain("Barbell Back Squat");
    expect(allExerciseNames).not.toContain("Dumbbell Bulgarian Split Squat");
    expect(allExerciseNames).not.toContain("Dumbbell Walking Lunge");

    // Re-fetch via getDashboard (a separate call, not createPlan's immediate
    // response) — the regression guard for "shown once, then gone."
    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId: clerkId } },
    });
    expect(dashboard.plan?.injuryWarning).not.toBeNull();
    expect(dashboard.plan?.injuryWarning).toContain("Knee");
  });
});
