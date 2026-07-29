import { describe, expect, test } from "bun:test";
import { buildCustomProgram } from "./programs/custom";
import { gluteGladiator } from "./programs/glute-gladiator";
import { checkDayEconomy, scheduleStrengthSessions } from "./schedule";
import type { SessionName, WeekContext } from "./types";

function makeWeek(overrides: Partial<WeekContext> & { weekNumber: number }): WeekContext {
  return {
    availableDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"],
    interferenceDays: ["FRIDAY", "SUNDAY"],
    isPeakMileageWeek: false,
    isDownDeloadWeek: false,
    ...overrides,
  };
}

describe("peak-mileage week cutback", () => {
  test("drops to the reduced session count, cutting Lower B first", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 1, isPeakMileageWeek: true }),
    ]);

    expect(workouts).toHaveLength(gluteGladiator.reducedSessionCount);
    const names = workouts.map((w) => w.prescription.sessionName);
    expect(names).not.toContain("LOWER_B");
    const expectedNames: SessionName[] = ["LOWER_A", "UPPER_A", "UPPER_B"];
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
  });
});

describe("deload-week alignment", () => {
  test("forces the program's deload block even when raw cycle position says otherwise", () => {
    // Week 1 of the cycle is "Build" by raw position, but the running plan
    // says this week is a down/deload week — deload should win.
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 1, isDownDeloadWeek: true }),
    ]);

    for (const w of workouts) {
      expect(w.prescription.block).toBe("Deload");
      expect(w.prescription.isDeloadWeek).toBe(true);
    }

    const lowerA = workouts.find((w) => w.prescription.sessionName === "LOWER_A");
    const hipThrust = lowerA?.prescription.exercises.find((e) => e.name === "Barbell Hip Thrust");
    expect(hipThrust?.setsReps).toBe("4 x 8 (light)");
  });

  test("does not force deload on an ordinary week", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [makeWeek({ weekNumber: 1 })]);
    const lowerA = workouts.find((w) => w.prescription.sessionName === "LOWER_A");
    expect(lowerA?.prescription.block).toBe("Build");
    expect(lowerA?.prescription.isDeloadWeek).toBe(false);
  });
});

describe("cycle math across plan lengths", () => {
  test.each([4, 12, 13, 25, 39])("tiles the 12-week cycle correctly for a %i-week plan", (totalWeeks) => {
    const weeks = Array.from({ length: totalWeeks }, (_, i) => makeWeek({ weekNumber: i + 1 }));
    const workouts = scheduleStrengthSessions(gluteGladiator, weeks);

    for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
      const expectedWeekInCycle = ((weekNumber - 1) % gluteGladiator.cycleLengthWeeks) + 1;
      const weekWorkouts = workouts.filter((w) => w.weekNumber === weekNumber);
      expect(weekWorkouts.length).toBeGreaterThan(0);
      for (const w of weekWorkouts) {
        expect(w.prescription.weekInCycle).toBe(expectedWeekInCycle);
      }
    }
  });
});

describe("partial final cycle", () => {
  test("tapers via the running plan's deload override instead of forcing a full block", () => {
    // A 15-week plan: weeks 13-15 are weekInCycle 1-3 ("Build" by raw
    // position) but land in the running plan's taper — should present as
    // deload, not a freshly-started hypertrophy block.
    const weeks: WeekContext[] = [];
    for (let weekNumber = 1; weekNumber <= 15; weekNumber++) {
      weeks.push(makeWeek({ weekNumber, isDownDeloadWeek: weekNumber >= 13 }));
    }

    const workouts = scheduleStrengthSessions(gluteGladiator, weeks);

    const tailWeeks = workouts.filter((w) => w.weekNumber >= 13);
    expect(tailWeeks.length).toBeGreaterThan(0);
    for (const w of tailWeeks) {
      expect(w.prescription.block).toBe("Deload");
      expect(w.prescription.isDeloadWeek).toBe(true);
    }

    // Week 1 is genuinely "Build" by raw cycle position (not a deload week
    // either by the program's own schedule or the taper override) — confirms
    // the override is specific to the taper weeks, not blanket-applied.
    const week1 = workouts.filter((w) => w.weekNumber === 1);
    for (const w of week1) {
      expect(w.prescription.isDeloadWeek).toBe(false);
    }
  });
});

describe("custom mode: the same scheduler fed a synthetic program", () => {
  test("places all N sessions, respecting interference", () => {
    const program = buildCustomProgram(2);
    const workouts = scheduleStrengthSessions(program, [makeWeek({ weekNumber: 1 })]);

    expect(workouts).toHaveLength(2);
    for (const w of workouts) {
      expect(["THURSDAY", "SATURDAY"]).not.toContain(w.day);
    }
  });

  test("does not enforce spacing between custom sessions, unlike Glute Gladiator's lower sessions", () => {
    // Same default week as the very first test in this file — Glute
    // Gladiator's Lower A/B always land at least 2 days apart there.
    // Custom sessions have no shared spacingGroup, so the scheduler is free
    // to place them on adjacent days once they're both interference-clear.
    const program = buildCustomProgram(2);
    const workouts = scheduleStrengthSessions(program, [makeWeek({ weekNumber: 1 })]);

    const days = workouts.map((w) => w.day).sort();
    expect(days).toEqual(["MONDAY", "TUESDAY"]);
  });

  test("peak-mileage weeks do not reduce the custom session count", () => {
    const program = buildCustomProgram(3);
    const workouts = scheduleStrengthSessions(program, [
      makeWeek({ weekNumber: 1, isPeakMileageWeek: true }),
    ]);

    expect(workouts).toHaveLength(3);
  });

  test("sessions carry no prescribed exercises", () => {
    const program = buildCustomProgram(1);
    const workouts = scheduleStrengthSessions(program, [makeWeek({ weekNumber: 1 })]);

    expect(workouts[0]?.prescription.exercises).toEqual([]);
    expect(workouts[0]?.prescription.displayName).toBe("Lift session");
  });
});

