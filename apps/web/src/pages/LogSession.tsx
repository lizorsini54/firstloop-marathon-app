import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { orpc } from "../lib/orpc";

type WorkoutType = "RUN" | "LIFT" | "BIKE" | "REST";

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; error: string };

const today = new Date().toISOString().slice(0, 10);

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
      <h1 className="text-xl font-semibold">Log a session</h1>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkoutType)}
            className="rounded-md border border-border px-3 py-2"
          >
            <option value="RUN">Run</option>
            <option value="LIFT">Lift</option>
            <option value="BIKE">Bike</option>
            <option value="REST">Rest</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Distance (miles, optional)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            value={distanceMiles}
            onChange={(e) => setDistanceMiles(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Duration (minutes)</span>
          <input
            type="number"
            required
            min={1}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">RPE (1-10)</span>
          <input
            type="number"
            required
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        {state.status === "error" && (
          <p className="text-sm text-red-500">Error: {state.error}</p>
        )}

        <button
          type="submit"
          disabled={state.status === "submitting"}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {state.status === "submitting" ? "Saving…" : "Save session"}
        </button>
      </form>
    </div>
  );
}
