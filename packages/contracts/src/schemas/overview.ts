import { z } from "zod";
import { planMetaSchema, plannedWorkoutSchema } from "./dashboard";

const planWeekSchema = z.object({
  weekNumber: z.number().int(),
  workouts: z.array(plannedWorkoutSchema),
});

export const getPlanOverviewOutputSchema = z.object({
  plan: planMetaSchema.nullable(),
  weeks: z.array(planWeekSchema),
});

export type GetPlanOverviewOutput = z.infer<typeof getPlanOverviewOutputSchema>;
