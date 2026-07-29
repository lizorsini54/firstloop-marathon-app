import { computePhaseBoundaries } from "@firstloop/plan-engine";
import type { Phase } from "@firstloop/plan-engine";

const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
};

const WIDTH = 560;
const HEIGHT = 92;
const PAD_X = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

/**
 * The signature element: a schematic elevation-profile of the plan's
 * base/build/peak/taper arc, the same artifact every marathoner has
 * stared at for their own race. Shape reflects this plan's actual phase
 * proportions (via computePhaseBoundaries), not literal daily mileage —
 * that data isn't fetched here, this is presentation only.
 */
export function PhaseArc({
  totalWeeks,
  currentWeek,
  phase,
}: {
  totalWeeks: number;
  currentWeek: number;
  phase: Phase;
}) {
  const b = computePhaseBoundaries(totalWeeks);

  // Anchor points: (week, normalized effort 0-1) at each phase transition.
  const anchors: [number, number][] = [
    [1, 0.16],
    [b.base, 0.48],
    [b.base + b.build, 0.86],
    [b.base + b.build + b.peak, 0.92],
    [totalWeeks, 0.14],
  ];

  const plotW = WIDTH - PAD_X * 2;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const toX = (week: number) => PAD_X + ((week - 1) / Math.max(1, totalWeeks - 1)) * plotW;
  const toY = (effort: number) => PAD_TOP + (1 - effort) * plotH;

  const points = anchors.map(([week, effort]) => [toX(week), toY(effort)] as const);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.[0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} L${points[0]?.[0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

  // Interpolate current-week position along the piecewise-linear path.
  const cw = Math.min(Math.max(currentWeek, 1), totalWeeks);
  let markerX = toX(cw);
  let markerY = toY(anchors[0]?.[1] ?? 0);
  for (let i = 0; i < anchors.length - 1; i++) {
    const [w0, e0] = anchors[i] ?? [1, 0];
    const [w1, e1] = anchors[i + 1] ?? [totalWeeks, 0];
    if (cw >= w0 && cw <= w1) {
      const t = w1 === w0 ? 0 : (cw - w0) / (w1 - w0);
      markerX = toX(cw);
      markerY = toY(e0 + (e1 - e0) * t);
      break;
    }
  }

  const phaseTicks: { week: number; label: string; active: boolean }[] = [
    { week: 1, label: "Base", active: phase === "base" },
    { week: b.base + 1, label: "Build", active: phase === "build" },
    { week: b.base + b.build + 1, label: "Peak", active: phase === "peak" },
    { week: b.base + b.build + b.peak + 1, label: "Taper", active: phase === "taper" },
  ];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={`Training plan progress: week ${currentWeek} of ${totalWeeks}, ${PHASE_LABEL[phase]} phase`}
    >
      <defs>
        <linearGradient id="phase-arc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#phase-arc-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {phaseTicks.map((tick) => (
        <text
          key={tick.label}
          x={toX(tick.week)}
          y={HEIGHT - 6}
          fontFamily="var(--face-body)"
          fontSize="9"
          fontWeight={tick.active ? 700 : 500}
          letterSpacing="0.04em"
          fill={tick.active ? "var(--foreground)" : "var(--muted-foreground)"}
        >
          {tick.label.toUpperCase()}
        </text>
      ))}

      <line x1={markerX} y1={markerY} x2={markerX} y2={HEIGHT - PAD_BOTTOM} stroke="var(--flare)" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx={markerX} cy={markerY} r="4.5" fill="var(--flare)" stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}
