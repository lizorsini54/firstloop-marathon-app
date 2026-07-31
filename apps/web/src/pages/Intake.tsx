import { createPlanInputSchema } from "@firstloop/contracts/schemas/plan";
import { checkFeasibility, estimateAvailableWeeks } from "@firstloop/plan-engine";
import { useMemo, useState } from "react";
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
const RUNNING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const CUSTOM_LIFT_DAY_OPTIONS = [1, 2, 3, 4];

type StrengthMode = "program" | "custom" | "none";
type RunningExperience = "first_marathon" | "has_finished_one";

const STRENGTH_MODE_OPTIONS: { value: StrengthMode; label: string }[] = [
  { value: "program", label: "Follow a program" },
  { value: "custom", label: "Custom" },
  { value: "none", label: "None" },
];

const RUNNING_EXPERIENCE_OPTIONS: { value: RunningExperience; label: string }[] = [
  { value: "first_marathon", label: "This is my first marathon" },
  { value: "has_finished_one", label: "I've finished one before" },
];

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; error: string };

export function Intake() {
  const navigate = useNavigate();
  const [raceDate, setRaceDate] = useState("");
  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState("");
  const [runningExperience, setRunningExperience] = useState<RunningExperience>("has_finished_one");
  // These four defaults are chosen together: 3 run / 1 bike / custom-2 is
  // verified (Checkpoint 16) to schedule every strength session with a real
  // rest day left over, so a first plan built without touching anything never
  // opens on a day-economy warning. Changing one in isolation can reintroduce
  // it — the strength program competes with running and bike days for the same
  // seven days. See DECISIONS.md, Checkpoint 16.
  const [runningDaysPerWeek, setRunningDaysPerWeek] = useState("3");
  const [strengthMode, setStrengthMode] = useState<StrengthMode>("custom");
  const [customLiftDaysPerWeek, setCustomLiftDaysPerWeek] = useState("2");
  const [bikeDaysPerWeek, setBikeDaysPerWeek] = useState("1");
  const [checkedInjuries, setCheckedInjuries] = useState<string[]>([]);
  const [otherInjury, setOtherInjury] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [warnings, setWarnings] = useState<string[]>([]);

  // Live, non-blocking feasibility check — recomputed as race date/experience
  // change, mirroring the same check the server persists at creation time.
  const feasibilityWarning = useMemo(() => {
    if (!raceDate) return null;
    const parsedRaceDate = new Date(raceDate);
    if (Number.isNaN(parsedRaceDate.getTime())) return null;
    const availableWeeks = estimateAvailableWeeks(parsedRaceDate, new Date());
    return checkFeasibility(availableWeeks, runningExperience).warning;
  }, [raceDate, runningExperience]);

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
      runningExperience,
      runningDaysPerWeek: Number(runningDaysPerWeek),
      strengthMode,
      customLiftDaysPerWeek: strengthMode === "custom" ? Number(customLiftDaysPerWeek) : undefined,
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
              <Label htmlFor="runningExperience" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Running experience
              </Label>
              <Select
                value={runningExperience}
                onValueChange={(v) => setRunningExperience(v as RunningExperience)}
              >
                <SelectTrigger id="runningExperience" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUNNING_EXPERIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="runningDaysPerWeek" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Current running days per week
              </Label>
              <Select value={runningDaysPerWeek} onValueChange={setRunningDaysPerWeek}>
                <SelectTrigger id="runningDaysPerWeek" className="w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUNNING_DAY_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="font-mono">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {feasibilityWarning && (
              <div className="rounded-md border border-flare/40 bg-flare-bg p-3 text-sm">
                <p>{feasibilityWarning}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="strengthMode" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Strength training
              </Label>
              <Select value={strengthMode} onValueChange={(v) => setStrengthMode(v as StrengthMode)}>
                <SelectTrigger id="strengthMode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRENGTH_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {strengthMode === "program" && (
                <p className="text-xs text-muted-foreground">
                  Glute Gladiator: Revamped — 4 sessions a week, dropping to 3 during your peak
                  running mileage.
                </p>
              )}
            </div>

            {strengthMode === "custom" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customLiftDaysPerWeek" className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Lift days per week
                </Label>
                <Select value={customLiftDaysPerWeek} onValueChange={setCustomLiftDaysPerWeek}>
                  <SelectTrigger id="customLiftDaysPerWeek" className="w-full font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_LIFT_DAY_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)} className="font-mono">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.customLiftDaysPerWeek && (
                  <p className="text-sm text-destructive">{fieldErrors.customLiftDaysPerWeek}</p>
                )}
              </div>
            )}

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
