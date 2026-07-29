import { WEEK_DAY_ORDER } from "@firstloop/scheduling";
import { describe, expect, test } from "bun:test";
import { checkFeasibility, generatePlan, MIN_WEEKS_EXPERIENCED, MIN_WEEKS_FIRST_TIMER } from "./generate";
import { computePhaseBoundaries, phaseForWeek } from "./phases";
import type { GeneratedWorkout, PlanIntake } from "./types";

const PEAK_LONG_RUN_MILES = 19;
const MIN_LONG_RUN_MILES = 4;

function makeIntake(overrides: Partial<PlanIntake> = {}): PlanIntake {
  return {
    raceDate: new Date("2027-02-27"),
    startDate: new Date("2026-06-01"),
    currentWeeklyMileage: 25,
    runningExperience: "has_finished_one",
    runningDaysPerWeek: 4,
    bikeDaysPerWeek: 1,
    injuryFlags: [],
    ...overrides,
  };
}

// A range of race dates against a fixed start date, producing a range of
// total plan lengths — this is the "range of race dates" the brief asks for.
const RACE_DATES = [
  "2026-10-15", // ~20 weeks
  "2027-01-10", // ~32 weeks
  "2027-02-27", // ~39 weeks
  "2027-06-01", // ~52 weeks
];

function byWeek(workouts: GeneratedWorkout[]): Map<number, GeneratedWorkout[]> {
  const map = new Map<number, GeneratedWorkout[]>();
  for (const w of workouts) {
    const bucket = map.get(w.weekNumber);
    if (bucket) bucket.push(w);
    else map.set(w.weekNumber, [w]);
  }
  return map;
}

function longRunByWeek(workouts: GeneratedWorkout[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const w of workouts) {
    if (w.prescription.quality === "long" && w.prescription.distanceMiles !== undefined) {
      result.set(w.weekNumber, w.prescription.distanceMiles);
    }
  }
  return result;
}

describe("generatePlan — long-run progression", () => {
  for (const raceDate of RACE_DATES) {
    test(`monotonically progresses through base/build and reaches the peak target for race date ${raceDate}`, () => {
      const intake = makeIntake({ raceDate: new Date(raceDate) });
      const { workouts, totalWeeks } = generatePlan(intake);
      const longRuns = longRunByWeek(workouts);
      const { base, build } = computePhaseBoundaries(totalWeeks);

      // Only base+build should be monotonically progressing — taper is
      // deliberately a sharp drop, checked separately below.
      let previous = 0;
      for (let week = 1; week <= base + build; week++) {
        const miles = longRuns.get(week);
        expect(miles).toBeDefined();
        expect(miles as number).toBeGreaterThanOrEqual(previous);
        previous = miles as number;
      }

      // Peak target is reached (not overshot) — this guards the exact bug
      // found in Checkpoint 3, where literal 10%/week compounding blew past
      // any fixed peak target well before a multi-month base phase ended.
      expect(Math.max(...longRuns.values())).toBeLessThanOrEqual(PEAK_LONG_RUN_MILES);
      expect(Math.max(...longRuns.values())).toBeCloseTo(PEAK_LONG_RUN_MILES, 0);
    });
  }

  test("plateaus at the peak target for every week of the peak phase", () => {
    const intake = makeIntake({ raceDate: new Date("2027-02-27") });
    const { workouts } = generatePlan(intake);
    const longRuns = longRunByWeek(workouts);

    // 39-week plan -> base 16 / build 14 / peak 6 / taper 3 (see phases.test.ts)
    const peakWeeks = [31, 32, 33, 34, 35, 36];
    const peakValues = peakWeeks.map((w) => longRuns.get(w));
    for (const value of peakValues) {
      expect(value).toBeCloseTo(PEAK_LONG_RUN_MILES, 0);
    }
  });
});

