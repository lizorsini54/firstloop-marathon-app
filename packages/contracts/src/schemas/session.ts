import { z } from "zod";
import { workoutTypeSchema } from "./enums";

export const setLogEntrySchema = z.object({
  exercise: z.string(),
  sets: z.array(
    z.object({
      reps: z.number().int().positive(),
      weightLbs: z.number().nonnegative(),
    }),
  ),
});

export const logSessionInputSchema = z.object({
  date: z.coerce.date(),
  type: workoutTypeSchema,
  distanceMiles: z.number().positive().optional(),
  durationMin: z.number().int().positive(),
  rpe: z.number().int().min(1).max(10),
  notes: z.string().optional(),
  plannedWorkoutId: z.string().optional(),
  setLog: z.array(setLogEntrySchema).optional(),
});

export const logSessionOutputSchema = z.object({
  sessionLogId: z.string(),
});

export type LogSessionInput = z.infer<typeof logSessionInputSchema>;
export type LogSessionOutput = z.infer<typeof logSessionOutputSchema>;
export type SetLogEntry = z.infer<typeof setLogEntrySchema>;
