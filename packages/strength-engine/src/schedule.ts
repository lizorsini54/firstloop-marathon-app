import { placeSlots, WEEK_DAY_ORDER } from "@firstloop/scheduling";
import type { DayOfWeek } from "@firstloop/scheduling";
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

/**
 * The block a running peak-mileage week caps down to when the raw cycle
 * position would otherwise land on something heavier — see intensityRank
 * on BlockDefinition for why this is a separate concept from isDeload.
 */
function peakMileageCapBlock(program: StrengthProgram): BlockDefinition {
  const block = program.blocks.find((b) => b.isPeakMileageCap);
  if (!block) {
    throw new Error(`${program.name} has no peak-mileage intensity-cap block defined`);
  }
  return block;
}

function resolveExercises(
  session: SessionTemplate,
  block: BlockDefinition,
  injuryFlags: string[],
): ResolvedExercise[] {
  const normalizedFlags = injuryFlags.map((f) => f.toLowerCase());
  const applicable = session.exercises.filter(
    (ex) => !ex.dropForFlags?.some((f) => normalizedFlags.includes(f.toLowerCase())),
  );

  return applicable.map((ex) => {
    const substitution =
      ex.substituteForFlag && normalizedFlags.includes(ex.substituteForFlag.flag.toLowerCase())
        ? ex.substituteForFlag
        : undefined;
    const reps = ex.usesBlockReps ? block.mainLiftReps : (ex.reps ?? "");
    const setsReps = ex.sets > 0 ? `${ex.sets} x ${reps}` : reps;
    return {
      name: substitution?.replacementName ?? ex.name,
      setsReps,
      isMainLift: ex.isMainLift,
      notes: substitution?.replacementNotes ?? ex.notes,
    };
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
 * `injuryFlags` defaults to empty so existing callers/tests that don't care
 * about injuries don't need to change.
 */
export function scheduleStrengthSessions(
  program: StrengthProgram,
  weeks: WeekContext[],
  injuryFlags: string[] = [],
): GeneratedStrengthWorkout[] {
  const workouts: GeneratedStrengthWorkout[] = [];

  for (const week of weeks) {
    const weekInCycle = ((week.weekNumber - 1) % program.cycleLengthWeeks) + 1;
    const rawBlock = blockForWeekInCycle(program, weekInCycle);
    // The running plan's own taper always overrides the program's raw cycle
    // position — this is what makes a partial final cycle taper down
    // naturally instead of forcing a complete block into a leftover handful
    // of weeks. Peak-mileage weeks are the second, narrower override: only
    // when the raw block is heavier than the program's designated cap does
    // it get stepped down — a week that's already at or below cap intensity
    // passes through untouched.
    let block = week.isDownDeloadWeek ? genericDeloadBlock(program) : rawBlock;
    if (!week.isDownDeloadWeek && week.isPeakMileageWeek) {
      const cap = peakMileageCapBlock(program);
      if (block.intensityRank > cap.intensityRank) {
        block = cap;
      }
    }

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
          exercises: resolveExercises(session, block, injuryFlags),
        },
      });
    }
  }

  return workouts;
}

export interface DayEconomyCheck {
  /** Names the actual gap; null when the schedule has room for everything the program needs. */
  warning: string | null;
}

/**
 * Compares what a program actually needs (session count, spacing between
 * grouped sessions) against what the week's running/bike days left room
 * for, using the real scheduled output rather than re-deriving it — so this
 * catches the same silent degradation the placer's own fallback tiers can
 * produce, not just a theoretical shortfall. A coaching-judgment check in
 * the same spirit as plan-engine's checkFeasibility: never blocks plan
 * creation, only names the gap.
 */
export function checkDayEconomy(
  program: StrengthProgram,
  weeks: WeekContext[],
  workouts: GeneratedStrengthWorkout[],
): DayEconomyCheck {
  const sessionByName = new Map(program.sessions.map((s) => [s.name, s]));
  let understaffedWeeks = 0;
  let unsafeSpacingWeeks = 0;
  let spacingExample: { a: string; b: string } | undefined;

  for (const week of weeks) {
    const weekWorkouts = workouts.filter((w) => w.weekNumber === week.weekNumber);
    const intended = week.isPeakMileageWeek ? program.reducedSessionCount : program.fullSessionCount;
    if (weekWorkouts.length < intended) {
      understaffedWeeks++;
    }

    const byGroup = new Map<string, { day: DayOfWeek; sessionName: string }[]>();
    for (const w of weekWorkouts) {
      const group = sessionByName.get(w.prescription.sessionName)?.spacingGroup;
      if (!group) continue;
      const bucket = byGroup.get(group) ?? [];
      bucket.push({ day: w.day, sessionName: w.prescription.sessionName });
      byGroup.set(group, bucket);
    }

    let weekHasUnsafeSpacing = false;
    for (const members of byGroup.values()) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          if (!a || !b) continue;
          const gap = Math.abs(WEEK_DAY_ORDER.indexOf(a.day) - WEEK_DAY_ORDER.indexOf(b.day));
          if (gap < program.minDaysBetweenGroupedSessions) {
            weekHasUnsafeSpacing = true;
            spacingExample ??= {
              a: sessionByName.get(a.sessionName)?.displayName ?? a.sessionName,
              b: sessionByName.get(b.sessionName)?.displayName ?? b.sessionName,
            };
          }
        }
      }
    }
    if (weekHasUnsafeSpacing) {
      unsafeSpacingWeeks++;
    }
  }

  if (understaffedWeeks === 0 && unsafeSpacingWeeks === 0) {
    return { warning: null };
  }

  const totalWeeks = weeks.length;
  const sentences: string[] = [];
  if (understaffedWeeks > 0) {
    sentences.push(
      `Your running and bike days don't leave enough room for ${program.name}'s full schedule: ` +
        `${understaffedWeeks} of ${totalWeeks} weeks get fewer sessions than planned.`,
    );
  }
  if (unsafeSpacingWeeks > 0 && spacingExample) {
    sentences.push(
      `${spacingExample.a} and ${spacingExample.b} land on back-to-back days with no rest between them in ` +
        `${unsafeSpacingWeeks} of ${totalWeeks} weeks — there isn't enough room in your schedule for ${program.name}'s spacing rule.`,
    );
  }

  return { warning: sentences.join(" ") };
}
