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

/**
 * Extends the create shape rather than restating it, so the two write paths
 * cannot drift in what they accept. Anything `logSession` takes, an edit takes.
 */
export const updateSessionLogInputSchema = logSessionInputSchema.extend({
  sessionLogId: z.string(),
});

export const deleteSessionLogInputSchema = z.object({
  sessionLogId: z.string(),
});

export const deleteSessionLogOutputSchema = z.object({
  deletedSessionLogId: z.string(),
});

export type LogSessionInput = z.infer<typeof logSessionInputSchema>;
export type LogSessionOutput = z.infer<typeof logSessionOutputSchema>;
export type UpdateSessionLogInput = z.infer<typeof updateSessionLogInputSchema>;
export type SetLogEntry = z.infer<typeof setLogEntrySchema>;
