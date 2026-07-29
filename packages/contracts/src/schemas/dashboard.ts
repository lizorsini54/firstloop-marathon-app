import { z } from "zod";
import { dayOfWeekSchema, workoutTypeSchema } from "./enums";

const prescriptionSchema = z.object({
  distanceMiles: z.number().optional(),
  durationMin: z.number().optional(),
  quality: z.enum(["easy", "tempo", "intervals", "long"]).optional(),
  reducedVolume: z.boolean().optional(),
  notes: z.string().optional(),
});

const plannedWorkoutSchema = z.object({
  id: z.string(),
  day: dayOfWeekSchema,
  type: workoutTypeSchema,
  prescription: prescriptionSchema,
});

const sessionLogSchema = z.object({
  id: z.string(),
  date: z.date(),
  type: workoutTypeSchema,
  distanceMiles: z.number().nullable(),
  durationMin: z.number(),
  rpe: z.number(),
  notes: z.string().nullable(),
  plannedWorkoutId: z.string().nullable(),
});

const weeklyMileageSchema = z.object({
  weekNumber: z.number().int(),
  plannedMiles: z.number(),
  actualMiles: z.number(),
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
  weeklyMileageHistory: z.array(weeklyMileageSchema),
});

export type DashboardOutput = z.infer<typeof dashboardOutputSchema>;
