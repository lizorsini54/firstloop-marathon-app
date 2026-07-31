import { z } from "zod";

/**
 * The AI Coach: one scoped Claude call that *comments on* how the last two
 * weeks of training went. It is deliberately not what makes the schedule safe
 * — plan-engine and strength-engine already do that at generation time (see
 * DECISIONS.md, Checkpoint 14). If this call fails or no API key is
 * configured, the app degrades to "coach unavailable" and nothing else breaks.
 *
 * Everything above `createAnthropicCompletion` is pure and network-free so the
 * snapshot math and prompt assembly are unit-testable without an API key.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
/** Two detail weeks plus two more for mileage-trend context. */
const TREND_WEEKS = 4;

export interface PlannedItem {
  id: string;
  date: Date;
  type: string;
  miles: number | null;
  /** plan-engine's run quality ("long" | "tempo" | "intervals" | "easy"), null for non-runs. */
  quality: string | null;
}

export interface LoggedItem {
  plannedWorkoutId: string | null;
  date: Date;
  type: string;
  miles: number | null;
  durationMin: number;
  rpe: number;
}

interface WeeklyTotals {
  /** 1 = the week just ended, 2 = the week before it, and so on. */
  weeksAgo: number;
  plannedMiles: number;
  actualMiles: number;
}

interface MissedSession {
  date: Date;
  type: string;
  description: string;
}

interface TrainingSnapshot {
  phase: string;
  currentWeek: number;
  totalWeeks: number;
  daysToRace: number;
  weeklyTotals: WeeklyTotals[];
  missedSessions: MissedSession[];
  runsPlanned: number;
  runsCompleted: number;
  strengthPlanned: number;
  strengthCompleted: number;
  longestRunMiles: number | null;
  averageRpe: number | null;
}

