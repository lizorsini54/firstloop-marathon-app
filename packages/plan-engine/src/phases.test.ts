import { describe, expect, test } from "bun:test";
import { computePhaseBoundaries, phaseForWeek } from "./phases";

const PLAN_LENGTHS = [4, 8, 12, 16, 18, 20, 24, 26, 30, 32, 36, 39, 40, 44, 48, 52];

describe("computePhaseBoundaries", () => {
  test("buckets sum exactly to totalWeeks across a range of plan lengths", () => {
    for (const totalWeeks of PLAN_LENGTHS) {
      const b = computePhaseBoundaries(totalWeeks);
      expect(b.base + b.build + b.peak + b.taper).toBe(totalWeeks);
    }
  });

  test("taper is always at least 1 week, even for short plans", () => {
    for (const totalWeeks of PLAN_LENGTHS) {
      const b = computePhaseBoundaries(totalWeeks);
      expect(b.taper).toBeGreaterThanOrEqual(1);
    }
  });

  test("no bucket is negative", () => {
    for (const totalWeeks of PLAN_LENGTHS) {
      const b = computePhaseBoundaries(totalWeeks);
      expect(b.base).toBeGreaterThanOrEqual(0);
      expect(b.build).toBeGreaterThanOrEqual(0);
      expect(b.peak).toBeGreaterThanOrEqual(0);
      expect(b.taper).toBeGreaterThanOrEqual(0);
    }
  });

  test("roughly matches the brief's 40/35/15/10 split for a typical marathon plan", () => {
    const b = computePhaseBoundaries(40);
    expect(b.base).toBe(16);
    expect(b.build).toBe(14);
    expect(b.peak).toBe(6);
    expect(b.taper).toBe(4);
  });
});

describe("phaseForWeek", () => {
  test("assigns the correct phase at every bucket boundary", () => {
    const b = computePhaseBoundaries(39); // base 16 / build 14 / peak 6 / taper 3
    expect(b).toEqual({ base: 16, build: 14, peak: 6, taper: 3 });

    expect(phaseForWeek(1, b)).toBe("base");
    expect(phaseForWeek(16, b)).toBe("base"); // last base week
    expect(phaseForWeek(17, b)).toBe("build"); // first build week
    expect(phaseForWeek(30, b)).toBe("build"); // last build week
    expect(phaseForWeek(31, b)).toBe("peak"); // first peak week
    expect(phaseForWeek(36, b)).toBe("peak"); // last peak week
    expect(phaseForWeek(37, b)).toBe("taper"); // first taper week
    expect(phaseForWeek(39, b)).toBe("taper"); // race week
  });

  test("every week in a plan is assigned to exactly one phase", () => {
    for (const totalWeeks of PLAN_LENGTHS) {
      const b = computePhaseBoundaries(totalWeeks);
      for (let week = 1; week <= totalWeeks; week++) {
        expect(["base", "build", "peak", "taper"]).toContain(phaseForWeek(week, b));
      }
    }
  });
});
