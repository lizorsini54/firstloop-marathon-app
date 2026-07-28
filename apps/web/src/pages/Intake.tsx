import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { orpc } from "../lib/orpc";

const INJURY_OPTIONS = ["Knee", "IT band", "Shin splints"];

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; error: string };

export function Intake() {
  const navigate = useNavigate();
  const [raceDate, setRaceDate] = useState("");
  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState("");
  const [liftDaysPerWeek, setLiftDaysPerWeek] = useState("2");
  const [bikeDaysPerWeek, setBikeDaysPerWeek] = useState("0");
  const [checkedInjuries, setCheckedInjuries] = useState<string[]>([]);
  const [otherInjury, setOtherInjury] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const [warnings, setWarnings] = useState<string[]>([]);

  function toggleInjury(option: string) {
    setCheckedInjuries((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });
    setWarnings([]);

    const injuryFlags = [...checkedInjuries];
    if (otherInjury.trim()) injuryFlags.push(otherInjury.trim());

    try {
      const result = await orpc.createPlan({
        raceDate: new Date(raceDate),
        currentWeeklyMileage: Number(currentWeeklyMileage),
        liftDaysPerWeek: Number(liftDaysPerWeek),
        bikeDaysPerWeek: Number(bikeDaysPerWeek),
        injuryFlags,
      });
      setState({ status: "idle" });
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
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
      <h1 className="text-xl font-semibold">Set your goal</h1>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Race date</span>
          <input
            type="date"
            required
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Current weekly mileage</span>
          <input
            type="number"
            required
            min={0}
            step="0.1"
            value={currentWeeklyMileage}
            onChange={(e) => setCurrentWeeklyMileage(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Lift days per week</span>
          <input
            type="number"
            required
            min={0}
            max={7}
            value={liftDaysPerWeek}
            onChange={(e) => setLiftDaysPerWeek(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Bike days per week</span>
          <input
            type="number"
            required
            min={0}
            max={7}
            value={bikeDaysPerWeek}
            onChange={(e) => setBikeDaysPerWeek(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Injury flags</legend>
          {INJURY_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checkedInjuries.includes(option)}
                onChange={() => toggleInjury(option)}
              />
              {option}
            </label>
          ))}
          <input
            type="text"
            placeholder="Other (optional)"
            value={otherInjury}
            onChange={(e) => setOtherInjury(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </fieldset>

        {warnings.length > 0 && (
          <div className="rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-900">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
            <button
              type="button"
              onClick={() => {
                void navigate("/dashboard");
              }}
              className="mt-2 underline underline-offset-4"
            >
              Continue to dashboard
            </button>
          </div>
        )}

        {state.status === "error" && (
          <p className="text-sm text-red-500">Error: {state.error}</p>
        )}

        <button
          type="submit"
          disabled={state.status === "submitting"}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {state.status === "submitting" ? "Generating plan…" : "Generate plan"}
        </button>
      </form>
    </div>
  );
}
