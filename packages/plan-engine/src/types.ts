// Mirrors the Prisma schema's DayOfWeek/WorkoutType enums by value (not
// imported from @firstloop/db) so this package stays fully standalone —
// no DB dependency at all, not even for enum shapes. That matters in
// practice: packages/db's seed script needs generatePlan(), and a plan-engine
// -> db dependency would make that circular.
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type WorkoutType = "RUN" | "LIFT" | "BIKE" | "REST";

export interface PlanIntake {
  raceDate: Date;
  startDate: Date;
  currentWeeklyMileage: number;
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
