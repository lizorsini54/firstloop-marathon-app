import { z } from "zod";
import { workoutTypeSchema } from "./enums";
import { setLogEntrySchema } from "./session";

const sessionHistoryEntrySchema = z.object({
  id: z.string(),
  date: z.date(),
  type: workoutTypeSchema,
  distanceMiles: z.number().nullable(),
  durationMin: z.number(),
  rpe: z.number(),
  notes: z.string().nullable(),
  plannedWorkoutId: z.string().nullable(),
  setLog: z.array(setLogEntrySchema).nullable(),
});

export const getSessionHistoryOutputSchema = z.object({
  sessionLogs: z.array(sessionHistoryEntrySchema),
});

export type GetSessionHistoryOutput = z.infer<typeof getSessionHistoryOutputSchema>;
