import { placeSlots } from "@firstloop/scheduling";
import type {
  BlockDefinition,
  GeneratedStrengthWorkout,
  ResolvedExercise,
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
    const placements = placeSlots(
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
