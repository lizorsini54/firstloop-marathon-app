import { prisma } from "@firstloop/db";
import type { Prisma } from "@firstloop/db";
import { ORPCError } from "@orpc/server";
import {
  checkFeasibility,
  computePhaseBoundaries,
  estimateAvailableWeeks,
  generatePlan,
  phaseForWeek,
  WEEK_DAY_ORDER,
} from "@firstloop/plan-engine";
import type { WorkoutPrescription } from "@firstloop/plan-engine";
import {
  buildCustomProgram,
  checkDayEconomy,
  gluteGladiator,
  scheduleStrengthSessions,
} from "@firstloop/strength-engine";
import type { GeneratedStrengthWorkout, StrengthProgram, WeekContext } from "@firstloop/strength-engine";
import { z } from "zod";
import {
  buildTrainingSnapshot,
  CoachTimeoutError,
  createAnthropicCompletion,
  getCoachFeedback as requestCoachFeedback,
} from "./lib/coach";
import type { LoggedItem, PlannedItem } from "./lib/coach";
import { getOrCreateUser } from "./lib/getOrCreateUser";
import { protectedProcedure, publicProcedure } from "./procedures";
import { getCoachFeedbackOutputSchema } from "./schemas/coach";
import type { GetCoachFeedbackOutput } from "./schemas/coach";
import { dashboardOutputSchema } from "./schemas/dashboard";
import type { DashboardOutput } from "./schemas/dashboard";
import { getSessionHistoryOutputSchema } from "./schemas/history";
import { meOutputSchema } from "./schemas/me";
import { getPlanOverviewOutputSchema } from "./schemas/overview";
import { pingInputSchema, pingOutputSchema } from "./schemas/ping";
import { createPlanInputSchema, createPlanOutputSchema } from "./schemas/plan";
import { getRunningProgressOutputSchema } from "./schemas/progress";
import { logSessionInputSchema, logSessionOutputSchema } from "./schemas/session";
import type { SetLogEntry } from "./schemas/session";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

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

/**
 * Shared plan-meta computation — totalWeeks/currentWeek/phase/
 * feasibilityWarning, the same fields both getDashboard and getPlanOverview
 * need derived from a plan row. Callers spread the plan's own id/raceDate/
 * startDate alongside this.
 */
async function computePlanMeta(plan: { id: string; startDate: Date; config: Prisma.JsonValue }) {
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

  const config = plan.config as {
    feasibilityWarning?: string | null;
    strengthWarning?: string | null;
    injuryWarning?: string | null;
  } | null;

  return {
    totalWeeks,
    currentWeek,
    phase,
    feasibilityWarning: config?.feasibilityWarning ?? null,
    strengthWarning: config?.strengthWarning ?? null,
    injuryWarning: config?.injuryWarning ?? null,
  };
}

/**
 * Consolidates the running-side per-flag injury warnings (plan-engine's
 * own, already-worded) with a strength-side adaptation note, so Dashboard/
 * Plan can show one persisted sentence instead of the transient message
 * createPlan returns once and never again. Only "Knee" currently has a
 * real, documented exercise-level response (see programs/glute-gladiator.ts)
 * — other flags get an honest "not modified" note rather than an invented one.
 */
