import type { StrengthProgram } from "../types";

/**
 * Transcribed directly from docs/strength-program.md ("Glute Gladiator:
 * Revamped"). Treat that document as the source of truth — if this ever
 * drifts from it, the doc wins.
 *
 * Two exercises (Barbell Hip Thrust, Barbell RDL) are both marked "(block
 * reps)" in the source, but only Hip Thrust's notes call it the "primary
 * progression lift." Both are modeled with usesBlockReps: true (their reps
 * float with the block's mainLiftReps); isMainLift is reserved for the one
 * lift each session explicitly calls primary.
 */
export const gluteGladiator: StrengthProgram = {
  name: "Glute Gladiator: Revamped",
  cycleLengthWeeks: 12,
  fullSessionCount: 4,
  reducedSessionCount: 3,
  // Lower B is explicitly "the first thing to cut" per the doc's running
  // interference rules. The doc only specifies one cut level (4 -> 3); the
  // rest of this order is a reasonable fallback for a deeper cut the doc
  // doesn't cover, not a documented rule.
  sessionDropOrder: ["LOWER_B", "UPPER_A", "LOWER_A", "UPPER_B"],
  // "48+ hours between Lower A and Lower B" -> at least 2 calendar days apart.
  minDaysBetweenGroupedSessions: 2,

  sessions: [
    {
      name: "LOWER_A",
      displayName: "Lower A: Glute + Hinge Strength",
      respectsInterference: true,
      spacingGroup: "LOWER",
      exercises: [
        {
          name: "Barbell Hip Thrust",
          sets: 4,
          usesBlockReps: true,
          isMainLift: true,
          notes: "Primary progression lift. This is where you chase numbers. 2-3 min rest.",
        },
        {
          name: "Barbell RDL",
          sets: 3,
          usesBlockReps: true,
          notes:
            "Your 95 lb working weight has room. Aim to close the gap toward your sumo numbers over the cycle.",
        },
        {
          name: "Dumbbell Bulgarian Split Squat",
          sets: 3,
          reps: "8-10/leg",
          notes: "Glute-biased: longer stride, slight forward lean.",
          // No documented alternative in the swap table for this movement's
          // knee flexion under load — dropped rather than a guessed swap.
          dropForFlags: ["Knee"],
        },
        {
          name: "45° Back Extension (weighted)",
          sets: 3,
          reps: "10-15",
          notes: "Round upper back slightly, squeeze glutes at top.",
        },
        {
          name: "Standing Calf Raise",
          sets: 3,
          reps: "12-15",
          notes: "Shin prehab. Full stretch at bottom, 2 sec pause.",
        },
        { name: "Hanging Leg Raise", sets: 3, reps: "10-15", notes: "Core." },
      ],
    },
    {
      name: "UPPER_A",
      displayName: "Upper A: Push Emphasis",
      respectsInterference: false,
      exercises: [
        {
          name: "Barbell Bench Press",
          sets: 4,
          usesBlockReps: true,
          isMainLift: true,
          notes: "Primary progression lift.",
        },
        { name: "Seated Dumbbell Overhead Press", sets: 3, reps: "8-12" },
        { name: "Incline Dumbbell Press", sets: 3, reps: "8-12" },
        {
          name: "Chest-Supported Row",
          sets: 3,
          reps: "10-12",
          notes: "Keeps pulling volume balanced on push day.",
        },
        {
          name: "Dumbbell Lateral Raise",
          sets: 4,
          reps: "12-15",
          notes: "Delt caps do more for physique than most arm work.",
        },
        {
          name: "Cable or Pec Deck Fly",
          sets: 3,
          reps: "12-15",
          notes: "Chest isolation with a full stretch.",
        },
        {
          name: "Cable Triceps Pushdown",
          sets: 3,
          reps: "10-15",
          notes: "Superset with Overhead Cable Triceps Extension.",
        },
        {
          name: "Overhead Cable Triceps Extension",
          sets: 3,
          reps: "10-12",
          notes: "Long head emphasis. This pairing is most of your visible arm size.",
        },
        {
          name: "Incline Dumbbell Curl",
          sets: 3,
          reps: "10-12",
          notes: "Biceps at a stretch. Gives arms a second weekly touch.",
        },
      ],
    },
    {
      name: "LOWER_B",
      displayName: "Lower B: Squat + Glute Volume",
      respectsInterference: true,
      spacingGroup: "LOWER",
      exercises: [
        {
          name: "Barbell Back Squat",
          sets: 4,
          usesBlockReps: true,
          isMainLift: true,
          notes: "Primary progression lift. Fills the quad gap from your current split.",
          // The swap table's "Back Squat -> Front Squat, Hack Squat, or Leg
          // Press" — of those three, Leg Press is the one actually
          // defensible for a knee flag (fixed path, less stabilization
          // demand); Front/Hack Squat aren't meaningfully easier on the knee.
          substituteForFlag: {
            flag: "Knee",
            replacementName: "Leg Press",
            replacementNotes:
              "Swapped for Back Squat — documented equipment alternative in the program's swap table, also generally less knee shear. Still the day's main lift.",
          },
        },
        {
          name: "Barbell Sumo Deadlift",
          sets: 3,
          reps: "6-8",
          notes: "Kept from your current program — you're strong here. Moderate loads, crisp reps.",
        },
        {
          name: "Dumbbell Walking Lunge",
          sets: 3,
          reps: "10/leg",
          // Same as Bulgarian Split Squat — no documented alternative, so
          // dropped rather than a guessed swap.
          dropForFlags: ["Knee"],
        },
        {
          name: "Lying or Seated Leg Curl",
          sets: 3,
          reps: "10-12",
          notes: "Direct hamstring work runners need.",
        },
        {
          name: "Machine or Cable Hip Abduction",
          sets: 3,
          reps: "15-20",
          notes: "Glute med: physique + run injury insurance.",
        },
        {
          name: "Tibialis Raise",
          sets: 3,
          reps: "15-20",
          notes: "Shin prehab. Toes up against wall or with plate.",
        },
      ],
    },
    {
      name: "UPPER_B",
      displayName: "Upper B: Pull Emphasis",
      respectsInterference: false,
      exercises: [
        {
          name: "Pull-Up Protocol",
          sets: 0,
          reps: "Per current phase",
          notes:
            "This day's heavy pull-up work: max-effort sets or negatives per current phase — see docs/strength-program.md's Pull-Up Project section for the phase table. Progression is tracked manually for now; adaptive phase detection is documented future work, not built here.",
        },
        {
          name: "Lat Pulldown",
          sets: 3,
          reps: "8-10",
          notes: "Heavy. Builds the lat strength that feeds pull-ups.",
        },
        { name: "Barbell Row", sets: 3, reps: "8-10" },
        { name: "Single-Arm Dumbbell Row", sets: 3, reps: "10-12/side" },
        {
          name: "Face Pull",
          sets: 3,
          reps: "15",
          notes: "Rear delts + shoulder health for all that time on the bike.",
        },
        { name: "EZ Bar or Dumbbell Curl", sets: 3, reps: "10-12", notes: "Superset with Hammer Curl." },
        {
          name: "Hammer Curl",
          sets: 3,
          reps: "12-15",
          notes: "Brachialis: adds arm thickness and helps grip for pull-ups.",
        },
        {
          name: "Cable Rope Curl or Preacher Curl",
          sets: 2,
          reps: "12-15",
          notes: "Finisher, chase the pump.",
        },
        {
          name: "Skull Crusher or Overhead DB Extension",
          sets: 3,
          reps: "10-12",
          notes: "Triceps get a second weekly touch to match biceps.",
        },
        {
          name: "Dumbbell Lateral Raise",
          sets: 3,
          reps: "15-20",
          notes: "Light, strict. Delts respond well to 2x/week.",
        },
        { name: "Ab Wheel Rollout or Cable Crunch", sets: 3, reps: "10-12", notes: "Core." },
      ],
    },
  ],

  blocks: [
    {
      name: "Build",
      weeksInCycle: [1, 2, 3],
      isDeload: false,
      mainLiftReps: "8-10",
      accessoryReps: "10-15",
      intent: "Hypertrophy, movement quality, base volume",
      intensityRank: 1,
      isPeakMileageCap: false,
    },
    {
      name: "Deload",
      weeksInCycle: [4],
      isDeload: true,
      mainLiftReps: "8 (light)",
      accessoryReps: "12 (light)",
      intent: "60-70% of week 3 loads, drop 1 set everywhere",
      intensityRank: 0,
      isPeakMileageCap: false,
    },
    {
      name: "Strengthen",
      weeksInCycle: [5, 6, 7],
      isDeload: false,
      mainLiftReps: "6-8",
      accessoryReps: "8-12",
      intent: "Heavier loading, same movements",
      intensityRank: 2,
      // The block a peak-mileage running week caps down to when the raw
      // cycle position would otherwise land on something heavier (Peak,
      // Test/Deload) — see schedule.ts's peakMileageCapBlock.
      isPeakMileageCap: true,
    },
    {
      name: "Deload",
      weeksInCycle: [8],
      isDeload: true,
      mainLiftReps: "6 (light)",
      accessoryReps: "10 (light)",
      intent: "Same deload rules",
      intensityRank: 0,
      isPeakMileageCap: false,
    },
    {
      name: "Peak",
      weeksInCycle: [9, 10, 11],
      isDeload: false,
      mainLiftReps: "4-6",
      accessoryReps: "8-10",
      intent: "Heaviest work of the cycle",
      intensityRank: 3,
      isPeakMileageCap: false,
    },
    {
      name: "Test/Deload",
      weeksInCycle: [12],
      isDeload: true,
      mainLiftReps: "Work to a heavy top set on hip thrust, squat, RDL, bench, row",
      accessoryReps: "—",
      intent: "Set new rep maxes, then rest",
      // isDeload (volume drops) but this is the single heaviest-effort week
      // in the cycle by actual load — near-max top sets, not a light week.
      // Ranked above Peak deliberately; isDeload and intensityRank are
      // separate axes for exactly this reason.
      intensityRank: 4,
      isPeakMileageCap: false,
    },
  ],
};
