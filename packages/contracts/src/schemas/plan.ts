import { z } from "zod";

export const createPlanInputSchema = z.object({
  raceDate: z.coerce.date(),
  currentWeeklyMileage: z.number().positive(),
  liftDaysPerWeek: z.number().int().min(0).max(7),
  bikeDaysPerWeek: z.number().int().min(0).max(7),
  injuryFlags: z.array(z.string().min(1)).default([]),
});

export const createPlanOutputSchema = z.object({
  planId: z.string(),
  totalWeeks: z.number().int(),
  warnings: z.array(z.string()),
});

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;
export type CreatePlanOutput = z.infer<typeof createPlanOutputSchema>;
