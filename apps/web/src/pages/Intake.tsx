import { createPlanInputSchema } from "@firstloop/contracts/schemas/plan";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

const INJURY_OPTIONS = ["Knee", "IT band", "Shin splints"];
const DAY_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; error: string };

export function Intake() {
  const navigate = useNavigate();
  const [raceDate, setRaceDate] = useState("");
  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState("");
  const [bikeDaysPerWeek, setBikeDaysPerWeek] = useState("0");
  const [checkedInjuries, setCheckedInjuries] = useState<string[]>([]);
  const [otherInjury, setOtherInjury] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [warnings, setWarnings] = useState<string[]>([]);

  function toggleInjury(option: string, checked: boolean) {
    setCheckedInjuries((prev) =>
      checked ? [...prev, option] : prev.filter((o) => o !== option),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setWarnings([]);

    const injuryFlags = [...checkedInjuries];
    if (otherInjury.trim()) injuryFlags.push(otherInjury.trim());

    const result = createPlanInputSchema.safeParse({
      raceDate,
      currentWeeklyMileage: Number(currentWeeklyMileage),
      bikeDaysPerWeek: Number(bikeDaysPerWeek),
      injuryFlags,
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
      const created = await orpc.createPlan(result.data);
      setState({ status: "idle" });
      if (created.warnings.length > 0) {
        setWarnings(created.warnings);
      } else {
        void navigate("/dashboard");
      }
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
            Set your goal
          </CardTitle>
          <CardDescription>
            We'll build the weeks back from your race day and current routine.
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
              <Label htmlFor="raceDate" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Race date
              </Label>
              <Input
                id="raceDate"
                type="date"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                aria-invalid={Boolean(fieldErrors.raceDate)}
                className="font-mono"
              />
              {fieldErrors.raceDate && (
                <p className="text-sm text-destructive">{fieldErrors.raceDate}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentWeeklyMileage" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Current weekly mileage
              </Label>
              <Input
                id="currentWeeklyMileage"
                type="number"
                min={0}
                step="0.1"
                value={currentWeeklyMileage}
                onChange={(e) => setCurrentWeeklyMileage(e.target.value)}
                aria-invalid={Boolean(fieldErrors.currentWeeklyMileage)}
                className="font-mono"
              />
              {fieldErrors.currentWeeklyMileage && (
                <p className="text-sm text-destructive">{fieldErrors.currentWeeklyMileage}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bikeDaysPerWeek" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Bike days per week
              </Label>
              <Select value={bikeDaysPerWeek} onValueChange={setBikeDaysPerWeek}>
                <SelectTrigger id="bikeDaysPerWeek" className="w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="font-mono">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Injury flags
              </Label>
              {INJURY_OPTIONS.map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    id={`injury-${option}`}
                    checked={checkedInjuries.includes(option)}
                    onCheckedChange={(checked) => toggleInjury(option, checked === true)}
                  />
                  <Label htmlFor={`injury-${option}`} className="font-normal">
                    {option}
                  </Label>
                </div>
              ))}
              <Textarea
                placeholder="Other (optional)"
                value={otherInjury}
                onChange={(e) => setOtherInjury(e.target.value)}
                rows={2}
              />
            </div>

            {warnings.length > 0 && (
              <div className="rounded-md border border-flare/40 bg-flare-bg p-3 text-sm">
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
                <Button
                  type="button"
                  variant="link"
                  className="mt-2 h-auto p-0"
                  onClick={() => {
                    void navigate("/dashboard");
                  }}
                >
                  Continue to dashboard
                </Button>
              </div>
            )}

            {state.status === "error" && (
              <p className="text-sm text-destructive">Error: {state.error}</p>
            )}

            <Button type="submit" disabled={state.status === "submitting"}>
              {state.status === "submitting" ? "Generating plan…" : "Generate plan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
