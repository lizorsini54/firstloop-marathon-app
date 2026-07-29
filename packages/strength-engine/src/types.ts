// Mirrors plan-engine's DayOfWeek by value rather than importing it, for the
// same reason plan-engine mirrors Prisma's enum: this package stays zero
// dependencies and fully standalone — a future different program (or a
// future different sport entirely) is a data change, not a rewrite.
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

// A plain string, not a literal union — a genuinely generic scheduler
// shouldn't hardcode one program's session names in its type. Program data
// (e.g. programs/glute-gladiator.ts) is where specific names like "LOWER_A"
// actually live.
export type SessionName = string;

export interface ExerciseTemplate {
  name: string;
  sets: number;
  /** Fixed rep range, e.g. "8-10/leg". Omitted when usesBlockReps is true. */
  reps?: string;
  /** True for lifts whose reps float with the current block (e.g. the session's main lift). */
  usesBlockReps?: boolean;
  /** The one lift this session's notes explicitly call the primary progression lift. */
  isMainLift?: boolean;
  notes?: string;
}

export interface SessionTemplate {
  name: SessionName;
  displayName: string;
  /** Should this session avoid being placed the day before a quality/long run? */
  respectsInterference: boolean;
  /**
   * Sessions sharing a spacingGroup need minDaysBetweenGroupedSessions apart
   * from each other. No group (undefined) means no spacing constraint —
   * this is what lets a program like "custom" respect interference without
   * guessing at a spacing rule it has no basis for.
   */
  spacingGroup?: string;
  exercises: ExerciseTemplate[];
}

export interface BlockDefinition {
  name: string;
  /** 1-indexed week numbers within the program's cycle this block covers. */
  weeksInCycle: number[];
  isDeload: boolean;
  mainLiftReps: string;
  accessoryReps: string;
  intent: string;
}

export interface StrengthProgram {
  name: string;
  cycleLengthWeeks: number;
  sessions: SessionTemplate[];
  blocks: BlockDefinition[];
  fullSessionCount: number;
  reducedSessionCount: number;
  /** First entry is dropped first when trimming below fullSessionCount. */
  sessionDropOrder: SessionName[];
  /** Day-granular minimum gap required between two sessions sharing a spacingGroup. */
  minDaysBetweenGroupedSessions: number;
}

export interface WeekContext {
  weekNumber: number;
  /** Days not already claimed by a running or cross-training workout this week. */
  availableDays: DayOfWeek[];
  /** Days a respectsInterference session can't be placed the day immediately before. */
  interferenceDays: DayOfWeek[];
  isPeakMileageWeek: boolean;
  isDownDeloadWeek: boolean;
}

export interface ResolvedExercise {
  name: string;
  setsReps: string;
  isMainLift?: boolean;
  notes?: string;
}

export interface StrengthPrescription {
  sessionName: SessionName;
  displayName: string;
  block: string;
  weekInCycle: number;
  isDeloadWeek: boolean;
  exercises: ResolvedExercise[];
}

export interface GeneratedStrengthWorkout {
  weekNumber: number;
  day: DayOfWeek;
  prescription: StrengthPrescription;
}
