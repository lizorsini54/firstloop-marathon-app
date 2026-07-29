import { prisma } from "@firstloop/db";
import type { Prisma } from "@firstloop/db";
import {
  checkFeasibility,
  computePhaseBoundaries,
  estimateAvailableWeeks,
  generatePlan,
  phaseForWeek,
  WEEK_DAY_ORDER,
} from "@firstloop/plan-engine";
import type { WorkoutPrescription } from "@firstloop/plan-engine";
import { buildCustomProgram, gluteGladiator, scheduleStrengthSessions } from "@firstloop/strength-engine";
import type { GeneratedStrengthWorkout, WeekContext } from "@firstloop/strength-engine";
import { z } from "zod";
import { getOrCreateUser } from "./lib/getOrCreateUser";
import { protectedProcedure, publicProcedure } from "./procedures";
import { dashboardOutputSchema } from "./schemas/dashboard";
import type { DashboardOutput } from "./schemas/dashboard";
import { getSessionHistoryOutputSchema } from "./schemas/history";
import { meOutputSchema } from "./schemas/me";
import { pingInputSchema, pingOutputSchema } from "./schemas/ping";
import { createPlanInputSchema, createPlanOutputSchema } from "./schemas/plan";
import { getRunningProgressOutputSchema } from "./schemas/progress";
import { logSessionInputSchema, logSessionOutputSchema } from "./schemas/session";
import type { SetLogEntry } from "./schemas/session";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Midnight UTC of the given date. Plan start dates need to align with
 * session log dates (which come from a plain <input type="date">, parsed
 * as midnight UTC) — otherwise a session logged "today" can fall before
 * a same-day plan's startDate and silently drop out of "this week."
 */
function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday (UTC) of the week containing d — the bucketing key for weekly running progress. */
function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = startOfUTCDay(d);
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  return start;
}

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
    const startDate = startOfUTCDay(new Date());

    const { totalWeeks, workouts, warnings } = generatePlan({
      raceDate: input.raceDate,
      startDate,
      currentWeeklyMileage: input.currentWeeklyMileage,
      runningExperience: input.runningExperience,
      runningDaysPerWeek: input.runningDaysPerWeek,
      bikeDaysPerWeek: input.bikeDaysPerWeek,
      injuryFlags: input.injuryFlags,
    });

    const { warning: feasibilityWarning } = checkFeasibility(
      estimateAvailableWeeks(input.raceDate, startDate),
      input.runningExperience,
    );

    // Strength sessions are scheduled around the running plan's fixed days:
    // REST-day placeholders become the strength scheduler's available slots
    // (RUN and BIKE days are already spoken for), and any REST row it
    // actually claims gets dropped before persisting.
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

    let strengthWorkouts: GeneratedStrengthWorkout[] = [];
    if (input.strengthMode === "program") {
      strengthWorkouts = scheduleStrengthSessions(gluteGladiator, weekContexts);
    } else if (input.strengthMode === "custom") {
      const customProgram = buildCustomProgram(input.customLiftDaysPerWeek ?? 1);
      strengthWorkouts = scheduleStrengthSessions(customProgram, weekContexts);
    }

    const claimedDays = new Set(strengthWorkouts.map((w) => `${w.weekNumber}-${w.day}`));
    const runningWorkouts = workouts.filter(
      (w) => !(w.type === "REST" && claimedDays.has(`${w.weekNumber}-${w.day}`)),
    );

    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingPlan.create({
        data: {
          userId: user.id,
          raceDate: input.raceDate,
          startDate,
          config: {
            currentWeeklyMileage: input.currentWeeklyMileage,
            runningExperience: input.runningExperience,
            runningDaysPerWeek: input.runningDaysPerWeek,
            strengthMode: input.strengthMode,
            customLiftDaysPerWeek: input.customLiftDaysPerWeek,
            bikeDaysPerWeek: input.bikeDaysPerWeek,
            injuryFlags: input.injuryFlags,
            feasibilityWarning,
          },
        },
      });

      await tx.plannedWorkout.createMany({
        data: [
          ...runningWorkouts.map((w) => ({
            planId: created.id,
            weekNumber: w.weekNumber,
            day: w.day,
            type: w.type,
            prescription: w.prescription as Prisma.InputJsonValue,
          })),
          ...strengthWorkouts.map((w) => ({
            planId: created.id,
            weekNumber: w.weekNumber,
            day: w.day,
            type: "LIFT" as const,
            prescription: w.prescription as unknown as Prisma.InputJsonValue,
          })),
        ],
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
        setLog: input.setLog,
      },
    });

    return { sessionLogId: created.id };
  });