function buildInjuryWarning(injuryFlags: string[], runningWarnings: string[]): string | null {
  if (injuryFlags.length === 0) return null;
  const hasKnee = injuryFlags.some((f) => f.toLowerCase() === "knee");
  const strengthNote = hasKnee
    ? "Knee-loading strength exercises (back squat, Bulgarian split squat, walking lunge) were substituted or reduced for your flagged knee."
    : "Strength exercises weren't modified for this — mention any discomfort to a coach.";
  return [...runningWarnings, strengthNote].join(" ");
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
    let strengthProgram: StrengthProgram | null = null;
    if (input.strengthMode === "program") {
      strengthProgram = gluteGladiator;
      strengthWorkouts = scheduleStrengthSessions(gluteGladiator, weekContexts, input.injuryFlags);
    } else if (input.strengthMode === "custom") {
      strengthProgram = buildCustomProgram(input.customLiftDaysPerWeek ?? 1);
      strengthWorkouts = scheduleStrengthSessions(strengthProgram, weekContexts, input.injuryFlags);
    }

    // Day-economy check: only meaningful once a real program is scheduled —
    // "none" mode has nothing to check against.
    const strengthWarning = strengthProgram
      ? checkDayEconomy(strengthProgram, weekContexts, strengthWorkouts).warning
      : null;

    const injuryWarning = buildInjuryWarning(input.injuryFlags, warnings);

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
            strengthWarning,
            injuryWarning,
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

    // A link to a planned workout is a claim that *this* session is the one the
    // plan asked for, and adherence is computed entirely from it — so it gets
    // validated here rather than trusted from the client.
    //
    // The two failure modes are handled differently on purpose. A workout that
    // isn't the caller's has no correct interpretation, so it's rejected. A
    // type mismatch does have one: the runner did something other than what was
    // planned, which is a standalone session, and the planned one stays
    // legitimately unlogged. Rejecting that would lose a real entry over a
    // recoverable mismatch. Warned rather than swallowed, so a client that
    // starts sending mismatches is visible instead of absorbed.
    let plannedWorkoutId = input.plannedWorkoutId;
    if (plannedWorkoutId !== undefined) {
      const planned = await prisma.plannedWorkout.findUnique({
        where: { id: plannedWorkoutId },
        select: { type: true, plan: { select: { userId: true } } },
      });

      if (!planned || planned.plan.userId !== user.id) {
        throw new ORPCError("NOT_FOUND", { message: "Planned workout not found" });
      }

      if (planned.type !== input.type) {
        console.warn(
          `Dropping plannedWorkoutId ${plannedWorkoutId}: logged ${input.type} against a planned ${planned.type}`,
        );
        plannedWorkoutId = undefined;
      }
    }

    const created = await prisma.sessionLog.create({
      data: {
        userId: user.id,
        date: input.date,
        type: input.type,
        distanceMiles: input.distanceMiles,
        durationMin: input.durationMin,
        rpe: input.rpe,
        notes: input.notes,
        plannedWorkoutId,
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
      {
        weekStart: Date;
        totalMiles: number;
        /** Runs that recorded a distance — 0 means the week is unmeasured, not empty. */
        measuredRuns: number;
        pacedDurationMin: number;
        pacedMiles: number;
      }
    >();

    for (const log of runLogs) {
      const weekStart = startOfWeekUTC(log.date);
      const key = weekStart.toISOString();
      const bucket = buckets.get(key) ?? {
        weekStart,
        totalMiles: 0,
        measuredRuns: 0,
        pacedDurationMin: 0,
        pacedMiles: 0,
      };
      bucket.totalMiles += log.distanceMiles ?? 0;
      if (log.distanceMiles !== null) bucket.measuredRuns++;
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
        totalMiles: b.measuredRuns > 0 ? b.totalMiles : null,
        averagePaceMinPerMile: b.pacedMiles > 0 ? b.pacedDurationMin / b.pacedMiles : null,
      }));

    return { weeks };
  });

const emptyDashboard: DashboardOutput = {
  plan: null,
  plannedWorkouts: [],
  sessionLogs: [],
  weeklyMileageTotal: null,
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

    const meta = await computePlanMeta(plan);
    const { totalWeeks, currentWeek } = meta;

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

    // Every logged distance this week, across all runs. Null rather than 0
    // when sessions were logged but none carried a distance — a duration-only
    // week is "not measured in miles," which is a different fact from "you ran
    // nothing," and the dashboard renders them differently.
    const measuredThisWeek = sessionLogs.filter((s) => s.distanceMiles !== null);
    const weeklyMileageTotal =
      measuredThisWeek.length === 0
        ? null
        : measuredThisWeek.reduce((sum, s) => sum + (s.distanceMiles ?? 0), 0);

    // The planned/logged chart is long-run distance on both sides. Only long
    // runs carry a planned distance (everything else is prescribed by
    // duration), so counting every logged run against that planned number
    // would compare two different quantities and read as a weekly overshoot.
    const plannedMilesByWeek = new Map<number, number>();
    const distancePlannedWorkoutIds = new Set<string>();
    for (const w of allPlannedWorkouts) {
      const miles = (w.prescription as WorkoutPrescription).distanceMiles ?? 0;
      if (miles > 0) distancePlannedWorkoutIds.add(w.id);
      plannedMilesByWeek.set(w.weekNumber, (plannedMilesByWeek.get(w.weekNumber) ?? 0) + miles);
    }

    const actualMilesByWeek = new Map<number, number>();
    for (const s of sessionLogsSincePlanStart) {
      if (s.plannedWorkoutId === null || !distancePlannedWorkoutIds.has(s.plannedWorkoutId)) {
        continue;
      }
      const week = Math.floor((s.date.getTime() - plan.startDate.getTime()) / MS_PER_WEEK) + 1;
      actualMilesByWeek.set(week, (actualMilesByWeek.get(week) ?? 0) + (s.distanceMiles ?? 0));
    }

    const weeklyMileageHistory = Array.from({ length: totalWeeks }, (_, i) => {
      const weekNumber = i + 1;
      return {
        weekNumber,
        plannedMiles: plannedMilesByWeek.get(weekNumber) ?? 0,
        // Weeks past the current one haven't happened, so they have no actual
        // to report — null rather than 0, which would draw the whole remaining
        // plan as missed training.
        actualMiles:
          weekNumber > currentWeek ? null : (actualMilesByWeek.get(weekNumber) ?? 0),
      };
    });

    return {
      plan: { id: plan.id, raceDate: plan.raceDate, startDate: plan.startDate, ...meta },
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

const getPlanOverview = protectedProcedure
  .input(z.void())
  .output(getPlanOverviewOutputSchema)
  .handler(async ({ context }) => {
    const user = await getOrCreateUser(context.auth.userId);

    const plan = await prisma.trainingPlan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!plan) {
      return { plan: null, weeks: [] };
    }

    const meta = await computePlanMeta(plan);
    const allPlannedWorkouts = await prisma.plannedWorkout.findMany({ where: { planId: plan.id } });

    const byWeek = new Map<number, typeof allPlannedWorkouts>();
    for (const w of allPlannedWorkouts) {
      const bucket = byWeek.get(w.weekNumber);
      if (bucket) bucket.push(w);
      else byWeek.set(w.weekNumber, [w]);
    }

    const weeks = Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, workouts]) => ({
        weekNumber,
        workouts: workouts
          .slice()
          .sort((a, b) => WEEK_DAY_ORDER.indexOf(a.day) - WEEK_DAY_ORDER.indexOf(b.day))
          .map((w) => ({
            id: w.id,
            day: w.day,
            type: w.type,
            prescription: w.prescription as WorkoutPrescription,
          })),
      }));

    return {
      plan: { id: plan.id, raceDate: plan.raceDate, startDate: plan.startDate, ...meta },
      weeks,
    };
  });

