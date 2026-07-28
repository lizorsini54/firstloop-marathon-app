import type { DashboardOutput } from "@firstloop/contracts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { orpc } from "../lib/orpc";

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

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function describePrescription(
  p: DashboardOutput["plannedWorkouts"][number]["prescription"],
): string {
  const parts: string[] = [];
  if (p.distanceMiles) parts.push(`${p.distanceMiles}mi`);
  if (p.durationMin) parts.push(`${p.durationMin}min`);
  if (p.quality) parts.push(p.quality);
  if (p.reducedVolume) parts.push("reduced volume");
  return parts.join(" · ") || "—";
}

export function Dashboard() {
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
    return <p className="p-6 text-red-500">Error: {state.error}</p>;
  }

  const { plan, plannedWorkouts, sessionLogs, weeklyMileageTotal } = state.data;

  if (!plan) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You don't have a training plan yet.</p>
        <Link to="/intake" className="mt-2 inline-block underline underline-offset-4">
          Set your goal to generate one
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header>
        <h1 className="text-xl font-semibold">
          Week {plan.currentWeek} of {plan.totalWeeks} · {PHASE_LABEL[plan.phase]} phase
        </h1>
        <p className="text-sm text-muted-foreground">
          Race day {new Date(plan.raceDate).toLocaleDateString()}
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground">This week's plan</h2>
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {plannedWorkouts.map((w) => (
            <li key={w.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="w-24">{titleCase(w.day)}</span>
              <span className="w-16">{titleCase(w.type)}</span>
              <span className="text-muted-foreground">{describePrescription(w.prescription)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground">
          Logged this week · {weeklyMileageTotal.toFixed(1)} mi total
        </h2>
        {sessionLogs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {sessionLogs.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="w-24">{new Date(s.date).toLocaleDateString()}</span>
                <span className="w-16">{titleCase(s.type)}</span>
                <span className="text-muted-foreground">
                  {s.distanceMiles ? `${s.distanceMiles}mi · ` : ""}
                  {s.durationMin}min · RPE {s.rpe}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to="/log"
        className="mt-6 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Log a session
      </Link>
    </div>
  );
}
