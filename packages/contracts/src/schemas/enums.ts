import { z } from "zod";

// Mirrors the Prisma schema's DayOfWeek/WorkoutType enums by value, not
// imported from @firstloop/db — schemas need to stay safe to import as a
// runtime value from apps/web (client-side validation), and @firstloop/db
// instantiates a real PrismaClient at module scope. Importing its enums
// here would drag that into the browser bundle. Same reasoning as
// packages/plan-engine's standalone enum types (see DECISIONS.md).
export const workoutTypeSchema = z.enum(["RUN", "LIFT", "BIKE", "REST"]);
export const dayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);
