import { logSessionInputSchema } from "@firstloop/contracts/schemas/session";
import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "../lib/orpc";

type WorkoutType = "RUN" | "LIFT" | "BIKE" | "REST";
type SubmitState = { status: "idle" | "submitting" } | { status: "error"; error: string };

type LinkedExercise = { name: string; setsReps: string; isMainLift?: boolean; notes?: string };
type LinkedPrescription = {
  displayName?: string;
  block?: string;
  exercises?: LinkedExercise[];
  /** Prescribed minutes for a run or bike session — prefilled into the form below. */
  durationMin?: number;
};
type LogSessionNavState = {
  plannedWorkoutId?: string;
  type?: WorkoutType;
  prescription?: LinkedPrescription;
  /**
   * Present when History sent us here to edit an existing entry. The same form
   * serves both jobs deliberately — it already handles every field including
   * the exercise rows, and a separate edit surface would mean rebuilding that.
   */
  editing?: {
    sessionLogId: string;
    date: string;
    distanceMiles: number | null;
    durationMin: number;
    rpe: number;
    notes: string | null;
    setLog: LinkedSetLogEntry[] | null;
  };
};

type LinkedSetLogEntry = { exercise: string; sets: { reps: number; weightLbs: number }[] };

type SetEntry = { reps: string; weightLbs: string };

/**
 * A row carries its own identity and its own prescription rather than being
 * matched to `linkedExercises` by array index. Both matter once rows can be
 * added and removed: the name is not unique (an added exercise starts blank,
 * and two can collide), and any index-based lookup shifts onto the wrong
 * template the moment a row above it is removed.
 *
 * `setsReps`/`notes` are absent on a user-added exercise — there is no
 * prescription to show, which is the whole point of this checkpoint.
 */
type ExerciseLog = {
  id: string;
  exercise: string;
  sets: SetEntry[];
  prescribed: boolean;
  setsReps?: string;
  notes?: string;
};

let nextExerciseId = 0;
function makeExerciseId(): string {
  nextExerciseId += 1;
  return `ex-${String(nextExerciseId)}`;
}

const today = new Date().toISOString().slice(0, 10);

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: "RUN", label: "Run" },
  { value: "LIFT", label: "Lift" },
  { value: "BIKE", label: "Bike" },
  { value: "REST", label: "Rest" },
];

function parseSetCount(setsReps: string): number {
  const match = /^(\d+)\s*x/.exec(setsReps);
  const n = match ? Number(match[1]) : 0;
  return n > 0 ? n : 3;
}

function initialExerciseLogs(exercises: LinkedExercise[]): ExerciseLog[] {
  return exercises.map((ex) => ({
    id: makeExerciseId(),
    exercise: ex.name,
    sets: Array.from({ length: parseSetCount(ex.setsReps) }, () => ({ reps: "", weightLbs: "" })),
    prescribed: true,
    setsReps: ex.setsReps,
    notes: ex.notes,
  }));
}

function loggedExerciseRows(entries: LinkedSetLogEntry[]): ExerciseLog[] {
  return entries.map((e) => ({
    id: makeExerciseId(),
    exercise: e.exercise,
    sets: e.sets.map((set) => ({ reps: String(set.reps), weightLbs: String(set.weightLbs) })),
    prescribed: false,
  }));
}

function blankExerciseLog(): ExerciseLog {
  return {
    id: makeExerciseId(),
    exercise: "",
    sets: [{ reps: "", weightLbs: "" }],
    prescribed: false,
  };
}

