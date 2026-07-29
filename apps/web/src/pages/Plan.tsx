import type { GetPlanOverviewOutput } from "@firstloop/contracts";
import { computePhaseBoundaries, phaseForWeek } from "@firstloop/plan-engine";
import type { Phase } from "@firstloop/plan-engine";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhaseArc } from "../components/PhaseArc";
import { formatUTCDate } from "../lib/date";
import { titleCase } from "../lib/format";
import { orpc } from "../lib/orpc";
import { describePrescription } from "../lib/prescription";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: GetPlanOverviewOutput };

type PlanWeek = GetPlanOverviewOutput["weeks"][number];

const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
};

const PHASE_ORDER: Phase[] = ["base", "build", "peak", "taper"];

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

function summarizeWeek(workouts: PlanWeek["workouts"]): string {
  const longRun = workouts.find((w) => w.type === "RUN" && w.prescription.quality === "long");
  const liftCount = workouts.filter((w) => w.type === "LIFT").length;
  const parts: string[] = [];
  if (longRun?.prescription.distanceMiles) parts.push(`Long run ${longRun.prescription.distanceMiles}mi`);
  if (liftCount > 0) parts.push(`${liftCount} lift${liftCount === 1 ? "" : "s"}`);
  return parts.join(" · ") || "—";
}

export function Plan() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    orpc
      .getPlanOverview()
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

  const { plan, weeks } = state.data;

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

  const boundaries = computePhaseBoundaries(plan.totalWeeks);
  const phaseBuckets: Record<Phase, PlanWeek[]> = { base: [], build: [], peak: [], taper: [] };
  for (const week of weeks) {
    phaseBuckets[phaseForWeek(week.weekNumber, boundaries)].push(week);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={labelClass}>
              Week {plan.currentWeek} of {plan.totalWeeks}
            </p>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Full plan</h1>
          </div>
          <div className="text-right">
            <p className={labelClass}>Race day</p>
            <p className="font-mono text-lg text-foreground">{formatUTCDate(plan.raceDate)}</p>
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

      <Tabs defaultValue={plan.phase} className="mt-8">
        <TabsList>
          {PHASE_ORDER.map((phase) => (
            <TabsTrigger key={phase} value={phase}>
              {PHASE_LABEL[phase]}
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                {phaseBuckets[phase].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {PHASE_ORDER.map((phase) => {
          const phaseWeeks = phaseBuckets[phase];
          const currentWeekInPhase = phaseWeeks.some((w) => w.weekNumber === plan.currentWeek);

          return (
            <TabsContent key={phase} value={phase} className="mt-4">
              <Accordion type="multiple" defaultValue={currentWeekInPhase ? [String(plan.currentWeek)] : []}>
                {phaseWeeks.map((week) => {
                  const isCurrentWeek = week.weekNumber === plan.currentWeek;
                  return (
                    <AccordionItem
                      key={week.weekNumber}
                      value={String(week.weekNumber)}
                      className={isCurrentWeek ? "border-l-4 border-flare bg-flare-bg/30 pl-2" : undefined}
                    >
                      <AccordionTrigger className="px-2">
                        <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">Week {week.weekNumber}</span>
                            {isCurrentWeek && (
                              <span className="rounded-sm bg-flare px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
                                Current
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {summarizeWeek(week.workouts)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="divide-y divide-border rounded-md border border-border bg-card">
                          {week.workouts.map((w) => (
                            <li
                              key={w.id}
                              className="grid grid-cols-[6rem_4rem_1fr] items-center gap-2 px-4 py-2.5 text-sm"
                            >
                              <span>{titleCase(w.day)}</span>
                              <span>{titleCase(w.type)}</span>
                              <span className="text-right font-mono text-muted-foreground">
                                {describePrescription(w.prescription)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
