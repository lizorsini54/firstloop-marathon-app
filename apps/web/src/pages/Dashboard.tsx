import type { DashboardOutput } from "@firstloop/contracts";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CoachCard } from "../components/CoachCard";
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

  // Nothing here means anything without a plan, and the nav can't lead someone
  // to the one page that fixes that — "Goal" sits last, and generating a plan
  // sends you back here, so the real first-run sequence runs backwards against
  // the nav's own order. Route instead of asking them to find it.
  if (!plan) {
    return <Navigate to="/intake" replace />;
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
        {plan.strengthWarning && (
          <div className="mt-4 rounded-md border border-flare/40 bg-flare-bg p-3 text-sm">
            {plan.strengthWarning}
          </div>
        )}
        {plan.injuryWarning && (
          <div className="mt-4 rounded-md border border-flare/40 bg-flare-bg p-3 text-sm">
            {plan.injuryWarning}
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
              {/*
                Every planned session is loggable except a rest day. This was
                gated on `w.type === "LIFT"` from Checkpoint 9 through 16, so
                runs — the majority of every week, including the long run — had
                no way to be logged against their planned workout at all. See
                DECISIONS.md, Checkpoint 17.
              */}
              {w.type !== "REST" ? (
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
              {weeklyMileageTotal === null ? "—" : weeklyMileageTotal.toFixed(1)}
            </span>
            <span className={labelClass}>mi</span>
          </div>
        </div>
        {weeklyMileageTotal === null && sessionLogs.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Not measured in miles — none of this week's sessions recorded a distance.
          </p>
        )}
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

      <CoachCard />

      <section className="mt-8">
        <h2 className={labelClass}>Long-run distance — planned vs. logged</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Long runs are the only sessions prescribed by distance; easy and quality runs are
          prescribed by duration, so they aren't counted on either side of this comparison.
        </p>
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