describe("peak-mileage intensity cap", () => {
  test("caps a raw Peak block down to Strengthen during a peak-mileage week", () => {
    // weekNumber 9 -> weekInCycle 9, which is Glute Gladiator's own "Peak" block by raw position.
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 9, isPeakMileageWeek: true }),
    ]);

    for (const w of workouts) {
      expect(w.prescription.block).toBe("Strengthen");
    }
  });

  test("caps a raw Test/Deload block down to Strengthen during a peak-mileage week", () => {
    // weekNumber 12 -> weekInCycle 12, Glute Gladiator's "Test/Deload" — the
    // near-max-effort week found colliding with running's peak mileage.
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 12, isPeakMileageWeek: true }),
    ]);

    for (const w of workouts) {
      expect(w.prescription.block).toBe("Strengthen");
    }
  });

  test("leaves a raw Peak block unchanged when the week isn't a peak-mileage week", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 9, isPeakMileageWeek: false }),
    ]);

    for (const w of workouts) {
      expect(w.prescription.block).toBe("Peak");
    }
  });

  test("leaves a block already at or below the cap's intensity unchanged during a peak-mileage week", () => {
    // weekNumber 1 -> "Build" (intensityRank 1), below Strengthen's cap (2) — nothing to gain by overriding it.
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 1, isPeakMileageWeek: true }),
    ]);

    for (const w of workouts) {
      expect(w.prescription.block).toBe("Build");
    }
  });

  test("taper's full deload override still wins over the peak-mileage cap", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [
      makeWeek({ weekNumber: 9, isPeakMileageWeek: true, isDownDeloadWeek: true }),
    ]);

    for (const w of workouts) {
      expect(w.prescription.block).toBe("Deload");
      expect(w.prescription.isDeloadWeek).toBe(true);
    }
  });
});

describe("injury-aware exercise substitution", () => {
  test("a Knee flag swaps Back Squat for Leg Press and drops Bulgarian Split Squat and Walking Lunge", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [makeWeek({ weekNumber: 1 })], ["Knee"]);

    const lowerA = workouts.find((w) => w.prescription.sessionName === "LOWER_A");
    const lowerB = workouts.find((w) => w.prescription.sessionName === "LOWER_B");

    expect(lowerA?.prescription.exercises.some((e) => e.name === "Dumbbell Bulgarian Split Squat")).toBe(
      false,
    );
    expect(lowerB?.prescription.exercises.some((e) => e.name === "Barbell Back Squat")).toBe(false);
    const legPress = lowerB?.prescription.exercises.find((e) => e.name === "Leg Press");
    expect(legPress).toBeDefined();
    expect(legPress?.isMainLift).toBe(true);
    expect(lowerB?.prescription.exercises.some((e) => e.name === "Dumbbell Walking Lunge")).toBe(false);
  });

  test("no injury flags leaves every exercise unchanged", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [makeWeek({ weekNumber: 1 })]);
    const lowerB = workouts.find((w) => w.prescription.sessionName === "LOWER_B");

    expect(lowerB?.prescription.exercises.some((e) => e.name === "Barbell Back Squat")).toBe(true);
  });

  test("a flag with no documented substitution leaves exercises unchanged", () => {
    const workouts = scheduleStrengthSessions(gluteGladiator, [makeWeek({ weekNumber: 1 })], ["IT band"]);
    const lowerA = workouts.find((w) => w.prescription.sessionName === "LOWER_A");
    const lowerB = workouts.find((w) => w.prescription.sessionName === "LOWER_B");

    expect(lowerA?.prescription.exercises.some((e) => e.name === "Dumbbell Bulgarian Split Squat")).toBe(
      true,
    );
    expect(lowerB?.prescription.exercises.some((e) => e.name === "Barbell Back Squat")).toBe(true);
  });
});

describe("checkDayEconomy", () => {
  test("returns null when the schedule has room for everything the program needs", () => {
    const week = makeWeek({ weekNumber: 1 });
    const workouts = scheduleStrengthSessions(gluteGladiator, [week]);

    expect(checkDayEconomy(gluteGladiator, [week], workouts).warning).toBeNull();
  });

  test("flags an understaffed week for a program with no spacing rule to also violate", () => {
    const program = buildCustomProgram(3);
    const week = makeWeek({ weekNumber: 1, availableDays: ["MONDAY"] });
    const workouts = scheduleStrengthSessions(program, [week]);

    const { warning } = checkDayEconomy(program, [week], workouts);
    expect(warning).not.toBeNull();
    expect(warning).toContain("fewer sessions than planned");
    expect(warning).not.toContain("back-to-back");
  });

  test("flags understaffing and unsafe spacing together — the exact scenario found in review", () => {
    // Only 2 available days, both claimed by Lower A/Lower B (adjacent, no
    // rest between them) — Upper A/Upper B get dropped entirely. This is
    // the app's own default persona shape (4 running days + 1 bike day).
    const week = makeWeek({
      weekNumber: 1,
      availableDays: ["FRIDAY", "SATURDAY"],
      interferenceDays: ["SUNDAY"],
    });
    const workouts = scheduleStrengthSessions(gluteGladiator, [week]);

    const { warning } = checkDayEconomy(gluteGladiator, [week], workouts);
    expect(warning).not.toBeNull();
    expect(warning).toContain("1 of 1 weeks");
    expect(warning).toContain("Lower A");
    expect(warning).toContain("Lower B");
    expect(warning).toContain(gluteGladiator.name);
  });
});
