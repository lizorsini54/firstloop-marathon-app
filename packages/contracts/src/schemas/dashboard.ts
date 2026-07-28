import { DayOfWeek, WorkoutType } from "@firstloop/db";
import { z } from "zod";

const prescriptionSchema = z.object({
  distanceMiles: z.number().optional(),
  durationMin: z.number().optional(),
  quality: z.enum(["easy", "tempo", "intervals", "long"]).optional(),
  reducedVolume: z.boolean().optional(),
  notes: z.string().optional(),
});

const plannedWorkoutSchema = z.object({
  id: z.string(),
  day: z.nativeEnum(DayOfWeek),
  type: z.nativeEnum(WorkoutType),
  prescription: prescriptionSchema,
});

const sessionLogSchema = z.object({
  id: z.string(),
  date: z.date(),
  type: z.nativeEnum(WorkoutType),
  distanceMiles: z.number().nullable(),
  durationMin: z.number(),
  rpe: z.number(),
  notes: z.string().nullable(),
  plannedWorkoutId: z.string().nullable(),
});

export const dashboardOutputSchema = z.object({
  plan: z
    .object({
      id: z.string(),
      raceDate: z.date(),
      startDate: z.date(),
      totalWeeks: z.number().int(),
      currentWeek: z.number().int(),
      phase: z.enum(["base", "build", "peak", "taper"]),
    })
    .nullable(),
  plannedWorkouts: z.array(plannedWorkoutSchema),
  sessionLogs: z.array(sessionLogSchema),
  weeklyMileageTotal: z.number(),
});

export type DashboardOutput = z.infer<typeof dashboardOutputSchema>;
