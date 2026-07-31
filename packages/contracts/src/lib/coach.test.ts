import { describe, expect, test } from "bun:test";
import {
  buildTrainingSnapshot,
  createAnthropicCompletion,
  getCoachFeedback,
  renderSnapshot,
} from "./coach";
import type { CoachCompletion, LoggedItem, PlannedItem } from "./coach";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-30T12:00:00.000Z");
const RACE_DATE = new Date("2026-10-04T00:00:00.000Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS);
}

function planned(overrides: Partial<PlannedItem> & { id: string; date: Date }): PlannedItem {
  return { type: "RUN", miles: 5, quality: "easy", ...overrides };
}

function logged(overrides: Partial<LoggedItem> & { date: Date }): LoggedItem {
  return {
    plannedWorkoutId: null,
    type: "RUN",
    miles: 5,
    durationMin: 50,
    rpe: 5,
    ...overrides,
  };
}

function snapshotOf(args: { planned: PlannedItem[]; logged: LoggedItem[] }) {
  return buildTrainingSnapshot({
    now: NOW,
    raceDate: RACE_DATE,
    phase: "build",
    currentWeek: 6,
    totalWeeks: 16,
    planned: args.planned,
    logged: args.logged,
  });
}

describe("buildTrainingSnapshot", () => {
  test("counts a planned session with a matching log as completed, not missed", () => {
    const snapshot = snapshotOf({
      planned: [planned({ id: "w1", date: daysAgo(3) })],
      logged: [logged({ plannedWorkoutId: "w1", date: daysAgo(3) })],
    });

    expect(snapshot.missedSessions).toHaveLength(0);
    expect(snapshot.runsPlanned).toBe(1);
    expect(snapshot.runsCompleted).toBe(1);
  });

  test("flags a past planned session with no log as missed, described by quality", () => {
    const snapshot = snapshotOf({
      planned: [planned({ id: "w1", date: daysAgo(4), miles: 16, quality: "long" })],
      logged: [],
    });

    expect(snapshot.missedSessions).toHaveLength(1);
    expect(snapshot.missedSessions[0]?.description).toBe("long run, 16mi");
  });

  test("does not treat a session still in the future as missed", () => {
    const snapshot = snapshotOf({
      planned: [planned({ id: "w1", date: new Date(NOW.getTime() + 2 * DAY_MS) })],
      logged: [],
    });

    expect(snapshot.missedSessions).toHaveLength(0);
  });

  test("ignores REST placeholders when looking for missed sessions", () => {
    const snapshot = snapshotOf({
      planned: [planned({ id: "w1", date: daysAgo(2), type: "REST", miles: null, quality: null })],
      logged: [],
    });

    expect(snapshot.missedSessions).toHaveLength(0);
  });

  test("buckets mileage into four trailing weeks, oldest first", () => {
    const snapshot = snapshotOf({
      planned: [
        planned({ id: "a", date: daysAgo(24), miles: 20 }),
        planned({ id: "b", date: daysAgo(3), miles: 30 }),
      ],
      logged: [
        logged({ plannedWorkoutId: "a", date: daysAgo(24), miles: 18 }),
        logged({ plannedWorkoutId: "b", date: daysAgo(3), miles: 31 }),
      ],
    });

    expect(snapshot.weeklyTotals.map((w) => w.weeksAgo)).toEqual([4, 3, 2, 1]);
    expect(snapshot.weeklyTotals[0]).toMatchObject({ plannedMiles: 20, actualMiles: 18 });
    expect(snapshot.weeklyTotals[3]).toMatchObject({ plannedMiles: 30, actualMiles: 31 });
  });

  test("excludes sessions older than the 14-day detail window from the completion counts", () => {
    const snapshot = snapshotOf({
      planned: [planned({ id: "old", date: daysAgo(20) })],
      logged: [logged({ plannedWorkoutId: "old", date: daysAgo(20) })],
    });

    expect(snapshot.runsPlanned).toBe(0);
    expect(snapshot.runsCompleted).toBe(0);
    // Still counted in the four-week mileage trend.
    expect(snapshot.weeklyTotals[1]?.actualMiles).toBe(5);
  });

  test("tracks strength adherence separately from running", () => {
    const snapshot = snapshotOf({
      planned: [
        planned({ id: "l1", date: daysAgo(6), type: "LIFT", miles: null, quality: null }),
        planned({ id: "l2", date: daysAgo(3), type: "LIFT", miles: null, quality: null }),
      ],
      logged: [logged({ plannedWorkoutId: "l1", date: daysAgo(6), type: "LIFT", miles: null })],
    });

    expect(snapshot.strengthPlanned).toBe(2);
    expect(snapshot.strengthCompleted).toBe(1);
    expect(snapshot.missedSessions[0]?.description).toBe("strength session");
  });

  test("derives longest run, average RPE, and days to race", () => {
    const snapshot = snapshotOf({
      planned: [],
      logged: [
        logged({ date: daysAgo(5), miles: 8, rpe: 4 }),
        logged({ date: daysAgo(2), miles: 14, rpe: 8 }),
      ],
    });

    expect(snapshot.longestRunMiles).toBe(14);
    expect(snapshot.averageRpe).toBe(6);
    expect(snapshot.daysToRace).toBe(66);
  });

  test("reports nulls rather than NaN when nothing is logged", () => {
    const snapshot = snapshotOf({ planned: [], logged: [] });

    expect(snapshot.longestRunMiles).toBeNull();
    expect(snapshot.averageRpe).toBeNull();
    expect(snapshot.missedSessions).toHaveLength(0);
  });
});

