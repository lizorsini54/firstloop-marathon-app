import { DayOfWeek, WorkoutType } from "@firstloop/db";
import { computePhaseBoundaries, phaseForWeek } from "./phases";
import type { GeneratedPlan, GeneratedWorkout, PlanIntake, WorkoutPrescription } from "./types";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MIN_TOTAL_WEEKS = 4;

const LONG_RUN_DAY = DayOfWeek.SUNDAY;
const QUALITY_DAYS: DayOfWeek[] = [DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY];
const LIFT_CANDIDATE_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];
const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

const PEAK_LONG_RUN_MILES = 19;
const MIN_LONG_RUN_MILES = 4;
const INJURY_VOLUME_MULTIPLIER = 0.8;
const TAPER_RATIOS = [0.6, 0.4, 0.25, 0.15];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Weekly multiplier so startingLongRun compounds to exactly peakTarget by
 * the last week of build (base+build weeks of growth) — "~10%/week" is a
 * guideline, not literal: a fixed 10% compounded over a long base phase
 * blows past any fixed peak target well before build even starts.
 * Never goes below 1 (long run doesn't shrink during base/build).
 */
function longRunGrowthRate(
  startingLongRun: number,
  peakTarget: number,
  growthWeeks: number,
): number {
  if (growthWeeks <= 1) return 1;
  return Math.max(1, (peakTarget / startingLongRun) ** (1 / (growthWeeks - 1)));
}

function longRunMiles(
  weekNumber: number,
  phase: ReturnType<typeof phaseForWeek>,
  boundaries: ReturnType<typeof computePhaseBoundaries>,
  startingLongRun: number,
  peakTarget: number,
): number {
  const { base, build, peak } = boundaries;

  if (phase === "base" || phase === "build") {
    const growthRate = longRunGrowthRate(startingLongRun, peakTarget, base + build);
    const miles = startingLongRun * growthRate ** (weekNumber - 1);
    return round1(Math.min(miles, peakTarget));
  }

  if (phase === "peak") {
    return round1(peakTarget);
  }

  const weekIntoTaper = weekNumber - base - build - peak;
  const lastRatio = TAPER_RATIOS.at(-1) ?? 0.15;
  const ratio = TAPER_RATIOS[weekIntoTaper - 1] ?? lastRatio;
  return round1(Math.max(MIN_LONG_RUN_MILES, peakTarget * ratio));
}

function workoutsForWeek(
  weekNumber: number,
  intake: PlanIntake,
  boundaries: ReturnType<typeof computePhaseBoundaries>,
  startingLongRun: number,
  peakTarget: number,
): GeneratedWorkout[] {
  const phase = phaseForWeek(weekNumber, boundaries);
  const used = new Set<DayOfWeek>();
  const workouts: GeneratedWorkout[] = [];

  const make = (day: DayOfWeek, type: WorkoutType, prescription: WorkoutPrescription) => {
    used.add(day);
    workouts.push({ weekNumber, day, type, prescription });
  };

  make(LONG_RUN_DAY, WorkoutType.RUN, {
    distanceMiles: longRunMiles(weekNumber, phase, boundaries, startingLongRun, peakTarget),
    quality: "long",
  });

  const qualityDayCount = phase === "peak" ? 2 : phase === "build" ? 1 : 0;
  for (let i = 0; i < qualityDayCount; i++) {
    const day = QUALITY_DAYS[i];
    if (!day) continue;
    make(day, WorkoutType.RUN, {
      quality: i === 0 ? "tempo" : "intervals",
      durationMin: phase === "peak" ? 45 : 40,
      notes: i === 0 ? "Tempo run" : "Interval session",
    });
  }

  const liftDays = LIFT_CANDIDATE_DAYS.filter((d) => !used.has(d)).slice(
    0,
    intake.liftDaysPerWeek,
  );
  liftDays.forEach((day, i) => {
    const reduced = phase === "build" && i === 0;
    make(day, WorkoutType.LIFT, {
      reducedVolume: reduced,
      notes: reduced ? "Lift session (reduced volume — long run week)" : "Lift session",
    });
  });

  const bikeDays = ALL_DAYS.filter((d) => !used.has(d)).slice(0, intake.bikeDaysPerWeek);
  bikeDays.forEach((day) => {
    make(day, WorkoutType.BIKE, { durationMin: 45, notes: "Cross-training ride" });
  });

  const restDays = ALL_DAYS.filter((d) => !used.has(d));
  restDays.forEach((day) => {
    make(day, WorkoutType.REST, {});
  });

  return workouts;
}

/**
 * Pure function: intake -> full week-by-week workout schedule. No DB, no
 * network — the swappable module the plan-generation logic lives in.
 */
export function generatePlan(intake: PlanIntake): GeneratedPlan {
  const rawWeeks = Math.ceil(
    (intake.raceDate.getTime() - intake.startDate.getTime()) / MS_PER_WEEK,
  );
  const totalWeeks = Math.max(MIN_TOTAL_WEEKS, rawWeeks);
  const boundaries = computePhaseBoundaries(totalWeeks);

  const hasInjury = intake.injuryFlags.length > 0;
  const volumeMultiplier = hasInjury ? INJURY_VOLUME_MULTIPLIER : 1;
  const startingLongRun = Math.max(3, intake.currentWeeklyMileage * 0.35) * volumeMultiplier;
  const peakTarget = PEAK_LONG_RUN_MILES * volumeMultiplier;

  const workouts: GeneratedWorkout[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    workouts.push(...workoutsForWeek(week, intake, boundaries, startingLongRun, peakTarget));
  }

  const warnings = intake.injuryFlags.map(
    (flag) =>
      `Reduced peak long-run mileage by ${Math.round((1 - INJURY_VOLUME_MULTIPLIER) * 100)}% due to reported injury: ${flag}.`,
  );

  return { totalWeeks, workouts, warnings };
}
