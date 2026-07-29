import { WEEK_DAY_ORDER } from "./types";
import type {
  BlockDefinition,
  DayOfWeek,
  GeneratedStrengthWorkout,
  ResolvedExercise,
  SessionName,
  SessionTemplate,
  StrengthProgram,
  WeekContext,
} from "./types";

function blockForWeekInCycle(program: StrengthProgram, weekInCycle: number): BlockDefinition {
  const block = program.blocks.find((b) => b.weeksInCycle.includes(weekInCycle));
  if (!block) {
    throw new Error(`No block defined for week ${weekInCycle} of ${program.name}'s cycle`);
  }
  return block;
}

/**
 * The general "back off" deload variant (the program's mildest, standard
 * deload block — e.g. week 4 of Glute Gladiator's cycle, not the week-12
 * test week, which is a program-specific culmination event, not a generic
 * light week). Used when the running plan's own taper overrides whatever
 * block the raw cycle position would otherwise land on. Relies on blocks
 * being listed in the program data in the order they occur in the cycle,
 * so the first isDeload match is the mild one, not the test week.
 */
function genericDeloadBlock(program: StrengthProgram): BlockDefinition {
  const block = program.blocks.find((b) => b.isDeload);
  if (!block) {
    throw new Error(`${program.name} has no deload block defined`);
  }
  return block;
}

function resolveExercises(session: SessionTemplate, block: BlockDefinition): ResolvedExercise[] {
  return session.exercises.map((ex) => {
    const reps = ex.usesBlockReps ? block.mainLiftReps : (ex.reps ?? "");
    const setsReps = ex.sets > 0 ? `${ex.sets} x ${reps}` : reps;
    return { name: ex.name, setsReps, isMainLift: ex.isMainLift, notes: ex.notes };
  });
}

function sessionsForWeek(program: StrengthProgram, week: WeekContext): SessionTemplate[] {
  const count = week.isPeakMileageWeek ? program.reducedSessionCount : program.fullSessionCount;
  const cutCount = Math.max(0, program.sessions.length - count);
  const dropped = new Set(program.sessionDropOrder.slice(0, cutCount));
  return program.sessions.filter((s) => !dropped.has(s.name));
}

function isBlockedByInterference(day: DayOfWeek, interferenceDays: DayOfWeek[]): boolean {
  const dayIndex = WEEK_DAY_ORDER.indexOf(day);
  const nextDay = WEEK_DAY_ORDER[dayIndex + 1];
  return nextDay !== undefined && interferenceDays.includes(nextDay);
}

function placeSessions(
  sessions: SessionTemplate[],
  availableDays: DayOfWeek[],
  interferenceDays: DayOfWeek[],
  minDaysBetweenGroupedSessions: number,
): Map<SessionName, DayOfWeek> {
  const sortedDays = WEEK_DAY_ORDER.filter((d) => availableDays.includes(d));
  const constrainedSessions = sessions.filter((s) => s.respectsInterference);
  const freeSessions = sessions.filter((s) => !s.respectsInterference);

  const placements = new Map<SessionName, DayOfWeek>();
  const usedDays = new Set<DayOfWeek>();
  const eligibleForInterference = sortedDays.filter((d) => !isBlockedByInterference(d, interferenceDays));
  const groupDayIndices = new Map<string, number[]>();

  for (const session of constrainedSessions) {
    const group = session.spacingGroup;
    const groupIndices = group ? (groupDayIndices.get(group) ?? []) : [];

    const wellSpaced = eligibleForInterference.find((d) => {
      if (usedDays.has(d)) return false;
      const dIndex = WEEK_DAY_ORDER.indexOf(d);
      return groupIndices.every((i) => Math.abs(dIndex - i) >= minDaysBetweenGroupedSessions);
    });
    // Fall back to any unused eligible (interference-respecting) day if
    // ideal spacing can't be met, and as a last resort to any available day
    // at all if EVERY available day happens to sit right before a run —
    // that does happen (a tight run week can leave no day that isn't the
    // day before something). Dropping the session outright would silently
    // skip work for as long as that run pattern holds — the source
    // program's own peak-week rule keeps Lower A in the reduced set, so
    // this should degrade the interference rule before it drops a session
    // the doc explicitly says should still happen.
    const candidate =
      wellSpaced ??
      eligibleForInterference.find((d) => !usedDays.has(d)) ??
      sortedDays.find((d) => !usedDays.has(d));

    if (candidate) {
      placements.set(session.name, candidate);
      usedDays.add(candidate);
      if (group) {
        groupDayIndices.set(group, [...groupIndices, WEEK_DAY_ORDER.indexOf(candidate)]);
      }
    }
  }

  for (const session of freeSessions) {
    const candidate = sortedDays.find((d) => !usedDays.has(d));
    if (candidate) {
      placements.set(session.name, candidate);
      usedDays.add(candidate);
    }
  }

  return placements;
}

/**
 * Places a strength program's sessions around already-fixed running days,
 * generically — every program-specific number (spacing, drop order,
 * exercises, rep ranges) comes from `program`, not from constants here.
 */
export function scheduleStrengthSessions(
  program: StrengthProgram,
  weeks: WeekContext[],
): GeneratedStrengthWorkout[] {
  const workouts: GeneratedStrengthWorkout[] = [];

  for (const week of weeks) {
    const weekInCycle = ((week.weekNumber - 1) % program.cycleLengthWeeks) + 1;
    const rawBlock = blockForWeekInCycle(program, weekInCycle);
    // The running plan's own taper always overrides the program's raw cycle
    // position — this is what makes a partial final cycle taper down
    // naturally instead of forcing a complete block into a leftover handful
    // of weeks.
    const block = week.isDownDeloadWeek ? genericDeloadBlock(program) : rawBlock;

    const sessions = sessionsForWeek(program, week);
    const placements = placeSessions(
      sessions,
      week.availableDays,
      week.interferenceDays,
      program.minDaysBetweenGroupedSessions,
    );

    for (const session of sessions) {
      const day = placements.get(session.name);
      if (!day) continue;
      workouts.push({
        weekNumber: week.weekNumber,
        day,
        prescription: {
          sessionName: session.name,
          displayName: session.displayName,
          block: block.name,
          weekInCycle,
          isDeloadWeek: block.isDeload,
          exercises: resolveExercises(session, block),
        },
      });
    }
  }

  return workouts;
}
