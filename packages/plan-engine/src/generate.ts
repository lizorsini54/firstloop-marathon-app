import { placeSlots, WEEK_DAY_ORDER } from "@firstloop/scheduling";
import type { Slot } from "@firstloop/scheduling";
import { computePhaseBoundaries, phaseForWeek } from "./phases";
import type {
  DayOfWeek,
  GeneratedPlan,
  GeneratedWorkout,
  PlanIntake,
  RunningExperience,
  WorkoutPrescription,
  WorkoutType,
} from "./types";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MIN_TOTAL_WEEKS = 4;

const LONG_RUN_DAY: DayOfWeek = "SUNDAY";
const QUALITY_SPACING_GROUP = "QUALITY";
// How many calendar days apart two quality runs should land, at minimum.
// A judgment call (see DECISIONS.md) — Wednesday/Friday, the old fixed
// placement, were always exactly this far apart, so this preserves that
// spacing as a floor now that placement is dynamic instead of hardcoded.
const MIN_DAYS_BETWEEN_QUALITY_RUNS = 2;

const PEAK_LONG_RUN_MILES = 19;
const MIN_LONG_RUN_MILES = 4;
const INJURY_VOLUME_MULTIPLIER = 0.8;
const TAPER_RATIOS = [0.6, 0.4, 0.25, 0.15];

// Coaching judgment calls, not hard science — commonly-cited, conservative
// minimums for an injury-conscious build from a modest base, not a precise
// formula. A first marathon needs meaningfully more runway than a repeat
// one. See DECISIONS.md for the full reasoning.
export const MIN_WEEKS_FIRST_TIMER = 20;
export const MIN_WEEKS_EXPERIENCED = 12;

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

  make(LONG_RUN_DAY, "RUN", {
    distanceMiles: longRunMiles(weekNumber, phase, boundaries, startingLongRun, peakTarget),
    quality: "long",
  });

  // The long run counts as one of the runner's stated weekly running days —
  // everything else fills out from there as quality (once the phase
  // introduces it) and easy runs, not a single additional long run repeated
  // every week.
  const otherRunDays = Math.max(0, intake.runningDaysPerWeek - 1);
  const baseQualityDayCount = phase === "peak" ? 2 : phase === "build" ? 1 : 0;
  const qualityDayCount = Math.min(baseQualityDayCount, otherRunDays);
  const easyDayCount = otherRunDays - qualityDayCount;

  const runSlots: Slot[] = [
    ...Array.from({ length: qualityDayCount }, (_, i) => ({
      name: `QUALITY_${i}`,
      respectsInterference: true,
      spacingGroup: QUALITY_SPACING_GROUP,
    })),
    ...Array.from({ length: easyDayCount }, (_, i) => ({
      name: `EASY_${i}`,
      respectsInterference: false,
    })),
  ];
  // Only the long run is already fixed at this point, so "everything not
  // yet used" and "everything but the long run day" are the same set —
  // simpler to express directly than to re-derive from `used`.
  const runPlacements = placeSlots(
    runSlots,
    WEEK_DAY_ORDER.filter((d) => d !== LONG_RUN_DAY),
    [LONG_RUN_DAY],
    MIN_DAYS_BETWEEN_QUALITY_RUNS,
  );

  for (let i = 0; i < qualityDayCount; i++) {
    const day = runPlacements.get(`QUALITY_${i}`);
    if (!day) continue;
    make(day, "RUN", {
      quality: i === 0 ? "tempo" : "intervals",
      durationMin: phase === "peak" ? 45 : 40,
      notes: i === 0 ? "Tempo run" : "Interval session",
    });
  }

  for (let i = 0; i < easyDayCount; i++) {
    const day = runPlacements.get(`EASY_${i}`);
    if (!day) continue;
    make(day, "RUN", { quality: "easy", durationMin: 30, notes: "Easy run" });
  }

  const bikeDays = WEEK_DAY_ORDER.filter((d) => !used.has(d)).slice(0, intake.bikeDaysPerWeek);
  bikeDays.forEach((day) => {
    make(day, "BIKE", { durationMin: 45, notes: "Cross-training ride" });
  });

  const restDays = WEEK_DAY_ORDER.filter((d) => !used.has(d));
  restDays.forEach((day) => {
    make(day, "REST", {});
  });

  return workouts;
}

/** How many full weeks fall between startDate and raceDate. Never negative. */
export function estimateAvailableWeeks(raceDate: Date, startDate: Date): number {
  return Math.max(0, Math.ceil((raceDate.getTime() - startDate.getTime()) / MS_PER_WEEK));
}

export interface FeasibilityResult {
  feasible: boolean;
  /** Names the actual gap; null when the timeline meets the minimum. */
  warning: string | null;
}

/**
 * Compares the available timeline against a reasonable minimum safe
 * buildup — a coaching judgment call (see MIN_WEEKS_* above), not a hard
 * block. Callers decide whether to surface the warning and whether to let
 * the user proceed anyway (they should).
 */
export function checkFeasibility(
  availableWeeks: number,
  runningExperience: RunningExperience,
): FeasibilityResult {
  const minWeeks = runningExperience === "first_marathon" ? MIN_WEEKS_FIRST_TIMER : MIN_WEEKS_EXPERIENCED;
  if (availableWeeks >= minWeeks) {
    return { feasible: true, warning: null };
  }

  const gap = minWeeks - availableWeeks;
  const audience = runningExperience === "first_marathon" ? "a first marathon" : "someone who's finished one before";
  return {
    feasible: false,
    warning:
      `Only ${availableWeeks} week${availableWeeks === 1 ? "" : "s"} until race day — we recommend at least ` +
      `${minWeeks} for ${audience} (${gap} week${gap === 1 ? "" : "s"} short).`,
  };
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
