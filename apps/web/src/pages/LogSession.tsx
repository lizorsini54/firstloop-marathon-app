import { logSessionInputSchema } from "@firstloop/contracts/schemas/session";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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

const today = new Date().toISOString().slice(0, 10);

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: "RUN", label: "Run" },
  { value: "LIFT", label: "Lift" },
  { value: "BIKE", label: "Bike" },
  { value: "REST", label: "Rest" },
];

export function LogSession() {
  const navigate = useNavigate();
  const [date, setDate] = useState(today);
  const [type, setType] = useState<WorkoutType>("RUN");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [rpe, setRpe] = useState("5");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const result = logSessionInputSchema.safeParse({
      date,
      type,
      distanceMiles: distanceMiles ? Number(distanceMiles) : undefined,
      durationMin: Number(durationMin),
      rpe: Number(rpe),
      notes: notes.trim() || undefined,
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
