import { dayKey, daysBetween, earliestDate, latestDate, monthKey } from "@/lib/events/format";
import type {
  EventAssignment,
  EventDate,
  InvitationStatus,
  OrganizationEvent,
} from "@/types/event";

/**
 * Turning a flat list of events into what the screen draws: which tab an event
 * belongs to, whether it falls inside the chosen period, and which day it
 * groups under.
 *
 * Ported from the web dashboard's `MemberEventsDashboard`, with its timestamp
 * comparisons swapped for the day keys in `format.ts` — the events are stored
 * as UTC wall-clock, so comparing them against a device-local midnight is what
 * made "past" flicker across the date line there.
 */

export type EventsTab = "pending" | "schedule" | "all";

export type TimeScope = "upcoming" | "week" | "month" | "past";

export const TIME_SCOPES: { value: TimeScope; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "past", label: "Past" },
];

/** The month stepper only means anything for the two month-bound scopes. */
export function scopeUsesMonth(scope: TimeScope): boolean {
  return scope === "month" || scope === "past";
}

/** The signed-in user's assignment to this event, optionally by status. */
export function assignmentFor(
  event: OrganizationEvent,
  status?: InvitationStatus,
): EventAssignment | null {
  const match = status
    ? event.assignments.find((a) => a.status === status)
    : event.assignments[0];
  return match ?? null;
}

/** Every calendar day the event touches, earliest first. */
export function dayKeysFor(dates: EventDate[]): string[] {
  const first = earliestDate(dates);
  const last = latestDate(dates);
  if (!first || !last) return [];

  const start = dayKey(first.startTime);
  const span = daysBetween(start, dayKey(last.endTime));
  const keys: string[] = [];

  for (let offset = 0; offset <= span; offset += 1) {
    const date = new Date(`${start}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    keys.push(dayKey(date));
  }

  return keys;
}

/** True only once every one of the event's days is behind today. */
export function isEventPast(event: OrganizationEvent, today: string): boolean {
  const keys = dayKeysFor(event.dates);
  return keys.length > 0 && keys.every((key) => key < today);
}

/** True when any of the event's days falls inside the chosen period. */
export function isInScope(
  event: OrganizationEvent,
  scope: TimeScope,
  month: string,
  today: string,
): boolean {
  const keys = dayKeysFor(event.dates);
  if (keys.length === 0) return false;

  switch (scope) {
    case "upcoming":
      return keys.some((key) => key >= today);
    case "week": {
      const end = new Date(`${today}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 7);
      const weekEnd = dayKey(end);
      return keys.some((key) => key >= today && key <= weekEnd);
    }
    case "month":
      return keys.some((key) => monthKey(`${key}T00:00:00.000Z`) === month);
    case "past":
      return (
        keys.every((key) => key < today) &&
        keys.some((key) => monthKey(`${key}T00:00:00.000Z`) === month)
      );
  }
}

/**
 * The day an event files under.
 *
 * A multi-day event that starts before the period showing would otherwise
 * group above the period's first day, so the anchor is its earliest day that
 * the period actually contains — falling back to its true start.
 */
export function anchorDayKey(
  event: OrganizationEvent,
  scope: TimeScope,
  month: string,
  today: string,
): string {
  const keys = dayKeysFor(event.dates);
  if (keys.length === 0) return today;

  const inScope = keys.filter((key) => {
    switch (scope) {
      case "upcoming":
        return key >= today;
      case "week": {
        const end = new Date(`${today}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 7);
        return key >= today && key <= dayKey(end);
      }
      case "month":
        return monthKey(`${key}T00:00:00.000Z`) === month;
      case "past":
        return key < today;
    }
  });

  return inScope[0] ?? keys[0];
}

export type DayGroup = {
  key: string;
  events: OrganizationEvent[];
};

/** Events bucketed by the day they anchor to, days in chronological order. */
export function groupByDay(
  events: OrganizationEvent[],
  scope: TimeScope,
  month: string,
  today: string,
): DayGroup[] {
  const groups = new Map<string, OrganizationEvent[]>();

  for (const event of events) {
    const key = anchorDayKey(event, scope, month, today);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, grouped]) => ({
      key,
      events: grouped.sort((a, b) => {
        const first = earliestDate(a.dates)?.startTime ?? "";
        const second = earliestDate(b.dates)?.startTime ?? "";
        return first.localeCompare(second);
      }),
    }));
}

export type UpNext = {
  event: OrganizationEvent;
  date: EventDate;
  /** Days from today to the block's start — negative never happens here. */
  inDays: number;
};

/**
 * The next commitment the user has actually accepted: the earliest block, of
 * any accepted event, that has not finished yet.
 */
export function findUpNext(
  events: OrganizationEvent[],
  today: string,
): UpNext | null {
  let best: UpNext | null = null;

  for (const event of events) {
    if (!assignmentFor(event, "ACCEPTED")) continue;

    for (const date of event.dates) {
      if (dayKey(date.endTime) < today) continue;
      if (best && date.startTime >= best.date.startTime) continue;
      best = {
        event,
        date,
        inDays: daysBetween(today, dayKey(date.startTime)),
      };
    }
  }

  return best;
}

/** How many of an event's needed roles are filled, when the payload says. */
export function staffingFor(
  event: OrganizationEvent,
): { filled: number; needed: number } | null {
  const needed = event.rolesNeeded.length;
  if (needed === 0 || event.filledRoleCount === undefined) return null;
  return { filled: Math.min(event.filledRoleCount, needed), needed };
}
