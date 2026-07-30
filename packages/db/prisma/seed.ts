import {
  checkFeasibility,
  computePhaseBoundaries,
  estimateAvailableWeeks,
  generatePlan,
  phaseForWeek,
  WEEK_DAY_ORDER,
} from "@firstloop/plan-engine";
import { checkDayEconomy, gluteGladiator, scheduleStrengthSessions } from "@firstloop/strength-engine";
import type { WeekContext } from "@firstloop/strength-engine";
import type { Prisma, WorkoutType } from "../src/client";
import { prisma } from "../src/client";

const SEED_CLERK_ID = "user_3H9Lp4BXRLTogdYtAXtiXLWTZPt";
const SEED_EMAIL = "firstloop_test+clerk_test@example.com";

const RACE_DATE = new Date("2027-02-27");
const WEEKS_OF_HISTORY = 8;
const SKIP_PROBABILITY = 0.12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Duplicated from router.ts's buildInjuryWarning (same reasoning as the
// weekContexts orchestration above: packages/db can't depend on
// packages/contracts). Evaluates to null for the demo persona's empty
// injuryFlags — kept here so the seed stays honest if that ever changes.
function buildInjuryWarning(injuryFlags: string[], runningWarnings: string[]): string | null {
  if (injuryFlags.length === 0) return null;
  const hasKnee = injuryFlags.some((f) => f.toLowerCase() === "knee");
  const strengthNote = hasKnee
    ? "Knee-loading strength exercises (back squat, Bulgarian split squat, walking lunge) were substituted or reduced for your flagged knee."
    : "Strength exercises weren't modified for this — mention any discomfort to a coach.";
  return [...runningWarnings, strengthNote].join(" ");
}

function parseSetCount(setsReps: string): number {
  const match = /^(\d+)\s*x/.exec(setsReps);
  const n = match ? Number(match[1]) : 0;
  return n > 0 ? n : 0;
}

function parseRepsGuess(setsReps: string): number {
  const match = /x\s*(\d+)(?:-(\d+))?/.exec(setsReps);
  if (!match) return 10;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  return Math.round((low + high) / 2);
}

async function main() {
  const today = startOfUTCDay(new Date());
  const startDate = startOfUTCDay(new Date(today.getTime() - WEEKS_OF_HISTORY * MS_PER_WEEK));

  const user = await prisma.user.upsert({
    where: { clerkId: SEED_CLERK_ID },
    update: {},
    create: { clerkId: SEED_CLERK_ID, email: SEED_EMAIL },
  });

  // Clear any previously seeded plans so this script is safe to rerun.
  await prisma.trainingPlan.deleteMany({ where: { userId: user.id } });

  const intake = {
    raceDate: RACE_DATE,
    startDate,
    currentWeeklyMileage: 22,
    // Comfortable, not a warning scenario — the demo persona has finished a
    // marathon before and the race date is far out. Create a plan with a
    // near-term race date and "first marathon" to see the warning trigger.
    runningExperience: "has_finished_one" as const,
    runningDaysPerWeek: 4,
    strengthMode: "program" as const,
    bikeDaysPerWeek: 1,
    injuryFlags: [] as string[],
  };

  const { totalWeeks, workouts, warnings } = generatePlan(intake);
  const { warning: feasibilityWarning } = checkFeasibility(
    estimateAvailableWeeks(intake.raceDate, intake.startDate),
    intake.runningExperience,
  );
  const injuryWarning = buildInjuryWarning(intake.injuryFlags, warnings);

  // Same orchestration as createPlan in packages/contracts/src/router.ts:
  // REST-day placeholders become the strength scheduler's available slots,
  // and any REST row it claims gets dropped before persisting. Duplicated
  // rather than shared because packages/db can't depend on packages/contracts
  // (contracts already depends on db — that would be circular).
  const boundaries = computePhaseBoundaries(totalWeeks);
  const weekContexts: WeekContext[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    const weekWorkouts = workouts.filter((w) => w.weekNumber === week);
    const phase = phaseForWeek(week, boundaries);
    weekContexts.push({
      weekNumber: week,
      availableDays: weekWorkouts.filter((w) => w.type === "REST").map((w) => w.day),
      interferenceDays: weekWorkouts
        .filter(
          (w) =>
            w.type === "RUN" &&
            (w.prescription.quality === "long" ||
              w.prescription.quality === "tempo" ||
              w.prescription.quality === "intervals"),
        )
        .map((w) => w.day),
      isPeakMileageWeek: phase === "peak",
      isDownDeloadWeek: phase === "taper",
    });
  }

  const strengthWorkouts = scheduleStrengthSessions(gluteGladiator, weekContexts, intake.injuryFlags);
  const { warning: strengthWarning } = checkDayEconomy(gluteGladiator, weekContexts, strengthWorkouts);
  const claimedDays = new Set(strengthWorkouts.map((w) => `${w.weekNumber}-${w.day}`));
  const runningWorkouts = workouts.filter(
    (w) => !(w.type === "REST" && claimedDays.has(`${w.weekNumber}-${w.day}`)),
  );

  const plan = await prisma.trainingPlan.create({
    data: {
      userId: user.id,
      raceDate: intake.raceDate,
      startDate: intake.startDate,
      config: {
        currentWeeklyMileage: intake.currentWeeklyMileage,
        runningExperience: intake.runningExperience,
        runningDaysPerWeek: intake.runningDaysPerWeek,
        strengthMode: intake.strengthMode,
        bikeDaysPerWeek: intake.bikeDaysPerWeek,
        injuryFlags: intake.injuryFlags,
        feasibilityWarning,
        strengthWarning,
        injuryWarning,
      },
    },
  });

  const createdWorkouts = await Promise.all([
    ...runningWorkouts.map((w) =>
      prisma.plannedWorkout.create({
        data: {
          planId: plan.id,
          weekNumber: w.weekNumber,
          day: w.day,
          type: w.type,
          prescription: w.prescription as Prisma.InputJsonValue,
        },
      }),
    ),
    ...strengthWorkouts.map((w) =>
      prisma.plannedWorkout.create({
        data: {
          planId: plan.id,
          weekNumber: w.weekNumber,
          day: w.day,
          type: "LIFT",
          prescription: w.prescription as unknown as Prisma.InputJsonValue,
        },
      }),
    ),
  ]);

  const workoutDateOf = (workout: {
    weekNumber: number;
    day: (typeof WEEK_DAY_ORDER)[number];
  }): Date => {
    const weekStart = new Date(startDate.getTime() + (workout.weekNumber - 1) * MS_PER_WEEK);
    return new Date(weekStart.getTime() + WEEK_DAY_ORDER.indexOf(workout.day) * MS_PER_DAY);
  };

  // The AI Coach needs something real to comment on (Checkpoint 14). Leave the
  // most recent long run deliberately unlogged rather than hoping
  // SKIP_PROBABILITY happens to produce an interesting case — a demo where the
  // coach has nothing to flag undersells the feature.
  const skippedLongRun = createdWorkouts
    .filter(
      (w) =>
        w.type === "RUN" &&
        (w.prescription as { quality?: string }).quality === "long" &&
        workoutDateOf(w) <= today,
    )
    .sort((a, b) => workoutDateOf(b).getTime() - workoutDateOf(a).getTime())[0];

  let loggedCount = 0;
  for (const workout of createdWorkouts) {
    if (workout.type === "REST") continue;

    const workoutDate = workoutDateOf(workout);

    if (workoutDate > today) continue; // hasn't happened yet
    if (workout.id === skippedLongRun?.id) continue; // the deliberate miss, above
    if (Math.random() < SKIP_PROBABILITY) continue; // the occasional missed session

    const { distanceMiles, durationMin, rpe, setLog } = simulateActuals(
      workout.type,
      workout.prescription as {
        distanceMiles?: number;
        durationMin?: number;
        quality?: string;
        exercises?: { name: string; setsReps: string; isMainLift?: boolean }[];
      },
    );

    await prisma.sessionLog.create({
      data: {
        userId: user.id,
        plannedWorkoutId: workout.id,
        date: workoutDate,
        type: workout.type,
        distanceMiles,
        durationMin,
        rpe,
        setLog: setLog as Prisma.InputJsonValue | undefined,
      },
    });
    loggedCount++;
  }

  console.log(
    `Seeded plan ${plan.id} (${totalWeeks} weeks, ${createdWorkouts.length} planned workouts) with ${loggedCount} logged sessions for ${SEED_EMAIL}`,
  );
  if (skippedLongRun) {
    console.log(
      `  Left the ${workoutDateOf(skippedLongRun).toISOString().slice(0, 10)} long run unlogged so the coach has a concern to flag.`,
    );
  }
}

