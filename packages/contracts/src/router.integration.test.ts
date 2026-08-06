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

/**
 * Checkpoint 25 (#56). A link to a planned workout is a claim that this session
 * is the one the plan asked for, and adherence is computed entirely from it —
 * `loggedPlanIds` decides what counts as missed without checking the type. So
 * an unvalidated link let a 3-mile run mark a strength session complete, while
 * `strengthCompleted` (which does check type) still didn't count it. The
 * session was neither missed nor completed.
 */
describe("logSession — the planned-workout link", () => {
  const clerkId = "clerk_test_link_validation";

  async function planFor(userId: string) {
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
      { context: { auth: { userId } } },
    );
    const user = await prisma.user.findFirstOrThrow({ where: { clerkId: userId } });
    return prisma.plannedWorkout.findFirstOrThrow({
      where: { plan: { userId: user.id }, type: "LIFT" },
    });
  }

  test("keeps the link when the logged type matches the planned one", async () => {
    const lift = await planFor(clerkId);

    const { sessionLogId } = await call(
      router.logSession,
      {
        date: new Date(),
        type: "LIFT",
        durationMin: 45,
        rpe: 6,
        plannedWorkoutId: lift.id,
      },
      { context: { auth: { userId: clerkId } } },
    );

    const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: sessionLogId } });
    expect(log.plannedWorkoutId).toBe(lift.id);
  });

  test("drops the link, rather than the entry, when the type doesn't match", async () => {
    const lift = await planFor("clerk_test_link_mismatch");

    const { sessionLogId } = await call(
      router.logSession,
      {
        date: new Date(),
        type: "RUN",
        distanceMiles: 3.1,
        durationMin: 31,
        rpe: 5,
        plannedWorkoutId: lift.id,
      },
      { context: { auth: { userId: "clerk_test_link_mismatch" } } },
    );

    // The run is still recorded — losing a real entry over a recoverable
    // mismatch would be worse — but it no longer claims the planned lift.
    const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: sessionLogId } });
    expect(log.type).toBe("RUN");
    expect(log.distanceMiles).toBe(3.1);
    expect(log.plannedWorkoutId).toBeNull();
  });

  test("rejects a planned workout belonging to someone else", async () => {
    const strangersLift = await planFor("clerk_test_link_owner");

    expect(
      call(
        router.logSession,
        {
          date: new Date(),
          type: "LIFT",
          durationMin: 45,
          rpe: 6,
          plannedWorkoutId: strangersLift.id,
        },
        { context: { auth: { userId: "clerk_test_link_thief" } } },
      ),
    ).rejects.toThrow();
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

/**
 * Checkpoint 27 (#10, session half). `updateSessionLog` is a *second* write
 * path to `plannedWorkoutId`, the field Checkpoint 25 locked down. The
 * validation is shared rather than duplicated, and these assert it through the
 * update path directly rather than trusting that the shared call is reached.
 */
describe("updateSessionLog / deleteSessionLog", () => {
  async function planAndLog(userId: string, type: "RUN" | "LIFT" = "RUN") {
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
      { context: { auth: { userId } } },
    );
    const user = await prisma.user.findFirstOrThrow({ where: { clerkId: userId } });
    const planned = await prisma.plannedWorkout.findFirstOrThrow({
      where: { plan: { userId: user.id }, type },
    });
    const { sessionLogId } = await call(
      router.logSession,
      {
        date: new Date(),
        type,
        durationMin: 40,
        rpe: 5,
        ...(type === "RUN" ? { distanceMiles: 4 } : {}),
        plannedWorkoutId: planned.id,
      },
      { context: { auth: { userId } } },
    );
    return { sessionLogId, planned, user };
  }

  test("edits the fields and keeps a link whose type still matches", async () => {
    const { sessionLogId, planned } = await planAndLog("clerk_test_edit_ok");

    await call(
      router.updateSessionLog,
      {
        sessionLogId,
        date: new Date(),
        type: "RUN",
        distanceMiles: 6.5,
        durationMin: 61,
        rpe: 8,
        notes: "corrected",
        plannedWorkoutId: planned.id,
      },
      { context: { auth: { userId: "clerk_test_edit_ok" } } },
    );

    const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: sessionLogId } });
    expect(log.distanceMiles).toBe(6.5);
    expect(log.durationMin).toBe(61);
    expect(log.rpe).toBe(8);
    expect(log.notes).toBe("corrected");
    expect(log.plannedWorkoutId).toBe(planned.id);
  });

  test("drops the link when an edit changes the type away from the planned one", async () => {
    const { sessionLogId, planned } = await planAndLog("clerk_test_edit_detach", "LIFT");

    await call(
      router.updateSessionLog,
      {
        sessionLogId,
        date: new Date(),
        type: "RUN",
        distanceMiles: 3.1,
        durationMin: 31,
        rpe: 5,
        plannedWorkoutId: planned.id,
      },
      { context: { auth: { userId: "clerk_test_edit_detach" } } },
    );

    // The entry survives as a standalone run; the planned lift goes back to
    // being legitimately unlogged. Same rule as #56, reached through edit.
    const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: sessionLogId } });
    expect(log.type).toBe("RUN");
    expect(log.plannedWorkoutId).toBeNull();
  });

  test("clears a distance when an edit removes it", async () => {
    const { sessionLogId } = await planAndLog("clerk_test_edit_clear");

    await call(
      router.updateSessionLog,
      { sessionLogId, date: new Date(), type: "RUN", durationMin: 30, rpe: 4 },
      { context: { auth: { userId: "clerk_test_edit_clear" } } },
    );

    const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: sessionLogId } });
    expect(log.distanceMiles).toBeNull();
    expect(log.notes).toBeNull();
  });

  test("refuses to edit someone else's session", async () => {
    const { sessionLogId } = await planAndLog("clerk_test_edit_owner");

    expect(
      call(
        router.updateSessionLog,
        { sessionLogId, date: new Date(), type: "RUN", durationMin: 10, rpe: 1 },
        { context: { auth: { userId: "clerk_test_edit_stranger" } } },
      ),
    ).rejects.toThrow();

    const log = await prisma.sessionLog.findUniqueOrThrow({ where: { id: sessionLogId } });
    expect(log.durationMin).toBe(40);
  });

  test("deletes the row outright", async () => {
    const { sessionLogId } = await planAndLog("clerk_test_delete_ok");

    await call(
      router.deleteSessionLog,
      { sessionLogId },
      { context: { auth: { userId: "clerk_test_delete_ok" } } },
    );

    expect(await prisma.sessionLog.findUnique({ where: { id: sessionLogId } })).toBeNull();
  });

  test("refuses to delete someone else's session", async () => {
    const { sessionLogId } = await planAndLog("clerk_test_delete_owner");

    expect(
      call(
        router.deleteSessionLog,
        { sessionLogId },
        { context: { auth: { userId: "clerk_test_delete_stranger" } } },
      ),
    ).rejects.toThrow();

    expect(await prisma.sessionLog.findUnique({ where: { id: sessionLogId } })).not.toBeNull();
  });
});

