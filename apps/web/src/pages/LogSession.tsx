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
type LinkedPrescription = { displayName?: string; block?: string; exercises?: LinkedExercise[] };
type LogSessionNavState = {
  plannedWorkoutId?: string;
  type?: WorkoutType;
  prescription?: LinkedPrescription;
};

type SetEntry = { reps: string; weightLbs: string };
type ExerciseLog = { exercise: string; sets: SetEntry[] };

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
    exercise: ex.name,
    sets: Array.from({ length: parseSetCount(ex.setsReps) }, () => ({ reps: "", weightLbs: "" })),
  }));
}

export function LogSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as LogSessionNavState | null;
  const linkedExercises = navState?.prescription?.exercises;
  const isStructuredLift = Boolean(linkedExercises && linkedExercises.length > 0);

  const [date, setDate] = useState(today);
  const [type, setType] = useState<WorkoutType>(navState?.type ?? "RUN");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [rpe, setRpe] = useState("5");
  const [notes, setNotes] = useState("");
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(
    linkedExercises ? initialExerciseLogs(linkedExercises) : [],
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: "idle" });

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

    const setLog = isStructuredLift
      ? exerciseLogs
          .map((ex) => ({
            exercise: ex.exercise,
            sets: ex.sets
              .filter((s) => s.reps.trim() !== "")
              .map((s) => ({ reps: Number(s.reps), weightLbs: Number(s.weightLbs || "0") })),
          }))
          .filter((ex) => ex.sets.length > 0)
      : undefined;

    const result = logSessionInputSchema.safeParse({
      date,
      type,
      distanceMiles: distanceMiles ? Number(distanceMiles) : undefined,
      durationMin: Number(durationMin),
      rpe: Number(rpe),
      notes: notes.trim() || undefined,
      plannedWorkoutId: navState?.plannedWorkoutId,
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
      await orpc.logSession(result.data);
      void navigate("/dashboard");
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
            {isStructuredLift ? (navState?.prescription?.displayName ?? "Log a session") : "Log a session"}
          </CardTitle>
          <CardDescription>
            {isStructuredLift
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

            {!isStructuredLift && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="type" className={labelClass}>
                    Type
                  </Label>
                  <Select value={type} onValueChange={(v) => setType(v as WorkoutType)}>
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
              </>
            )}

            {isStructuredLift && (
              <div className="flex flex-col gap-3">
                {exerciseLogs.map((ex, i) => {
                  const template = linkedExercises?.[i];
                  return (
                    <div key={ex.exercise} className="rounded-md border border-border p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{ex.exercise}</p>
                        <p className="font-mono text-xs text-muted-foreground">{template?.setsReps}</p>
                      </div>
                      {template?.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{template.notes}</p>
                      )}
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
                  );
                })}
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
              {state.status === "submitting" ? "Logging…" : "Log session"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
