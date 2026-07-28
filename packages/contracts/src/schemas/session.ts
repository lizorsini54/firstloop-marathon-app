import { WorkoutType } from "@firstloop/db";
import { z } from "zod";

export const logSessionInputSchema = z.object({
  date: z.coerce.date(),
  type: z.nativeEnum(WorkoutType),
  distanceMiles: z.number().positive().optional(),
  durationMin: z.number().int().positive(),
  rpe: z.number().int().min(1).max(10),
  notes: z.string().optional(),
  plannedWorkoutId: z.string().optional(),
});

export const logSessionOutputSchema = z.object({
  sessionLogId: z.string(),
});

export type LogSessionInput = z.infer<typeof logSessionInputSchema>;
export type LogSessionOutput = z.infer<typeof logSessionOutputSchema>;
