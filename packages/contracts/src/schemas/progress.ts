import { z } from "zod";

const weeklyRunningProgressEntrySchema = z.object({
  weekStart: z.date(),
  totalMiles: z.number(),
  // Mileage-weighted average (total minutes / total miles across logs that
  // have both fields) — null when a week has no run with both distance and
  // duration logged.
  averagePaceMinPerMile: z.number().nullable(),
});

export const getRunningProgressOutputSchema = z.object({
  weeks: z.array(weeklyRunningProgressEntrySchema),
});

export type GetRunningProgressOutput = z.infer<typeof getRunningProgressOutputSchema>;
