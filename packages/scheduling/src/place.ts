import { WEEK_DAY_ORDER } from "./types";
import type { DayOfWeek, Slot } from "./types";

function isBlockedByInterference(day: DayOfWeek, interferenceDays: DayOfWeek[]): boolean {
  const dayIndex = WEEK_DAY_ORDER.indexOf(day);
  const nextDay = WEEK_DAY_ORDER[dayIndex + 1];
  return nextDay !== undefined && interferenceDays.includes(nextDay);
}

/**
 * Places a set of slots into a week's available days. Generic — every
 * caller-specific number (which days are available, which are
 * interference days, how much spacing a group needs) comes in as an
 * argument, nothing about strength training or running is baked in here.
 *
 * Interference-respecting slots are placed first (their pick of eligible
 * days), grouped ones try for full spacing from their group's other
 * placements, then fall back in two more tiers: any interference-
 * respecting day, then — if literally every available day happens to sit
 * right before an interference day — any available day at all, rather
 * than silently dropping the slot. Slots that don't respect interference
 * fill whatever's left.
 */
export function placeSlots(
  slots: Slot[],
  availableDays: DayOfWeek[],
  interferenceDays: DayOfWeek[],
  minDaysBetweenGroupedSessions: number,
): Map<string, DayOfWeek> {
  const sortedDays = WEEK_DAY_ORDER.filter((d) => availableDays.includes(d));
  const constrainedSlots = slots.filter((s) => s.respectsInterference);
  const freeSlots = slots.filter((s) => !s.respectsInterference);

  const placements = new Map<string, DayOfWeek>();
  const usedDays = new Set<DayOfWeek>();
  const eligibleForInterference = sortedDays.filter((d) => !isBlockedByInterference(d, interferenceDays));
  const groupDayIndices = new Map<string, number[]>();

  for (const slot of constrainedSlots) {
    const group = slot.spacingGroup;
    const groupIndices = group ? (groupDayIndices.get(group) ?? []) : [];

    const wellSpaced = eligibleForInterference.find((d) => {
      if (usedDays.has(d)) return false;
      const dIndex = WEEK_DAY_ORDER.indexOf(d);
      return groupIndices.every((i) => Math.abs(dIndex - i) >= minDaysBetweenGroupedSessions);
    });
    const candidate =
      wellSpaced ??
      eligibleForInterference.find((d) => !usedDays.has(d)) ??
      sortedDays.find((d) => !usedDays.has(d));

    if (candidate) {
      placements.set(slot.name, candidate);
      usedDays.add(candidate);
      if (group) {
        groupDayIndices.set(group, [...groupIndices, WEEK_DAY_ORDER.indexOf(candidate)]);
      }
    }
  }

  for (const slot of freeSlots) {
    const candidate = sortedDays.find((d) => !usedDays.has(d));
    if (candidate) {
      placements.set(slot.name, candidate);
      usedDays.add(candidate);
    }
  }

  return placements;
}