export function LogSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as LogSessionNavState | null;
  const linkedExercises = navState?.prescription?.exercises;

  // Three separate questions that used to be answered by one flag. Conflating
  // them meant "show exercises for any lift" would also have hidden the Type
  // field on a freeform lift, where the user still has to choose it.
  //
  //  - arrivedFromPlan: the type is already known, so don't ask for it again
  //  - showsDistance:   meaningless for a lift or a rest day
  //  - isLift:          the only thing that should gate the exercise section
  const arrivedFromPlan = Boolean(navState?.plannedWorkoutId);
  const editing = navState?.editing;

  const [date, setDate] = useState(editing?.date ?? today);
  const [type, setType] = useState<WorkoutType>(navState?.type ?? "RUN");
  const [distanceMiles, setDistanceMiles] = useState(
    editing?.distanceMiles != null ? String(editing.distanceMiles) : "",
  );
  // Arriving from a dashboard row, the plan already told the runner how long
  // this session was meant to be — starting the field empty just asks them to
  // retype it. Still fully editable; it's what they planned, not what they did.
  const [durationMin, setDurationMin] = useState(
    editing
      ? String(editing.durationMin)
      : navState?.prescription?.durationMin
        ? String(navState.prescription.durationMin)
        : "",
  );
  const [rpe, setRpe] = useState(editing ? String(editing.rpe) : "5");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(() => {
    // An edited session's exercises are what was *done*, so they come back as
    // plain rows with no prescription attached — there is no setsReps or note
    // to show for something already recorded.
    if (editing?.setLog) return loggedExerciseRows(editing.setLog);
    return linkedExercises ? initialExerciseLogs(linkedExercises) : [];
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const isLift = type === "LIFT";
  const showsDistance = type === "RUN" || type === "BIKE";

  // The link is a claim that this session is the one the plan asked for, so it
  // only holds while the type still matches the row that was clicked. Switching
  // away detaches it: the session is logged on its own and the planned one
  // stays legitimately unlogged. The server enforces the same rule — this is
  // here so the runner is told, not so the rule is applied.
  const linkHolds = arrivedFromPlan && type === navState?.type;
  const linkLapsed = arrivedFromPlan && !linkHolds;

  // Leaving LIFT drops any exercise rows rather than keeping them alive
  // off-screen, so a run log can't carry a stray setLog it never showed.
  function changeType(next: WorkoutType) {
    setType(next);
    if (next !== "LIFT") setExerciseLogs([]);
  }

  function addExercise() {
    setExerciseLogs((prev) => [...prev, blankExerciseLog()]);
  }

  function removeExercise(id: string) {
    setExerciseLogs((prev) => prev.filter((ex) => ex.id !== id));
  }

  function renameExercise(id: string, value: string) {
    setExerciseLogs((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, exercise: value } : ex)),
    );
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: keyof SetEntry, value: string) {
    setExerciseLogs((prev) =>
      prev.map((ex, i) =>
        i !== exerciseIndex
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s)) },
      ),
    );
  }

  function addSet(exerciseIndex: number) {
    setExerciseLogs((prev) =>
      prev.map((ex, i) =>
        i !== exerciseIndex ? ex : { ...ex, sets: [...ex.sets, { reps: "", weightLbs: "" }] },
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Sets with no reps are dropped, then exercises left with no sets are
    // dropped — established behaviour, and the spec's chosen resolution for
    // "an exercise with no sets". A blank weight means 0, which is a real
    // bodyweight entry rather than an unfilled one. New here: an added
    // exercise that was never named is dropped too, so nothing persists as
    // `exercise: ""`.
    const setLog = isLift
      ? exerciseLogs
          .map((ex) => ({
            exercise: ex.exercise.trim(),
            sets: ex.sets
              .filter((s) => s.reps.trim() !== "")
              .map((s) => ({ reps: Number(s.reps), weightLbs: Number(s.weightLbs || "0") })),
          }))
          .filter((ex) => ex.exercise !== "" && ex.sets.length > 0)
      : undefined;

    const result = logSessionInputSchema.safeParse({
      date,
      type,
      distanceMiles: distanceMiles ? Number(distanceMiles) : undefined,
      durationMin: Number(durationMin),
      rpe: Number(rpe),
      notes: notes.trim() || undefined,
      plannedWorkoutId: linkHolds ? navState?.plannedWorkoutId : undefined,
      setLog: setLog && setLog.length > 0 ? setLog : undefined,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setState({ status: "submitting" });
    try {
      if (editing) {
        await orpc.updateSessionLog({ ...result.data, sessionLogId: editing.sessionLogId });
        void navigate("/history");
      } else {
        await orpc.logSession(result.data);
        void navigate("/dashboard");
      }
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong — try again.",
      });
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase tracking-tight">
            {editing
              ? "Edit session"
              : ((arrivedFromPlan ? navState?.prescription?.displayName : null) ?? "Log a session")}
          </CardTitle>
          <CardDescription>
            {editing
              ? "Fix anything that isn't right, then save."
              : isLift
                ? "Log your sets for this session."
                : "What did you actually do out there?"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date" className={labelClass}>
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={Boolean(fieldErrors.date)}
                className="font-mono"
              />
              {fieldErrors.date && <p className="text-sm text-destructive">{fieldErrors.date}</p>}
            </div>

            {/*
              Always shown, including when arriving from a dashboard row. An
              earlier cut of this checkpoint hid it on arrival — the type is
              known, after all — but that regressed the run flow, where the
              preselected type is the visible proof the prescription travelled
              with the click, and Checkpoint 17's e2e test asserts exactly that.
              Leaving it visible also lets a runner correct a mis-clicked row.
            */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type" className={labelClass}>
                Type
              </Label>
              <Select value={type} onValueChange={(v) => changeType(v as WorkoutType)}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {linkLapsed && (
              <p className="text-xs text-muted-foreground">
                This no longer matches{" "}
                {navState?.prescription?.displayName ?? "the session you opened"}, so it'll be
                logged on its own — that planned session will still show as not done.
              </p>
            )}

            {showsDistance && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="distanceMiles" className={labelClass}>
                  Distance (miles, optional)
                </Label>
                <Input
                  id="distanceMiles"
                  type="number"
                  min={0}
                  step="0.1"
                  value={distanceMiles}
                  onChange={(e) => setDistanceMiles(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.distanceMiles)}
                  className="font-mono"
                />
                {fieldErrors.distanceMiles && (
                  <p className="text-sm text-destructive">{fieldErrors.distanceMiles}</p>
                )}
              </div>
            )}

            {isLift && (
              <div className="flex flex-col gap-3">
                {exerciseLogs.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nothing prescribed for this session — add whatever you lifted.
                  </p>
                )}

                {exerciseLogs.map((ex, i) => (
                  <div
                    key={ex.id}
                    data-slot="exercise-card"
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      {ex.prescribed ? (
                        <p className="text-sm font-medium">{ex.exercise}</p>
                      ) : (
                        <Input
                          aria-label="Exercise name"
                          placeholder="Exercise name"
                          value={ex.exercise}
                          onChange={(e) => renameExercise(ex.id, e.target.value)}
                          className="h-8 text-sm"
                        />
                      )}
                      <div className="flex shrink-0 items-baseline gap-2">
                        {ex.setsReps && (
                          <p className="font-mono text-xs text-muted-foreground">{ex.setsReps}</p>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${ex.exercise || "exercise"}`}
                          onClick={() => removeExercise(ex.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {ex.notes && <p className="mt-1 text-xs text-muted-foreground">{ex.notes}</p>}
                    <div className="mt-2 flex flex-col gap-1.5">
                      {ex.sets.map((s, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className={`w-12 shrink-0 ${labelClass}`}>Set {j + 1}</span>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Reps"
                            value={s.reps}
                            onChange={(e) => updateSet(i, j, "reps", e.target.value)}
                            className="font-mono"
                          />
                          <Input
                            type="number"
                            min={0}
                            step="2.5"
                            placeholder="Lbs"
                            value={s.weightLbs}
                            onChange={(e) => updateSet(i, j, "weightLbs", e.target.value)}
                            className="font-mono"
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() => addSet(i)}
                      >
                        + Add set
                      </Button>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="self-start" onClick={addExercise}>
                  + Add exercise
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durationMin" className={labelClass}>
                Duration (minutes)
              </Label>
              <Input
                id="durationMin"
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                aria-invalid={Boolean(fieldErrors.durationMin)}
                className="font-mono"
              />
              {fieldErrors.durationMin && (
                <p className="text-sm text-destructive">{fieldErrors.durationMin}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rpe" className={labelClass}>
                RPE (1-10)
              </Label>
              <Input
                id="rpe"
                type="number"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                aria-invalid={Boolean(fieldErrors.rpe)}
                className="font-mono"
              />
              {fieldErrors.rpe && <p className="text-sm text-destructive">{fieldErrors.rpe}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes" className={labelClass}>
                Notes (optional)
              </Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            {state.status === "error" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p>{state.error}</p>
              </div>
            )}

            <Button type="submit" disabled={state.status === "submitting"}>
              {state.status === "submitting"
                ? editing
                  ? "Saving…"
                  : "Logging…"
                : editing
                  ? "Save changes"
                  : "Log session"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
