import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOutput } from "@firstloop/contracts";

type Props = {
  data: DashboardOutput["weeklyMileageHistory"];
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number | null; dataKey: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const planned = payload.find((p) => p.dataKey === "plannedMiles")?.value ?? 0;
  const actualEntry = payload.find((p) => p.dataKey === "actualMiles");
  const actual = actualEntry?.value ?? null;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Week {label}
      </p>
      <p className="mt-1 font-mono">
        Long run planned <span className="tabular-nums">{planned.toFixed(1)}mi</span>
      </p>
      <p className="font-mono">
        {actual === null ? (
          <span className="text-muted-foreground">Not run yet</span>
        ) : (
          <>
            Long run logged <span className="tabular-nums">{actual.toFixed(1)}mi</span>
          </>
        )}
      </p>
    </div>
  );
}

export function MileageChart({ data }: Props) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="weekNumber"
            tick={{ fontSize: 11, fontFamily: "var(--face-mono)", fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{
              value: "WEEK",
              position: "insideBottom",
              offset: -4,
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: "var(--face-mono)", fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="plannedMiles"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            fill="var(--muted)"
            fillOpacity={0.6}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actualMiles"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
