import { generatePlan, WEEK_DAY_ORDER } from "@firstloop/plan-engine";
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
    liftDaysPerWeek: 2,
    bikeDaysPerWeek: 1,
    injuryFlags: [] as string[],
  };

  const { totalWeeks, workouts } = generatePlan(intake);

  const plan = await prisma.trainingPlan.create({
    data: {
      userId: user.id,
      raceDate: intake.raceDate,
      startDate: intake.startDate,
      config: {
        currentWeeklyMileage: intake.currentWeeklyMileage,
        liftDaysPerWeek: intake.liftDaysPerWeek,
        bikeDaysPerWeek: intake.bikeDaysPerWeek,
        injuryFlags: intake.injuryFlags,
      },
    },
  });

  const createdWorkouts = await Promise.all(
    workouts.map((w) =>
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
  );

  let loggedCount = 0;
  for (const workout of createdWorkouts) {
    if (workout.type === "REST") continue;

    const weekStart = new Date(startDate.getTime() + (workout.weekNumber - 1) * MS_PER_WEEK);
    const workoutDate = new Date(
      weekStart.getTime() + WEEK_DAY_ORDER.indexOf(workout.day) * MS_PER_DAY,
    );

    if (workoutDate > today) continue; // hasn't happened yet
    if (Math.random() < SKIP_PROBABILITY) continue; // the occasional missed session

    const prescription = workout.prescription as {
      distanceMiles?: number;
      durationMin?: number;
      quality?: string;
    };

    const { distanceMiles, durationMin, rpe } = simulateActuals(workout.type, prescription);

    await prisma.sessionLog.create({
      data: {
        userId: user.id,
        plannedWorkoutId: workout.id,
        date: workoutDate,
        type: workout.type,
        distanceMiles,
        durationMin,
        rpe,
      },
    });
    loggedCount++;
  }

  console.log(
    `Seeded plan ${plan.id} (${totalWeeks} weeks, ${createdWorkouts.length} planned workouts) with ${loggedCount} logged sessions for ${SEED_EMAIL}`,
  );
}

function simulateActuals(
  type: WorkoutType,
  prescription: { distanceMiles?: number; durationMin?: number; quality?: string },
): { distanceMiles?: number; durationMin: number; rpe: number } {
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
    return { durationMin: Math.round(randomBetween(40, 60)), rpe: Math.round(randomBetween(6, 7)) };
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
