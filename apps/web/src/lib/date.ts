/**
 * Dates in this app (race day, session dates) represent a calendar day,
 * stored as UTC midnight. Formatting with the viewer's local timezone can
 * roll that back a day (e.g. 2027-02-27 shows as 2/26/2027 west of UTC) —
 * force UTC so the displayed date always matches what was stored.
 */
export function formatUTCDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}
