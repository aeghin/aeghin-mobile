import {
  addDays,
  dayKey,
  daysBetween,
  earliestDate,
  keyToDate,
  shiftMonth,
} from "@/lib/events/format";
import { inZone } from "@/lib/time-zone";
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
 * The web dashboard's `lib/time-scope.ts`, rule for rule, so both show
 * the same events in the same places. `now` is the organization's clock read
 * as floating time (`useChurchClock`), like the event times it is compared
 * with: a block is over once its end has passed there, and an event once all
 * of its blocks are — the moment the reminders and the bell let go of it too.
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

const startOf = (date: EventDate) => new Date(date.startTime).getTime();
const endOf = (date: EventDate) => new Date(date.endTime).getTime();

/** Over once its end has passed on the organization's clock. */
export function isBlockOver(date: EventDate, now: Date): boolean {
  return endOf(date) < now.getTime();
}

/** True only once every one of the event's blocks is over. */
export function isEventPast(event: OrganizationEvent, now: Date): boolean {
  return event.dates.length > 0 && event.dates.every((date) => isBlockOver(date, now));
}

/** Whether a block overlaps a `"2026-08"` month, its last second included. */
function inMonth(date: EventDate, month: string): boolean {
  const first = keyToDate(`${month}-01`).getTime();
  const last = keyToDate(`${shiftMonth(month, 1)}-01`).getTime() - 1000;
  return startOf(date) <= last && endOf(date) >= first;
}

/** Whether one block belongs to the chosen period. */
function blockInScope(
  date: EventDate,
  scope: TimeScope,
  month: string,
  now: Date,
): boolean {
  switch (scope) {
    case "upcoming":
      return !isBlockOver(date, now);
    case "week": {
      // Up to the church's midnight a week from today.
      const weekEnd = keyToDate(addDays(dayKey(now), 7)).getTime();
      return startOf(date) <= weekEnd && !isBlockOver(date, now);
    }
    case "month":
      return inMonth(date, month);
    case "past":
      return isBlockOver(date, now);
  }
}

/** True when any of the event's blocks falls inside the chosen period. */
export function isInScope(
  event: OrganizationEvent,
  scope: TimeScope,
  month: string,
  now: Date,
): boolean {
  if (event.dates.length === 0) return false;

  if (scope === "past") {
    return isEventPast(event, now) && event.dates.some((date) => inMonth(date, month));
  }

  return event.dates.some((date) => blockInScope(date, scope, month, now));
}

/**
 * The day an event files under: the start of its earliest block that the
 * period contains — falling back to its true start — so a multi-day event
 * that began before the period, or whose first day is already over, groups
 * under the day it is next on.
 */
export function anchorDayKey(
  event: OrganizationEvent,
  scope: TimeScope,
  month: string,
  now: Date,
): string {
  const inScope = event.dates.filter((date) => blockInScope(date, scope, month, now));
  const anchor = earliestDate(inScope.length > 0 ? inScope : event.dates);

  return anchor ? dayKey(anchor.startTime) : dayKey(now);
}

/**
 * The next real instant at which the schedule would read differently: a block
 * ending, an invitation lapsing, or the church's midnight. `now` is the
 * floating clock at `instant`.
 */
export function nextChange(
  dates: readonly EventDate[],
  deadlines: readonly string[],
  timeZone: string,
  now: Date,
  instant: number,
): number {
  // The soonest block still going, found on the floating clock so that only
  // one time needs turning into an instant. It is over a moment after its end.
  let soonestEnd = keyToDate(addDays(dayKey(now), 1)).getTime();
  for (const date of dates) {
    const end = endOf(date);
    if (end >= now.getTime() && end < soonestEnd) soonestEnd = end;
  }

  let next = inZone(new Date(soonestEnd), timeZone).getTime() + 1;
  for (const deadline of deadlines) {
    const at = new Date(deadline).getTime();
    if (at > instant && at < next) next = at;
  }

  // Across a daylight-saving change a wall time can name no instant at all.
  return next > instant ? next : instant + 60_000;
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
  now: Date,
): DayGroup[] {
  const groups = new Map<string, OrganizationEvent[]>();

  for (const event of events) {
    const key = anchorDayKey(event, scope, month, now);
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
  /** Days from today to the block's start; one already going is today's. */
  inDays: number;
};

/**
 * The next commitment the user has actually accepted: the earliest block, of
 * any accepted event, that has not finished yet.
 */
export function findUpNext(
  events: OrganizationEvent[],
  now: Date,
): UpNext | null {
  let best: UpNext | null = null;

  for (const event of events) {
    if (!assignmentFor(event, "ACCEPTED")) continue;

    for (const date of event.dates) {
      if (isBlockOver(date, now)) continue;
      if (best && startOf(date) >= startOf(best.date)) continue;
      best = {
        event,
        date,
        inDays: Math.max(0, daysBetween(dayKey(now), dayKey(date.startTime))),
      };
    }
  }

  return best;
}

export type Staffing = {
  filled: number;
  awaiting: number;
  declined: number;
  needed: number;
};

/**
 * How many of an event's spots are filled, waiting on an answer, or declined —
 * three BGVs are three. A server older than spot counts says it per role, and
 * one without the newer counts reads as nobody waiting and nobody declining.
 */
export function staffingFor(event: OrganizationEvent): Staffing | null {
  if (event.staffing) {
    return event.staffing.needed > 0 ? event.staffing : null;
  }

  const needed = event.rolesNeeded.length;
  if (needed === 0 || event.filledRoleCount === undefined) return null;
  return {
    filled: Math.min(event.filledRoleCount, needed),
    awaiting: event.awaitingRoleCount ?? 0,
    declined: event.declinedRoleCount ?? 0,
    needed,
  };
}

/** The meter read aloud, since it carries no words of its own. */
export function describeStaffing({ filled, awaiting, declined, needed }: Staffing): string {
  return [
    `${filled} of ${needed} ${needed === 1 ? "spot" : "spots"} filled`,
    awaiting > 0 ? `${awaiting} pending` : null,
    declined > 0 ? `${declined} declined` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
