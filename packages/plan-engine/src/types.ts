// Re-exported from the shared scheduling package (not defined here) so
// nothing downstream has to change its imports — see
// packages/scheduling/src/types.ts for why this is now the single source
// of truth instead of being mirrored separately in each package. Mirroring
// Prisma's enums by value (rather than importing @firstloop/db) is still
// the reason this package has no DB dependency at all — packages/db's seed
// script needs generatePlan(), and a plan-engine -> db dependency would be
// circular.
export { WEEK_DAY_ORDER } from "@firstloop/scheduling";
export type { DayOfWeek } from "@firstloop/scheduling";
import type { DayOfWeek } from "@firstloop/scheduling";

export type WorkoutType = "RUN" | "LIFT" | "BIKE" | "REST";

// A simple choice, not a finish-time or race-count input — used only for
// the feasibility check and the running-frequency baseline, nothing more
// elaborate.
export type RunningExperience = "first_marathon" | "has_finished_one";

export interface PlanIntake {
  raceDate: Date;
  startDate: Date;
  currentWeeklyMileage: number;
  runningExperience: RunningExperience;
  runningDaysPerWeek: number;
  bikeDaysPerWeek: number;
  injuryFlags: string[];
}

export interface WorkoutPrescription {
  distanceMiles?: number;
  durationMin?: number;
  quality?: "easy" | "tempo" | "intervals" | "long";
  reducedVolume?: boolean;
  notes?: string;
}

export interface GeneratedWorkout {
  weekNumber: number;
  day: DayOfWeek;
  type: WorkoutType;
  prescription: WorkoutPrescription;
}

export interface GeneratedPlan {
  totalWeeks: number;
  workouts: GeneratedWorkout[];
  warnings: string[];
}
