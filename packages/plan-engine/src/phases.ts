export type Phase = "base" | "build" | "peak" | "taper";

export interface PhaseBoundaries {
  base: number;
  build: number;
  peak: number;
  taper: number;
}

/**
 * Splits totalWeeks into base(40%)/build(35%)/peak(15%)/taper(10%), rounded
 * so the buckets sum exactly to totalWeeks. Taper is guaranteed at least 1
 * week (borrowed from base, the largest bucket) so short plans still taper.
 */
export function computePhaseBoundaries(totalWeeks: number): PhaseBoundaries {
  let base = Math.round(totalWeeks * 0.4);
  const build = Math.round(totalWeeks * 0.35);
  const peak = Math.round(totalWeeks * 0.15);
  let taper = totalWeeks - base - build - peak;

  if (taper < 1) {
    base -= 1 - taper;
    taper = 1;
  }

  return { base, build, peak, taper };
}

export function phaseForWeek(weekNumber: number, boundaries: PhaseBoundaries): Phase {
  if (weekNumber <= boundaries.base) return "base";
  if (weekNumber <= boundaries.base + boundaries.build) return "build";
  if (weekNumber <= boundaries.base + boundaries.build + boundaries.peak) return "peak";
  return "taper";
}
