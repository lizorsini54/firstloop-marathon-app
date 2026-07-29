import type { DashboardOutput } from "@firstloop/contracts";

export function describePrescription(
  p: DashboardOutput["plannedWorkouts"][number]["prescription"],
): string {
  if (p.exercises && p.exercises.length > 0) {
    const parts = [p.displayName, p.block ? `${p.block} block` : undefined, `${p.exercises.length} exercises`];
    return parts.filter(Boolean).join(" · ");
  }
  if (p.displayName) {
    // A custom lift session with no prescribed exercises — real data, just
    // nothing to enumerate, not a placeholder.
    return p.displayName;
  }
  const parts: string[] = [];
  if (p.distanceMiles) parts.push(`${p.distanceMiles}mi`);
  if (p.durationMin) parts.push(`${p.durationMin}min`);
  if (p.quality) parts.push(p.quality);
  if (p.reducedVolume) parts.push("reduced volume");
  return parts.join(" · ") || "—";
}