const getSessionHistory = protectedProcedure
  .input(z.void())
  .output(getSessionHistoryOutputSchema)
  .handler(async ({ context }) => {
    const user = await getOrCreateUser(context.auth.userId);

    const sessionLogs = await prisma.sessionLog.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });

    return {
      sessionLogs: sessionLogs.map((s) => ({
        id: s.id,
        date: s.date,
        type: s.type,
        distanceMiles: s.distanceMiles,
        durationMin: s.durationMin,
        rpe: s.rpe,
        notes: s.notes,
        plannedWorkoutId: s.plannedWorkoutId,
        setLog: s.setLog as SetLogEntry[] | null,
      })),
    };
  });

const getRunningProgress = protectedProcedure
  .input(z.void())
  .output(getRunningProgressOutputSchema)
  .handler(async ({ context }) => {
    const user = await getOrCreateUser(context.auth.userId);

    // All logged history, not scoped to the current plan — a runner's
    // running history can span more than one plan.
    const runLogs = await prisma.sessionLog.findMany({
      where: { userId: user.id, type: "RUN" },
      orderBy: { date: "asc" },
    });

    const buckets = new Map<
      string,
      { weekStart: Date; totalMiles: number; pacedDurationMin: number; pacedMiles: number }
    >();

    for (const log of runLogs) {
      const weekStart = startOfWeekUTC(log.date);
      const key = weekStart.toISOString();
      const bucket = buckets.get(key) ?? { weekStart, totalMiles: 0, pacedDurationMin: 0, pacedMiles: 0 };
      bucket.totalMiles += log.distanceMiles ?? 0;
      if (log.distanceMiles) {
        bucket.pacedDurationMin += log.durationMin;
        bucket.pacedMiles += log.distanceMiles;
      }
      buckets.set(key, bucket);
    }

    const weeks = Array.from(buckets.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((b) => ({
        weekStart: b.weekStart,
        totalMiles: b.totalMiles,
        averagePaceMinPerMile: b.pacedMiles > 0 ? b.pacedDurationMin / b.pacedMiles : null,
      }));

    return { weeks };
  });

const emptyDashboard: DashboardOutput = {
  plan: null,
  plannedWorkouts: [],
  sessionLogs: [],
  weeklyMileageTotal: 0,
  weeklyMileageHistory: [],
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

    const [allPlannedWorkouts, sessionLogsSincePlanStart] = await Promise.all([
      prisma.plannedWorkout.findMany({ where: { planId: plan.id } }),
      prisma.sessionLog.findMany({
        where: { userId: user.id, date: { gte: plan.startDate } },
        orderBy: { date: "asc" },
      }),
    ]);

    const plannedWorkouts = allPlannedWorkouts
      .filter((w) => w.weekNumber === currentWeek)
      .sort((a, b) => WEEK_DAY_ORDER.indexOf(a.day) - WEEK_DAY_ORDER.indexOf(b.day));

    const sessionLogs = sessionLogsSincePlanStart.filter(
      (s) => s.date >= weekStart && s.date < weekEnd,
    );

    const weeklyMileageTotal = sessionLogs.reduce((sum, s) => sum + (s.distanceMiles ?? 0), 0);

    const plannedMilesByWeek = new Map<number, number>();
    for (const w of allPlannedWorkouts) {
      const miles = (w.prescription as WorkoutPrescription).distanceMiles ?? 0;
      plannedMilesByWeek.set(w.weekNumber, (plannedMilesByWeek.get(w.weekNumber) ?? 0) + miles);
    }

    const actualMilesByWeek = new Map<number, number>();
    for (const s of sessionLogsSincePlanStart) {
      const week = Math.floor((s.date.getTime() - plan.startDate.getTime()) / MS_PER_WEEK) + 1;
      actualMilesByWeek.set(week, (actualMilesByWeek.get(week) ?? 0) + (s.distanceMiles ?? 0));
    }

    const weeklyMileageHistory = Array.from({ length: totalWeeks }, (_, i) => {
      const weekNumber = i + 1;
      return {
        weekNumber,
        plannedMiles: plannedMilesByWeek.get(weekNumber) ?? 0,
        actualMiles: actualMilesByWeek.get(weekNumber) ?? 0,
      };
    });

    const config = plan.config as { feasibilityWarning?: string | null } | null;

    return {
      plan: {
        id: plan.id,
        raceDate: plan.raceDate,
        startDate: plan.startDate,
        totalWeeks,
        currentWeek,
        phase,
        feasibilityWarning: config?.feasibilityWarning ?? null,
      },
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
        setLog: s.setLog as SetLogEntry[] | null,
      })),
      weeklyMileageTotal,
      weeklyMileageHistory,
    };
  });

export const router = {
  ping,
  me,
  createPlan,
  logSession,
  getDashboard,
  getSessionHistory,
  getRunningProgress,
};

export type AppRouter = typeof router;
