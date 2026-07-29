import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "../lib/orpc";

type WorkoutType = "RUN" | "LIFT" | "BIKE" | "REST";

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; error: string };

const today = new Date().toISOString().slice(0, 10);

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export function LogSession() {
  const navigate = useNavigate();
  const [date, setDate] = useState(today);
  const [type, setType] = useState<WorkoutType>("RUN");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [rpe, setRpe] = useState("5");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });
    try {
      await orpc.logSession({
        date: new Date(date),
        type,
        distanceMiles: distanceMiles ? Number(distanceMiles) : undefined,
        durationMin: Number(durationMin),
        rpe: Number(rpe),
        notes: notes.trim() || undefined,
      });
      void navigate("/dashboard");
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl font-bold uppercase tracking-tight">
            Log a session
          </CardTitle>
          <CardDescription>What did you actually do out there?</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${fieldClass} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
                className={fieldClass}
              >
                <option value="RUN">Run</option>
                <option value="LIFT">Lift</option>
                <option value="BIKE">Bike</option>
                <option value="REST">Rest</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Distance (miles, optional)</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
                className={`${fieldClass} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Duration (minutes)</span>
              <input
                type="number"
                required
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className={`${fieldClass} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>RPE (1-10)</span>
              <input
                type="number"
                required
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className={`${fieldClass} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={fieldClass}
              />
            </label>

            {state.status === "error" && (
              <p className="text-sm text-destructive">Error: {state.error}</p>
            )}

            <button
              type="submit"
              disabled={state.status === "submitting"}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {state.status === "submitting" ? "Logging…" : "Log session"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