function describePlanned(item: PlannedItem): string {
  if (item.type === "RUN") {
    const quality = item.quality ?? "easy";
    return item.miles ? `${quality} run, ${item.miles}mi` : `${quality} run`;
  }
  if (item.type === "LIFT") return "strength session";
  return item.type.toLowerCase();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Reduces raw plan/log rows to the compact picture the model is asked to
 * comment on. Pure: `now` is injected rather than read from the clock so tests
 * can pin the window.
 */
export function buildTrainingSnapshot(args: {
  now: Date;
  raceDate: Date;
  phase: string;
  currentWeek: number;
  totalWeeks: number;
  planned: PlannedItem[];
  logged: LoggedItem[];
}): TrainingSnapshot {
  const { now, raceDate, phase, currentWeek, totalWeeks, planned, logged } = args;

  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

  const inWindow = <T extends { date: Date }>(rows: T[], from: Date) =>
    rows.filter((r) => r.date >= from && r.date <= now);

  const weeklyTotals: WeeklyTotals[] = [];
  for (let weeksAgo = TREND_WEEKS; weeksAgo >= 1; weeksAgo--) {
    const start = new Date(now.getTime() - weeksAgo * 7 * DAY_MS);
    const end = new Date(now.getTime() - (weeksAgo - 1) * 7 * DAY_MS);
    const within = <T extends { date: Date }>(r: T) => r.date >= start && r.date < end;
    weeklyTotals.push({
      weeksAgo,
      plannedMiles: round1(
        planned.filter(within).reduce((sum, p) => sum + (p.miles ?? 0), 0),
      ),
      actualMiles: round1(logged.filter(within).reduce((sum, l) => sum + (l.miles ?? 0), 0)),
    });
  }

  const plannedInWindow = inWindow(planned, windowStart);
  const loggedInWindow = inWindow(logged, windowStart);
  const loggedPlanIds = new Set(
    loggedInWindow.map((l) => l.plannedWorkoutId).filter((id): id is string => id !== null),
  );

  // Only sessions whose date has actually passed can be "missed" — today's
  // long run isn't a problem yet.
  const missedSessions: MissedSession[] = plannedInWindow
    .filter((p) => p.type !== "REST" && p.date < now && !loggedPlanIds.has(p.id))
    .map((p) => ({ date: p.date, type: p.type, description: describePlanned(p) }));

  const plannedRuns = plannedInWindow.filter((p) => p.type === "RUN");
  const plannedLifts = plannedInWindow.filter((p) => p.type === "LIFT");
  const loggedRuns = loggedInWindow.filter((l) => l.type === "RUN");
  const loggedLifts = loggedInWindow.filter((l) => l.type === "LIFT");

  const runMiles = loggedRuns.map((l) => l.miles ?? 0).filter((m) => m > 0);
  const rpes = loggedInWindow.map((l) => l.rpe);

  // Days, not weeks — a taper-week reader deserves the real number.
  const daysToRace = Math.max(0, Math.ceil((raceDate.getTime() - now.getTime()) / DAY_MS));

  return {
    phase,
    currentWeek,
    totalWeeks,
    daysToRace,
    weeklyTotals,
    missedSessions,
    runsPlanned: plannedRuns.length,
    runsCompleted: loggedRuns.length,
    strengthPlanned: plannedLifts.length,
    strengthCompleted: loggedLifts.length,
    longestRunMiles: runMiles.length > 0 ? Math.max(...runMiles) : null,
    averageRpe: rpes.length > 0 ? round1(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null,
  };
}

const COACH_SYSTEM_PROMPT = [
  "You are a running coach reviewing a runner's last two weeks of marathon training.",
  "Their training plan was already generated by a separate periodization engine that handles",
  "progression, taper, and injury adaptations. Do not redesign the plan, prescribe new workouts,",
  "or tell them to change the schedule — comment on how the recent block actually went.",
  "",
  "Write 2-4 sentences of plain, direct guidance addressed to the runner as 'you'. Be specific to",
  "the numbers you are given rather than generic. If exactly one thing genuinely warrants a flag",
  "(a missed long run, a mileage jump that looks aggressive, consistently high RPE, strength work",
  "being dropped), state it in one sentence as the concern. If nothing does, the concern is null —",
  "do not manufacture one. Never give medical or nutritional advice.",
].join("\n");

/** The user-turn payload: the snapshot rendered as compact, labelled text. */
export function renderSnapshot(snapshot: TrainingSnapshot): string {
  const lines: string[] = [
    `Phase: ${snapshot.phase} (week ${String(snapshot.currentWeek)} of ${String(snapshot.totalWeeks)})`,
    `Days until race: ${String(snapshot.daysToRace)}`,
    "",
    "Weekly running mileage (planned vs actual, most recent week last):",
  ];

  for (const week of snapshot.weeklyTotals) {
    const label = week.weeksAgo === 1 ? "past week" : `${String(week.weeksAgo)} weeks ago`;
    lines.push(
      `  ${label}: planned ${String(week.plannedMiles)}mi, actual ${String(week.actualMiles)}mi`,
    );
  }

  lines.push(
    "",
    `Last 14 days — runs: ${String(snapshot.runsCompleted)} of ${String(snapshot.runsPlanned)} planned completed`,
    `Last 14 days — strength: ${String(snapshot.strengthCompleted)} of ${String(snapshot.strengthPlanned)} planned completed`,
    `Longest run logged: ${snapshot.longestRunMiles === null ? "none" : `${String(snapshot.longestRunMiles)}mi`}`,
    `Average RPE across logged sessions: ${snapshot.averageRpe === null ? "none logged" : String(snapshot.averageRpe)}`,
  );

  if (snapshot.missedSessions.length === 0) {
    lines.push("", "Missed sessions in the last 14 days: none");
  } else {
    lines.push("", "Missed sessions in the last 14 days:");
    for (const missed of snapshot.missedSessions) {
      lines.push(`  ${missed.date.toISOString().slice(0, 10)}: ${missed.description}`);
    }
  }

  return lines.join("\n");
}

const coachResponseSchema = z.object({
  guidance: z.string().min(1),
  concern: z.string().min(1).nullable(),
});

type CoachResponse = z.infer<typeof coachResponseSchema>;

/** JSON Schema handed to the API as `output_config.format` — mirrors coachResponseSchema. */
const COACH_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    guidance: {
      type: "string",
      description: "2-4 sentences of guidance addressed to the runner.",
    },
    concern: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "One sentence naming a single genuine concern, or null if there isn't one.",
    },
  },
  required: ["guidance", "concern"],
  additionalProperties: false,
} as const;

/**
 * The seam the tests substitute: takes the assembled prompt, returns the raw
 * JSON text the model produced. Keeps the Anthropic SDK out of the test path
 * entirely, so CI needs no key and incurs no cost.
 */
export type CoachCompletion = (args: { system: string; user: string }) => Promise<string>;

export async function getCoachFeedback(
  snapshot: TrainingSnapshot,
  complete: CoachCompletion,
): Promise<CoachResponse> {
  const raw = await complete({
    system: COACH_SYSTEM_PROMPT,
    user: renderSnapshot(snapshot),
  });

  return coachResponseSchema.parse(JSON.parse(raw));
}

/**
 * Returns null when ANTHROPIC_API_KEY is unset, which is the normal state in
 * CI and in a fresh local checkout — callers surface "coach unavailable"
 * rather than failing the request.
 */
export function createAnthropicCompletion(apiKey: string | undefined): CoachCompletion | null {
  if (!apiKey) return null;

  return async ({ system, user }) => {
    // Imported lazily so the SDK is only loaded when a key is actually
    // configured — nothing about the rest of the API depends on it.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: COACH_OUTPUT_SCHEMA },
      },
      system,
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The coach declined to respond to this training summary.");
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      throw new Error("The coach returned no text content.");
    }
    return text.text;
  };
}
