import type { DashboardOutput } from "@firstloop/contracts";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MileageChart } from "../components/MileageChart";
import { PhaseArc } from "../components/PhaseArc";
import { formatUTCDate } from "../lib/date";
import { titleCase } from "../lib/format";
import { orpc } from "../lib/orpc";
import { describePrescription } from "../lib/prescription";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: DashboardOutput };

const PHASE_LABEL: Record<string, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
};

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export function Dashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    orpc
      .getDashboard()
      .then((data) => setState({ status: "success", data }))
      .catch((error: unknown) =>
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
  }, []);

  if (state.status === "loading") {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  if (state.status === "error") {
    return <p className="p-6 text-destructive">Error: {state.error}</p>;
  }

  const { plan, plannedWorkouts, sessionLogs, weeklyMileageTotal } = state.data;

  if (!plan) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="font-display text-2xl font-bold uppercase tracking-tight">
          No plan on the board yet
        </p>
        <p className="mt-2 text-muted-foreground">
          Tell us your race day and we'll build the weeks back from it.
        </p>
        <Link
          to="/intake"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Set your goal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={labelClass}>
              Week {plan.currentWeek} of {plan.totalWeeks}
            </p>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
              {PHASE_LABEL[plan.phase]} phase
            </h1>
          </div>
          <div className="text-right">
            <p className={labelClass}>Race day</p>
            <p className="font-mono text-lg text-foreground">
              {formatUTCDate(plan.raceDate)}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-md border border-border bg-card p-3">
          <PhaseArc totalWeeks={plan.totalWeeks} currentWeek={plan.currentWeek} phase={plan.phase} />
        </div>
        {plan.feasibilityWarning && (
          <div className="mt-4 rounded-md border border-flare/40 bg-flare-bg p-3 text-sm">
            {plan.feasibilityWarning}
          </div>
        )}
      </header>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className={labelClass}>This week's plan</h2>
          <Link
            to="/plan"
            className="rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            View full plan
          </Link>
        </div>
        <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
          {plannedWorkouts.map((w) => (
            <li
              key={w.id}
              className="grid grid-cols-[6rem_4rem_1fr_auto] items-center gap-2 px-4 py-2.5 text-sm"
            >
              <span>{titleCase(w.day)}</span>
              <span>{titleCase(w.type)}</span>
              <span className="text-right font-mono text-muted-foreground">
                {describePrescription(w.prescription)}
              </span>
              {w.type === "LIFT" && w.prescription.exercises ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigate("/log", {
                      state: { plannedWorkoutId: w.id, type: w.type, prescription: w.prescription },
                    });
                  }}
                  className="rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Log this
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className={labelClass}>Logged this week</h2>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {weeklyMileageTotal.toFixed(1)}
            </span>
            <span className={labelClass}>mi</span>
          </div>
        </div>
        {sessionLogs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing logged yet — the week's still open.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
            {sessionLogs.map((s) => (
              <li key={s.id} className="grid grid-cols-[6rem_4rem_1fr] items-center gap-2 px-4 py-2.5 text-sm">
                <span className="font-mono">{formatUTCDate(s.date)}</span>
                <span>{titleCase(s.type)}</span>
                <span className="text-right font-mono text-muted-foreground">
                  {s.setLog && s.setLog.length > 0
                    ? `${s.setLog.length} exercises logged · RPE ${s.rpe}`
                    : `${s.distanceMiles ? `${s.distanceMiles}mi · ` : ""}${s.durationMin}min · RPE ${s.rpe}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className={labelClass}>Weekly mileage</h2>
        <div className="mt-2 rounded-md border border-border bg-card p-3">
          <MileageChart data={state.data.weeklyMileageHistory} />
        </div>
      </section>

      <Link
        to="/log"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Log a session
      </Link>
    </div>
  );
}
