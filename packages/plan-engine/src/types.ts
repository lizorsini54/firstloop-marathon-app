import type { DayOfWeek, WorkoutType } from "@firstloop/db";

export interface PlanIntake {
  raceDate: Date;
  startDate: Date;
  currentWeeklyMileage: number;
  liftDaysPerWeek: number;
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