describe("renderSnapshot", () => {
  test("includes the plan context, adherence counts, and each missed session", () => {
    const rendered = renderSnapshot(
      snapshotOf({
        planned: [planned({ id: "w1", date: daysAgo(4), miles: 16, quality: "long" })],
        logged: [],
      }),
    );

    expect(rendered).toContain("Phase: build (week 6 of 16)");
    expect(rendered).toContain("Days until race: 66");
    expect(rendered).toContain("runs: 0 of 1 planned completed");
    expect(rendered).toContain("2026-07-26: long run, 16mi");
  });

  test("says so explicitly when nothing was missed", () => {
    const rendered = renderSnapshot(snapshotOf({ planned: [], logged: [] }));

    expect(rendered).toContain("Missed sessions in the last 14 days: none");
    expect(rendered).toContain("Average RPE across logged sessions: none logged");
  });
});

describe("getCoachFeedback", () => {
  const snapshot = snapshotOf({ planned: [], logged: [] });

  test("passes the system prompt and rendered snapshot to the model", async () => {
    let received: { system: string; user: string } | null = null;
    const complete: CoachCompletion = (args) => {
      received = args;
      return Promise.resolve(JSON.stringify({ guidance: "Solid block.", concern: null }));
    };

    await getCoachFeedback(snapshot, complete);

    expect(received).not.toBeNull();
    expect(received!.system).toContain("Do not redesign the plan");
    expect(received!.user).toContain("Phase: build");
  });

  test("returns the parsed guidance and concern", async () => {
    const complete: CoachCompletion = () =>
      Promise.resolve(
        JSON.stringify({ guidance: "Two solid weeks.", concern: "You skipped the long run." }),
      );

    const feedback = await getCoachFeedback(snapshot, complete);

    expect(feedback.guidance).toBe("Two solid weeks.");
    expect(feedback.concern).toBe("You skipped the long run.");
  });

  test("accepts a null concern", async () => {
    const complete: CoachCompletion = () =>
      Promise.resolve(JSON.stringify({ guidance: "Nothing to flag.", concern: null }));

    expect((await getCoachFeedback(snapshot, complete)).concern).toBeNull();
  });

  test("rejects a response that does not match the expected shape", () => {
    const complete: CoachCompletion = () => Promise.resolve(JSON.stringify({ guidance: "" }));

    expect(getCoachFeedback(snapshot, complete)).rejects.toThrow();
  });

  test("rejects a response that is not JSON at all", () => {
    const complete: CoachCompletion = () => Promise.resolve("Sorry, I can't help with that.");

    expect(getCoachFeedback(snapshot, complete)).rejects.toThrow();
  });
});

describe("createAnthropicCompletion", () => {
  test("returns null when no API key is configured", () => {
    expect(createAnthropicCompletion(undefined)).toBeNull();
    expect(createAnthropicCompletion("")).toBeNull();
  });

  test("returns a completion function when a key is present", () => {
    expect(createAnthropicCompletion("sk-ant-test")).toBeInstanceOf(Function);
  });
});
