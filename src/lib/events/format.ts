import type { EventDate } from "@/types/event";

/**
 * Formatting for event dates and times.
 *
 * Everything here reads instants in **UTC**, because that is how the events are
 * stored: an event at 9am is written `09:00Z` no matter where the organization
 * is. Rendering one in device time would move a Sunday morning service to
 * Saturday night for anyone west of Greenwich.
 *
 * Days are compared as `"2026-08-30"` keys rather than as timestamps, which is
 * what keeps "is this past?" and "which day does it group under?" from
 * disagreeing at the edges of the day.
 */

const UTC = "UTC";

const pad = (value: number) => String(value).padStart(2, "0");

const toDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

/** `"2026-08-30"` — the UTC calendar day an instant falls on. */
export function dayKey(value: string | Date): string {
  const date = toDate(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** `"2026-08"` — the UTC month an instant falls in. */
export function monthKey(value: string | Date): string {
  return dayKey(value).slice(0, 7);
}

/**
 * The device's own calendar day, as a key comparable with {@link dayKey}.
 *
 * Local parts, not UTC ones: "today" belongs to the person holding the phone,
 * even though the events themselves are written in UTC.
 */
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The month the device is currently in, as a {@link monthKey}. */
export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

/** A day key back to an instant, at UTC midnight — for arithmetic and display. */
export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Whole days from one day key to another. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (keyToDate(to).getTime() - keyToDate(from).getTime()) / 86_400_000,
  );
}

/** Steps a month key by whole months, rolling the year over as it goes. */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKey(shifted);
}

/** `"August 2026"`. */
export function formatMonth(key: string): string {
  return keyToDate(`${key}-01`).toLocaleDateString("en-US", {
    timeZone: UTC,
    month: "long",
    year: "numeric",
  });
}

/** `"Sun, Aug 30"`. */
export function formatShortDate(value: string | Date): string {
  return toDate(value).toLocaleDateString("en-US", {
    timeZone: UTC,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** `"Aug 30"` — the same date without its weekday, for ranges. */
export function formatDayMonth(value: string | Date): string {
  return toDate(value).toLocaleDateString("en-US", {
    timeZone: UTC,
    month: "short",
    day: "numeric",
  });
}

/** `"9:00 AM"`. */
export function formatTime(value: string | Date): string {
  return toDate(value).toLocaleTimeString("en-US", {
    timeZone: UTC,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Blocks in chronological order. Every helper below assumes this ordering. */
export function sortDates(dates: EventDate[]): EventDate[] {
  return [...dates].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
}

export function earliestDate(dates: EventDate[]): EventDate | null {
  return sortDates(dates)[0] ?? null;
}

export function latestDate(dates: EventDate[]): EventDate | null {
  const sorted = [...dates].sort(
    (a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime(),
  );
  return sorted[sorted.length - 1] ?? null;
}

/** True when the event's blocks don't all land on one calendar day. */
export function isMultiDay(dates: EventDate[]): boolean {
  const first = earliestDate(dates);
  const last = latestDate(dates);
  if (!first || !last) return false;
  return dayKey(first.startTime) !== dayKey(last.endTime);
}

/**
 * `"Sun, Aug 30"`, `"Aug 30 – 31"`, or `"Aug 30 – Sep 2"` — a single day keeps
 * its weekday, a range drops it so the two halves stay balanced.
 */
export function formatDateRange(dates: EventDate[]): string {
  const first = earliestDate(dates);
  const last = latestDate(dates);
  if (!first || !last) return "";

  if (!isMultiDay(dates)) {
    return formatShortDate(first.startTime);
  }

  const start = new Date(first.startTime);
  const end = new Date(last.endTime);

  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${formatDayMonth(start)} – ${end.getUTCDate()}`;
  }

  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

/** `"9:00 AM – 11:00 AM"` for the earliest block, which is what a row shows. */
export function formatTimeRange(dates: EventDate[]): string {
  const first = earliestDate(dates);
  if (!first) return "";
  return `${formatTime(first.startTime)} – ${formatTime(first.endTime)}`;
}

/** The heading over a day's events: relative when it's near, else dated. */
export function formatDayHeading(key: string, today: string): string {
  const days = daysBetween(today, key);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return formatShortDate(keyToDate(key));
}

/** `"Today"`, `"Tomorrow"`, `"In 5 days"`, `"3 days ago"`. */
export function countdownLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  return `${Math.abs(days)} days ago`;
}

export type ExpiryLabel = {
  label: string;
  /** Gone, or going today — worth colouring rather than just stating. */
  urgent: boolean;
};

/** How long is left to answer an invitation. */
export function formatExpiry(expiresAt: string, today: string): ExpiryLabel {
  const days = daysBetween(today, dayKey(expiresAt));

  if (days < 0) return { label: "Expired", urgent: true };
  if (days === 0) return { label: "Expires today", urgent: true };
  if (days === 1) return { label: "Expires tomorrow", urgent: true };
  return { label: `Expires in ${days} days`, urgent: false };
}
