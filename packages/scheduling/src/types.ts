// The single source of truth for DayOfWeek/WEEK_DAY_ORDER — plan-engine and
// strength-engine both import and re-export these from here instead of each
// maintaining their own mirror, now that they share this package anyway.
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const WEEK_DAY_ORDER: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/**
 * One thing that needs a day within a week. Domain-agnostic on purpose —
 * a strength session and a training run are both just a Slot to this
 * package; whatever's strength- or running-specific about them lives one
 * layer up, in the caller.
 */
export interface Slot {
  name: string;
  /** Should this slot avoid being placed the day immediately before an interference day? */
  respectsInterference: boolean;
  /**
   * Slots sharing a spacingGroup need minDaysBetweenGroupedSessions apart
   * from each other. No group (undefined) means no spacing constraint —
   * this is what lets a caller ask for interference-avoidance without
   * guessing at a spacing rule it has no basis for.
   */
  spacingGroup?: string;
}