describe("generatePlan — taper behavior", () => {
  test("taper mileage never increases and never drops below the floor", () => {
    const intake = makeIntake({ raceDate: new Date("2027-02-27") });
    const { workouts } = generatePlan(intake);
    const longRuns = longRunByWeek(workouts);

    const taperWeeks = [37, 38, 39]; // 39-week plan's taper phase
    let previous = Infinity;
    for (const week of taperWeeks) {
      const miles = longRuns.get(week) as number;
      expect(miles).toBeLessThanOrEqual(previous);
      expect(miles).toBeGreaterThanOrEqual(MIN_LONG_RUN_MILES);
      previous = miles;
    }
  });

  test("first taper week drops meaningfully below the peak long run", () => {
    const intake = makeIntake({ raceDate: new Date("2027-02-27") });
    const { workouts } = generatePlan(intake);
    const longRuns = longRunByWeek(workouts);

    const lastPeakWeek = longRuns.get(36) as number;
    const firstTaperWeek = longRuns.get(37) as number;
    expect(firstTaperWeek).toBeLessThan(lastPeakWeek);
  });
});

describe("generatePlan — injury-flag path", () => {
  test("produces one warning per injury flag, each mentioning that flag", () => {
    const intake = makeIntake({ injuryFlags: ["Knee", "IT band"] });
    const { warnings } = generatePlan(intake);

    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes("Knee"))).toBe(true);
    expect(warnings.some((w) => w.includes("IT band"))).toBe(true);
  });

  test("no warnings when no injury flags are reported", () => {
    const intake = makeIntake({ injuryFlags: [] });
    const { warnings } = generatePlan(intake);
    expect(warnings).toEqual([]);
  });

  test("reduces peak long-run volume relative to an identical plan with no injury", () => {
    const healthy = generatePlan(makeIntake({ injuryFlags: [] }));
    const injured = generatePlan(makeIntake({ injuryFlags: ["Knee"] }));

    const healthyPeak = Math.max(...longRunByWeek(healthy.workouts).values());
    const injuredPeak = Math.max(...longRunByWeek(injured.workouts).values());

    expect(injuredPeak).toBeLessThan(healthyPeak);
  });

  test("volume is never silently unreduced — injury always changes the output", () => {
    const healthy = generatePlan(makeIntake({ injuryFlags: [] }));
    const injured = generatePlan(makeIntake({ injuryFlags: ["Shin splints"] }));
    expect(injured.warnings.length).toBeGreaterThan(healthy.warnings.length);
  });
});

describe("generatePlan — structural sanity", () => {
  test("every week has exactly 7 workouts across 7 distinct days", () => {
    const { workouts, totalWeeks } = generatePlan(makeIntake());
    const weeks = byWeek(workouts);

    expect(weeks.size).toBe(totalWeeks);
    for (const weekWorkouts of weeks.values()) {
      expect(weekWorkouts).toHaveLength(7);
      expect(new Set(weekWorkouts.map((w) => w.day)).size).toBe(7);
    }
  });

  test("no quality (tempo/intervals) sessions in base or taper phases", () => {
    const { workouts } = generatePlan(makeIntake({ raceDate: new Date("2027-02-27") }));
    // 39-week plan: base = weeks 1-16, taper = weeks 37-39
    const baseAndTaperWeeks = new Set([
      ...Array.from({ length: 16 }, (_, i) => i + 1),
      37,
      38,
      39,
    ]);

    for (const w of workouts) {
      if (!baseAndTaperWeeks.has(w.weekNumber)) continue;
      expect(w.prescription.quality === "tempo" || w.prescription.quality === "intervals").toBe(
        false,
      );
    }
  });

  test("bike days never land on the long-run day", () => {
    const { workouts } = generatePlan(makeIntake());
    const longRunDay = WEEK_DAY_ORDER[6]; // SUNDAY

    for (const w of workouts) {
      if (w.day !== longRunDay) continue;
      expect(w.type).not.toBe("BIKE");
    }
  });

  test("respects the requested bike day count in an easy (non-quality) week", () => {
    const intake = makeIntake({ bikeDaysPerWeek: 2 });
    const { workouts } = generatePlan(intake);
    const week1 = workouts.filter((w) => w.weekNumber === 1);

    expect(week1.filter((w) => w.type === "BIKE")).toHaveLength(2);
  });
});