/** How far back the coach's mileage-trend context reaches (see lib/coach.ts). */
const COACH_LOOKBACK_DAYS = 28;

const unavailableCoachFeedback: GetCoachFeedbackOutput = {
  status: "unavailable",
  guidance: null,
  concern: null,
};

const getCoachFeedback = protectedProcedure
  .input(z.void())
  .output(getCoachFeedbackOutputSchema)
  .handler(async ({ context }): Promise<GetCoachFeedbackOutput> => {
    // Checked before any DB work: with no key configured (CI, a fresh
    // checkout) this endpoint is a no-op rather than an error.
    const complete = createAnthropicCompletion(process.env.ANTHROPIC_API_KEY);
    if (!complete) return unavailableCoachFeedback;

    const user = await getOrCreateUser(context.auth.userId);
    const plan = await prisma.trainingPlan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!plan) return { status: "no_plan", guidance: null, concern: null };

    const now = new Date();
    const lookbackStart = new Date(now.getTime() - COACH_LOOKBACK_DAYS * MS_PER_DAY);

    const [meta, allPlannedWorkouts, sessionLogs] = await Promise.all([
      computePlanMeta(plan),
      prisma.plannedWorkout.findMany({ where: { planId: plan.id } }),
      prisma.sessionLog.findMany({
        where: { userId: user.id, date: { gte: lookbackStart } },
        orderBy: { date: "asc" },
      }),
    ]);

    // Planned workouts carry (weekNumber, day), not a date — the same
    // reconstruction getDashboard and the seed script both do.
    const planned: PlannedItem[] = allPlannedWorkouts.map((w) => {
      const weekStart = new Date(plan.startDate.getTime() + (w.weekNumber - 1) * MS_PER_WEEK);
      const prescription = w.prescription as WorkoutPrescription;
      return {
        id: w.id,
        date: new Date(weekStart.getTime() + WEEK_DAY_ORDER.indexOf(w.day) * MS_PER_DAY),
        type: w.type,
        miles: prescription.distanceMiles ?? null,
        quality: prescription.quality ?? null,
      };
    });

    const logged: LoggedItem[] = sessionLogs.map((s) => ({
      plannedWorkoutId: s.plannedWorkoutId,
      date: s.date,
      type: s.type,
      miles: s.distanceMiles,
      durationMin: s.durationMin,
      rpe: s.rpe,
    }));

    const snapshot = buildTrainingSnapshot({
      now,
      raceDate: plan.raceDate,
      phase: meta.phase,
      currentWeek: meta.currentWeek,
      totalWeeks: meta.totalWeeks,
      planned,
      logged,
    });

    try {
      const feedback = await requestCoachFeedback(snapshot, complete);
      return { status: "ok", guidance: feedback.guidance, concern: feedback.concern };
    } catch (error) {
      // A slow coach is not a broken one. Reported separately so the card can
      // say "try again" instead of sending the reader to a server log that has
      // no cause in it.
      if (error instanceof CoachTimeoutError) {
        console.warn("Coach feedback timed out:", error.message);
        return { status: "timed_out", guidance: null, concern: null };
      }
      // A coach outage must not take the dashboard down with it — the card
      // renders its failed state and everything else still works. Distinct
      // from "unavailable": a key *is* configured, so the fix isn't config.
      console.error("Coach feedback request failed:", error);
      return { status: "failed", guidance: null, concern: null };
    }
  });

export const router = {
  ping,
  me,
  createPlan,
  logSession,
  getDashboard,
  getSessionHistory,
  getRunningProgress,
  getPlanOverview,
  getCoachFeedback,
};

export type AppRouter = typeof router;
