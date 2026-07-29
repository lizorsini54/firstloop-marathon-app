import { describe, expect, test } from "bun:test";
import { buildCustomProgram } from "./programs/custom";
import { gluteGladiator } from "./programs/glute-gladiator";
import { scheduleStrengthSessions } from "./schedule";
import type { DayOfWeek, SessionName, WeekContext } from "./types";

function makeWeek(overrides: Partial<WeekContext> & { weekNumber: number }): WeekContext {
  return {
    availableDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"],
    interferenceDays: ["FRIDAY", "SUNDAY"],
    isPeakMileageWeek: false,
    isDownDeloadWeek: false,
    ...overrides,
  };
}

function dayOf(
  workouts: ReturnType<typeof scheduleStrengthSessions>,
  sessionName: string,
): DayOfWeek | undefined {
  return workouts.find((w) => w.prescription.sessionName === sessionName)?.day;
}

describe("day placement: spacing + interference", () => {
  test("keeps lower sessions apart and off days before a quality/long run", () => {
    // Available Mon/Tue/Wed/Thu/Sat; Fri (quality run) + Sun (long run) taken.
    // Thu (day before Fri) and Sat (day before Sun) must never host a lower session.
    const workouts = scheduleStrengthSessions(gluteGladiator, [makeWeek({ weekNumber: 1 })]);

    expect(workouts).toHaveLength(4);
    const lowerA = dayOf(workouts, "LOWER_A");
    const lowerB = dayOf(workouts, "LOWER_B");

    expect(lowerA).toBeDefined();
    expect(lowerB).toBeDefined();
    expect(["THURSDAY", "SATURDAY"]).not.toContain(lowerA);
    expect(["THURSDAY", "SATURDAY"]).not.toContain(lowerB);

    const order: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const gap = Math.abs(order.indexOf(lowerA as DayOfWeek) - order.indexOf(lowerB as DayOfWeek));
    expect(gap).toBeGreaterThanOrEqual(gluteGladiator.minDaysBetweenGroupedSessions);
  });

  test("still places a lower session when every available day is interference-blocked", () => {
    // A real case found via seeded data: a peak-phase week with quality runs
    // on Wed/Fri and the long run on Sun leaves only Tue/Thu/Sat open — and
    // every one of those sits immediately before a run day. Dropping Lower A
    // here would silently skip it for the entire peak phase; the scheduler
    // should degrade the interference rule rather than do that.
    const week = makeWeek({
      weekNumber: 1,
      availableDays: ["TUESDAY", "THURSDAY", "SATURDAY"],
      interferenceDays: ["WEDNESDAY", "FRIDAY", "SUNDAY"],
      isPeakMileageWeek: true,
    });
    const workouts = scheduleStrengthSessions(gluteGladiator, [week]);

    expect(workouts).toHaveLength(gluteGladiator.reducedSessionCount);
    const names = workouts.map((w) => w.prescription.sessionName);
    expect(names).toContain("LOWER_A");
  });
});

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
