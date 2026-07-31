import { z } from "zod";

const weeklyRunningProgressEntrySchema = z.object({
  weekStart: z.date(),
  // Null when the week's runs were all logged without a distance — same
  // convention as averagePaceMinPerMile below, so "not measured in miles"
  // never renders as a real zero.
  totalMiles: z.number().nullable(),
  // Mileage-weighted average (total minutes / total miles across logs that
  // have both fields) — null when a week has no run with both distance and
  // duration logged.
  averagePaceMinPerMile: z.number().nullable(),
});

export const getRunningProgressOutputSchema = z.object({
  weeks: z.array(weeklyRunningProgressEntrySchema),
});

export type GetRunningProgressOutput = z.infer<typeof getRunningProgressOutputSchema>;
