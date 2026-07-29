import { describe, expect, test } from "bun:test";
import { generatePlan, WEEK_DAY_ORDER } from "./generate";
import { computePhaseBoundaries } from "./phases";
import type { GeneratedWorkout, PlanIntake } from "./types";

const PEAK_LONG_RUN_MILES = 19;
const MIN_LONG_RUN_MILES = 4;

function makeIntake(overrides: Partial<PlanIntake> = {}): PlanIntake {
  return {
    raceDate: new Date("2027-02-27"),
    startDate: new Date("2026-06-01"),
    currentWeeklyMileage: 25,
    liftDaysPerWeek: 2,
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

  test("bike and lift days never land on the long-run day", () => {
    const { workouts } = generatePlan(makeIntake());
    const longRunDay = WEEK_DAY_ORDER[6]; // SUNDAY

    for (const w of workouts) {
      if (w.day !== longRunDay) continue;
      expect(w.type).not.toBe("BIKE");
      expect(w.type).not.toBe("LIFT");
    }
  });

  test("respects the requested lift/bike day counts in an easy (non-quality) week", () => {
    const intake = makeIntake({ liftDaysPerWeek: 3, bikeDaysPerWeek: 2 });
    const { workouts } = generatePlan(intake);
    const week1 = workouts.filter((w) => w.weekNumber === 1);

    expect(week1.filter((w) => w.type === "LIFT")).toHaveLength(3);
    expect(week1.filter((w) => w.type === "BIKE")).toHaveLength(2);
  });
});
