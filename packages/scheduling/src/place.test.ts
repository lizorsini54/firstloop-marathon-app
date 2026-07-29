import { describe, expect, test } from "bun:test";
import { placeSlots } from "./place";
import { WEEK_DAY_ORDER } from "./types";
import type { DayOfWeek } from "./types";

describe("placeSlots: spacing + interference", () => {
  test("keeps grouped slots apart and off the day before an interference day", () => {
    // Moved from strength-engine's original schedule.test.ts, which
    // exercised this indirectly through Glute Gladiator's Lower A/Lower B —
    // this tests the generic mechanism directly instead.
    const slots = [
      { name: "A", respectsInterference: true, spacingGroup: "GROUP" },
      { name: "B", respectsInterference: true, spacingGroup: "GROUP" },
    ];
    const availableDays: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"];
    const interferenceDays: DayOfWeek[] = ["FRIDAY", "SUNDAY"];

    const placements = placeSlots(slots, availableDays, interferenceDays, 2);
    const dayA = placements.get("A");
    const dayB = placements.get("B");

    expect(dayA).toBeDefined();
    expect(dayB).toBeDefined();
    expect(["THURSDAY", "SATURDAY"]).not.toContain(dayA);
    expect(["THURSDAY", "SATURDAY"]).not.toContain(dayB);

    const gap = Math.abs(
      WEEK_DAY_ORDER.indexOf(dayA as DayOfWeek) - WEEK_DAY_ORDER.indexOf(dayB as DayOfWeek),
    );
    expect(gap).toBeGreaterThanOrEqual(2);
  });

  test("still places a slot when every available day is interference-blocked", () => {
    // A real case found in Checkpoint 9's seeded data: a week with quality
    // runs on Wed/Fri and a long run on Sun leaves only Tue/Thu/Sat open —
    // and every one of those sits immediately before a run day. Dropping
    // the slot outright would silently skip it for as long as that run
    // pattern holds; the placer should degrade the interference rule
    // rather than do that.
    const slots = [{ name: "A", respectsInterference: true, spacingGroup: "GROUP" }];
    const availableDays: DayOfWeek[] = ["TUESDAY", "THURSDAY", "SATURDAY"];
    const interferenceDays: DayOfWeek[] = ["WEDNESDAY", "FRIDAY", "SUNDAY"];

    const placements = placeSlots(slots, availableDays, interferenceDays, 2);
    expect(placements.get("A")).toBeDefined();
  });

  test("slots with no spacingGroup are not spaced from each other", () => {
    const slots = [
      { name: "A", respectsInterference: true },
      { name: "B", respectsInterference: true },
    ];
    const availableDays: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"];
    const interferenceDays: DayOfWeek[] = ["FRIDAY", "SUNDAY"];

    const placements = placeSlots(slots, availableDays, interferenceDays, 2);
    const days = [placements.get("A"), placements.get("B")].sort();
    expect(days).toEqual(["MONDAY", "TUESDAY"]);
  });

  test("interference-respecting slots are placed before free slots, which fill what's left", () => {
    const slots = [
      { name: "free1", respectsInterference: false },
      { name: "free2", respectsInterference: false },
      { name: "constrained", respectsInterference: true },
    ];
    const availableDays: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY"];
    const interferenceDays: DayOfWeek[] = [];

    const placements = placeSlots(slots, availableDays, interferenceDays, 0);
    expect(placements.size).toBe(3);
    expect(new Set(placements.values()).size).toBe(3); // all on distinct days
  });
});