describe("generatePlan — running frequency", () => {
  // The brief's "range of experience levels and plan lengths" for the run-
  // frequency fix specifically — a 39-week plan exercises every phase.
  const RUNNING_DAYS_VALUES = [1, 3, 5, 7];

  for (const runningDaysPerWeek of RUNNING_DAYS_VALUES) {
    test(`schedules exactly ${runningDaysPerWeek} run day(s)/week with the phase-correct quality count and no quality run the day before the long run`, () => {
      const intake = makeIntake({ runningDaysPerWeek, raceDate: new Date("2027-02-27") });
      const { workouts, totalWeeks } = generatePlan(intake);
      const boundaries = computePhaseBoundaries(totalWeeks);

      for (let week = 1; week <= totalWeeks; week++) {
        const runWorkouts = workouts.filter((w) => w.weekNumber === week && w.type === "RUN");
        const phase = phaseForWeek(week, boundaries);

        expect(runWorkouts).toHaveLength(runningDaysPerWeek);

        const longRuns = runWorkouts.filter((w) => w.prescription.quality === "long");
        expect(longRuns).toHaveLength(1);
        expect(longRuns[0]?.day).toBe("SUNDAY");

        const otherRunDays = Math.max(0, runningDaysPerWeek - 1);
        const expectedQualityCount = Math.min(
          phase === "peak" ? 2 : phase === "build" ? 1 : 0,
          otherRunDays,
        );
        const qualityRuns = runWorkouts.filter(
          (w) => w.prescription.quality === "tempo" || w.prescription.quality === "intervals",
        );
        expect(qualityRuns).toHaveLength(expectedQualityCount);

        const easyRuns = runWorkouts.filter((w) => w.prescription.quality === "easy");
        expect(easyRuns).toHaveLength(otherRunDays - expectedQualityCount);

        // "Avoid the day before a long run" is scoped to quality runs —
        // Saturday (the day before Sunday's long run) should never host one.
        for (const q of qualityRuns) {
          expect(q.day).not.toBe("SATURDAY");
        }
      }
    });
  }

  test("a runner who only chose 1 day/week gets just the long run — no easy runs added on top", () => {
    const intake = makeIntake({ runningDaysPerWeek: 1 });
    const { workouts } = generatePlan(intake);
    const week1Runs = workouts.filter((w) => w.weekNumber === 1 && w.type === "RUN");

    expect(week1Runs).toHaveLength(1);
    expect(week1Runs[0]?.prescription.quality).toBe("long");
  });
});

describe("checkFeasibility — boundary behavior", () => {
  test("exactly at the minimum is feasible for a first marathon", () => {
    const result = checkFeasibility(MIN_WEEKS_FIRST_TIMER, "first_marathon");
    expect(result.feasible).toBe(true);
    expect(result.warning).toBeNull();
  });

  test("one week short of the minimum is not feasible for a first marathon, and names the gap", () => {
    const result = checkFeasibility(MIN_WEEKS_FIRST_TIMER - 1, "first_marathon");
    expect(result.feasible).toBe(false);
    expect(result.warning).toContain(String(MIN_WEEKS_FIRST_TIMER - 1));
    expect(result.warning).toContain(String(MIN_WEEKS_FIRST_TIMER));
  });

  test("exactly at the minimum is feasible for someone who's finished one before", () => {
    const result = checkFeasibility(MIN_WEEKS_EXPERIENCED, "has_finished_one");
    expect(result.feasible).toBe(true);
    expect(result.warning).toBeNull();
  });

  test("one week short of the minimum is not feasible for someone who's finished one before", () => {
    const result = checkFeasibility(MIN_WEEKS_EXPERIENCED - 1, "has_finished_one");
    expect(result.feasible).toBe(false);
    expect(result.warning).toContain(String(MIN_WEEKS_EXPERIENCED - 1));
    expect(result.warning).toContain(String(MIN_WEEKS_EXPERIENCED));
  });

  test("well short of the minimum still reports the correct gap", () => {
    const result = checkFeasibility(10, "first_marathon");
    expect(result.feasible).toBe(false);
    expect(result.warning).toContain("10 week");
    expect(result.warning).toContain(`${MIN_WEEKS_FIRST_TIMER}`);
    expect(result.warning).toContain(`${MIN_WEEKS_FIRST_TIMER - 10} week`);
  });
});
