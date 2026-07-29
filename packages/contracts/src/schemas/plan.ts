import { z } from "zod";

export const strengthModeSchema = z.enum(["program", "custom", "none"]);
export const runningExperienceSchema = z.enum(["first_marathon", "has_finished_one"]);

export const createPlanInputSchema = z
  .object({
    raceDate: z.coerce.date(),
    currentWeeklyMileage: z.number().positive(),
    runningExperience: runningExperienceSchema,
    runningDaysPerWeek: z.number().int().min(1).max(7),
    strengthMode: strengthModeSchema,
    customLiftDaysPerWeek: z.number().int().min(1).max(4).optional(),
    bikeDaysPerWeek: z.number().int().min(0).max(7),
    injuryFlags: z.array(z.string().min(1)).default([]),
  })
  .refine((data) => data.strengthMode !== "custom" || typeof data.customLiftDaysPerWeek === "number", {
    message: "Pick how many days you'll lift.",
    path: ["customLiftDaysPerWeek"],
  });

export const createPlanOutputSchema = z.object({
  planId: z.string(),
  totalWeeks: z.number().int(),
  warnings: z.array(z.string()),
});

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;
export type CreatePlanOutput = z.infer<typeof createPlanOutputSchema>;