function simulateActuals(
  type: WorkoutType,
  prescription: {
    distanceMiles?: number;
    durationMin?: number;
    quality?: string;
    exercises?: { name: string; setsReps: string; isMainLift?: boolean }[];
  },
): { distanceMiles?: number; durationMin: number; rpe: number; setLog?: unknown } {
  if (type === "RUN") {
    const isHardEffort =
      prescription.quality === "long" ||
      prescription.quality === "tempo" ||
      prescription.quality === "intervals";
    const rpe = Math.round(isHardEffort ? randomBetween(7, 9) : randomBetween(5, 6));

    if (prescription.distanceMiles) {
      const distanceMiles = round1(prescription.distanceMiles * randomBetween(0.92, 1.08));
      const durationMin = Math.round(distanceMiles * randomBetween(9, 10.5));
      return { distanceMiles, durationMin, rpe };
    }

    const durationMin = Math.round((prescription.durationMin ?? 40) * randomBetween(0.9, 1.1));
    return { durationMin, rpe };
  }

  if (type === "LIFT") {
    const exercises = (prescription.exercises ?? []).filter(
      (ex) => parseSetCount(ex.setsReps) > 0,
    );
    const setLog = exercises.map((ex) => {
      const setCount = parseSetCount(ex.setsReps);
      const repsGuess = parseRepsGuess(ex.setsReps);
      const baseWeight = ex.isMainLift ? randomBetween(95, 225) : randomBetween(10, 60);
      return {
        exercise: ex.name,
        sets: Array.from({ length: setCount }, () => ({
          reps: Math.max(1, Math.round(repsGuess * randomBetween(0.9, 1.1))),
          weightLbs: Math.round(baseWeight / 2.5) * 2.5,
        })),
      };
    });

    return {
      durationMin: Math.round(randomBetween(40, 60)),
      rpe: Math.round(randomBetween(6, 7)),
      setLog: setLog.length > 0 ? setLog : undefined,
    };
  }

  // BIKE
  const durationMin = Math.round((prescription.durationMin ?? 45) * randomBetween(0.9, 1.1));
  return { durationMin, rpe: Math.round(randomBetween(5, 6)) };
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
