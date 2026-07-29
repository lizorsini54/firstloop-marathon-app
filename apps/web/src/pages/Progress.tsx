import type { GetRunningProgressOutput } from "@firstloop/contracts";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { orpc } from "../lib/orpc";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: GetRunningProgressOutput };

type WeekPoint = GetRunningProgressOutput["weeks"][number];

const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

function shortDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "numeric", day: "numeric" });
}

function formatPace(minPerMile: number | null): string {
  if (minPerMile === null) return "—";
  const minutes = Math.floor(minPerMile);
  const seconds = Math.round((minPerMile - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/mi`;
}

function MileageTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: WeekPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className={labelClass}>Week of {shortDate(point.payload.weekStart)}</p>
      <p className="mt-1 font-mono tabular-nums">{point.value.toFixed(1)}mi</p>
    </div>
  );
}

function PaceTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number | null; payload: WeekPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  if (!point || point.value === null) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className={labelClass}>Week of {shortDate(point.payload.weekStart)}</p>
      <p className="mt-1 font-mono tabular-nums">{formatPace(point.value)}</p>
    </div>
  );
}

const axisTick = { fontSize: 11, fontFamily: "var(--face-mono)", fill: "var(--muted-foreground)" };

export function Progress() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    orpc
      .getRunningProgress()
      .then((data) => setState({ status: "success", data }))
      .catch((error: unknown) =>
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Running progress</h1>
      <p className="mt-1 text-muted-foreground">
        Mileage and pace trends across everything you've logged.
      </p>

      {state.status === "loading" && <p className="mt-6 text-muted-foreground">Loading…</p>}

      {state.status === "error" && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p>Couldn't load your progress: {state.error}</p>
        </div>
      )}

      {state.status === "success" && state.data.weeks.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing logged yet — log a run and your trends will show up here.
        </p>
      )}

      {state.status === "success" && state.data.weeks.length > 0 && (
        <>
          <section className="mt-8">
            <h2 className={labelClass}>Weekly mileage</h2>
            <div className="mt-2 h-56 w-full rounded-md border border-border bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.data.weeks} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={(v: string | Date) => shortDate(v)}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<MileageTrendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="totalMiles"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-8">
            <h2 className={labelClass}>Average pace</h2>
            <div className="mt-2 h-56 w-full rounded-md border border-border bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.data.weeks} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={(v: string | Date) => shortDate(v)}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) => formatPace(v)}
                    // Faster (lower minutes/mile) trends up — the intuitive
                    // reading for a pace chart.
                    reversed
                    domain={["dataMin", "dataMax"]}
                  />
                  <Tooltip content={<PaceTrendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="averagePaceMinPerMile"
                    stroke="var(--flare)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