/**
 * Checkpoint 28 (#46). The planned-vs-logged chart plotted the *current* week
 * as 0 while the tile beside it read "the week's still open" — the same fact
 * told two ways on one screen. Checkpoint 16 had nulled future weeks for the
 * same reason and missed the in-progress one.
 *
 * The third test is the important one: a past week with nothing logged is a
 * real 0, and that is the adherence signal the chart exists for. Fixing #46 by
 * nulling anything unlogged would quietly undo it.
 */
describe("getDashboard — weekly mileage history", () => {
  async function planFor(userId: string) {
    await call(
      router.createPlan,
      {
        raceDate: new Date("2027-06-01"),
        currentWeeklyMileage: 20,
        runningExperience: "has_finished_one",
        runningDaysPerWeek: 3,
        strengthMode: "none",
        bikeDaysPerWeek: 0,
        injuryFlags: [],
      },
      { context: { auth: { userId } } },
    );
    return call(router.getDashboard, undefined, { context: { auth: { userId } } });
  }

  test("the current week reads as null while nothing is logged in it", async () => {
    const dashboard = await planFor("clerk_test_week_open");
    const current = dashboard.plan?.currentWeek ?? 1;

    const week = dashboard.weeklyMileageHistory.find((w) => w.weekNumber === current);
    expect(week?.actualMiles).toBeNull();
  });

  test("the current week reports its real figure once a long run is logged", async () => {
    const userId = "clerk_test_week_logged";
    await planFor(userId);

    const user = await prisma.user.findFirstOrThrow({ where: { clerkId: userId } });
    // The chart counts only logs linked to a distance-prescribed workout —
    // long runs — which is the Checkpoint 19 pairing rule.
    const longRun = await prisma.plannedWorkout.findFirstOrThrow({
      where: { plan: { userId: user.id }, type: "RUN", weekNumber: 1 },
      orderBy: { day: "desc" },
    });

    await call(
      router.logSession,
      {
        date: new Date(),
        type: "RUN",
        distanceMiles: 7.5,
        durationMin: 70,
        rpe: 6,
        plannedWorkoutId: longRun.id,
      },
      { context: { auth: { userId } } },
    );

    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId } },
    });
    const current = dashboard.plan?.currentWeek ?? 1;
    const week = dashboard.weeklyMileageHistory.find((w) => w.weekNumber === current);
    expect(week?.actualMiles).toBe(7.5);
  });

  test("future weeks stay null, and unlogged past weeks stay a real 0", async () => {
    const userId = "clerk_test_week_future";
    await planFor(userId);

    // `createPlan` always starts a plan today, so through the API alone the
    // current week is always 1 and there are no past weeks to inspect — an
    // assertion over them would pass vacuously. Backdating the start date is
    // the only way to give this test the case it exists for.
    const user = await prisma.user.findFirstOrThrow({ where: { clerkId: userId } });
    const plan = await prisma.trainingPlan.findFirstOrThrow({ where: { userId: user.id } });
    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { startDate: new Date(plan.startDate.getTime() - 21 * 24 * 60 * 60 * 1000) },
    });

    const dashboard = await call(router.getDashboard, undefined, {
      context: { auth: { userId } },
    });
    const current = dashboard.plan?.currentWeek ?? 1;
    expect(current).toBeGreaterThan(1);

    const future = dashboard.weeklyMileageHistory.filter((w) => w.weekNumber > current);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((w) => w.actualMiles === null)).toBe(true);

    // The assertion this test exists for: nothing was logged in those weeks,
    // and they are over, so they read as a real 0 rather than "no data".
    const past = dashboard.weeklyMileageHistory.filter((w) => w.weekNumber < current);
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((w) => w.actualMiles === 0)).toBe(true);
  });
});
