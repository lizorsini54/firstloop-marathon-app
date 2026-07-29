import type { StrengthProgram } from "../types";

/**
 * A minimal synthetic program for "log your own lifting, N days a week" —
 * fed through the exact same scheduler as a named program like Glute
 * Gladiator, not a second scheduling path. No exercises, no block
 * progression, no peak-week cutback (same spirit as bikeDaysPerWeek, which
 * doesn't reduce during peak weeks either). The one rule enforced is
 * interference avoidance (respectsInterference: true); spacingGroup is
 * deliberately left unset on every session, since we don't know which of
 * a user's own sessions are lower-body-heavy enough to need the 48-hour
 * rule — guessing would be worse than not enforcing it.
 */
export function buildCustomProgram(sessionsPerWeek: number): StrengthProgram {
  const sessionNames = Array.from({ length: sessionsPerWeek }, (_, i) => `CUSTOM_${i + 1}`);

  return {
    name: "Custom",
    cycleLengthWeeks: 1,
    fullSessionCount: sessionsPerWeek,
    reducedSessionCount: sessionsPerWeek,
    sessionDropOrder: sessionNames,
    minDaysBetweenGroupedSessions: 0,
    sessions: sessionNames.map((name) => ({
      name,
      displayName: "Lift session",
      respectsInterference: true,
      exercises: [],
    })),
    blocks: [
      {
        name: "Custom",
        weeksInCycle: [1],
        isDeload: false,
        mainLiftReps: "",
        accessoryReps: "",
        intent: "",
      },
      {
        // Only reached when the running plan's taper overrides the raw
        // cycle position — see schedule.ts's genericDeloadBlock. Purely
        // cosmetic here (no exercises to vary), but keeps custom sessions
        // honest about easing off during taper too.
        name: "Custom (light)",
        weeksInCycle: [1],
        isDeload: true,
        mainLiftReps: "",
        accessoryReps: "",
        intent: "",
      },
    ],
  };
}
