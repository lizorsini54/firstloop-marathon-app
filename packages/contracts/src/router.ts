import { prisma } from "@firstloop/db";
import type { Prisma } from "@firstloop/db";
import { computePhaseBoundaries, generatePlan, phaseForWeek, WEEK_DAY_ORDER } from "@firstloop/plan-engine";
import type { WorkoutPrescription } from "@firstloop/plan-engine";
import { z } from "zod";
import { getOrCreateUser } from "./lib/getOrCreateUser";
import { protectedProcedure, publicProcedure } from "./procedures";
import { dashboardOutputSchema } from "./schemas/dashboard";
import type { DashboardOutput } from "./schemas/dashboard";
import { meOutputSchema } from "./schemas/me";
import { pingInputSchema, pingOutputSchema } from "./schemas/ping";
import { createPlanInputSchema, createPlanOutputSchema } from "./schemas/plan";
import { logSessionInputSchema, logSessionOutputSchema } from "./schemas/session";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const ping = publicProcedure
  .input(pingInputSchema)
  .output(pingOutputSchema)
  .handler(({ input }) => {
    return {
      message: input?.message ?? "pong",
      receivedAt: new Date().toISOString(),
    };
  });

const me = protectedProcedure.output(meOutputSchema).handler(({ context }) => {
  return { userId: context.auth.userId };
});

const createPlan = protectedProcedure
  .input(createPlanInputSchema)
  .output(createPlanOutputSchema)
  .handler(async ({ input, context }) => {
    const user = await getOrCreateUser(context.auth.userId);
    const startDate = new Date();

    const { totalWeeks, workouts, warnings } = generatePlan({
      raceDate: input.raceDate,
      startDate,
      currentWeeklyMileage: input.currentWeeklyMileage,
      liftDaysPerWeek: input.liftDaysPerWeek,
      bikeDaysPerWeek: input.bikeDaysPerWeek,
      injuryFlags: input.injuryFlags,
    });

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingPlan.create({
        data: {
          userId: user.id,
          raceDate: input.raceDate,
          startDate,
          config: {
            currentWeeklyMileage: input.currentWeeklyMileage,
            liftDaysPerWeek: input.liftDaysPerWeek,
            bikeDaysPerWeek: input.bikeDaysPerWeek,
            injuryFlags: input.injuryFlags,
          },
        },
      });

      await tx.plannedWorkout.createMany({
        data: workouts.map((w) => ({
          planId: created.id,
          weekNumber: w.weekNumber,
          day: w.day,
          type: w.type,
          prescription: w.prescription as Prisma.InputJsonValue,
        })),
      });

      return created;
    });

    return { planId: plan.id, totalWeeks, warnings };
  });

const logSession = protectedProcedure
  .input(logSessionInputSchema)
  .output(logSessionOutputSchema)
  .handler(async ({ input, context }) => {
    const user = await getOrCreateUser(context.auth.userId);

    const created = await prisma.sessionLog.create({
      data: {
        userId: user.id,
        date: input.date,
        type: input.type,
        distanceMiles: input.distanceMiles,
        durationMin: input.durationMin,
        rpe: input.rpe,
        notes: input.notes,
        plannedWorkoutId: input.plannedWorkoutId,
      },
    });

    return { sessionLogId: created.id };
  });

const emptyDashboard: DashboardOutput = {
  plan: null,
  plannedWorkouts: [],
  sessionLogs: [],
  weeklyMileageTotal: 0,
};

const getDashboard = protectedProcedure
  .input(z.void())
  .output(dashboardOutputSchema)
  .handler(async ({ context }) => {
    const user = await getOrCreateUser(context.auth.userId);

    const plan = await prisma.trainingPlan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!plan) {
      return emptyDashboard;
    }

    const { _max } = await prisma.plannedWorkout.aggregate({
      where: { planId: plan.id },
      _max: { weekNumber: true },
    });
    const totalWeeks = _max.weekNumber ?? 1;

    const now = new Date();
    const rawWeek = Math.floor((now.getTime() - plan.startDate.getTime()) / MS_PER_WEEK) + 1;
    const currentWeek = Math.min(Math.max(rawWeek, 1), totalWeeks);

    const boundaries = computePhaseBoundaries(totalWeeks);
    const phase = phaseForWeek(currentWeek, boundaries);

    const weekStart = new Date(plan.startDate.getTime() + (currentWeek - 1) * MS_PER_WEEK);
    const weekEnd = new Date(weekStart.getTime() + MS_PER_WEEK);

    const [plannedWorkouts, sessionLogs] = await Promise.all([
      prisma.plannedWorkout.findMany({
        where: { planId: plan.id, weekNumber: currentWeek },
      }),
      prisma.sessionLog.findMany({
        where: { userId: user.id, date: { gte: weekStart, lt: weekEnd } },
        orderBy: { date: "asc" },
      }),
    ]);

    plannedWorkouts.sort(
      (a, b) => WEEK_DAY_ORDER.indexOf(a.day) - WEEK_DAY_ORDER.indexOf(b.day),
    );

    const weeklyMileageTotal = sessionLogs.reduce((sum, s) => sum + (s.distanceMiles ?? 0), 0);

    return {
      plan: { id: plan.id, raceDate: plan.raceDate, startDate: plan.startDate, totalWeeks, currentWeek, phase },
      plannedWorkouts: plannedWorkouts.map((w) => ({
        id: w.id,
        day: w.day,
        type: w.type,
        prescription: w.prescription as WorkoutPrescription,
      })),
      sessionLogs: sessionLogs.map((s) => ({
        id: s.id,
        date: s.date,
        type: s.type,
        distanceMiles: s.distanceMiles,
        durationMin: s.durationMin,
        rpe: s.rpe,
        notes: s.notes,
        plannedWorkoutId: s.plannedWorkoutId,
      })),
      weeklyMileageTotal,
    };
  });

export const router = {
  ping,
  me,
  createPlan,
  logSession,
  getDashboard,
};

export type AppRouter = typeof router;
