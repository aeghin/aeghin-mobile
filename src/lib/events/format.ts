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

/** `"Saturday, August 30, 2026"` — the single-day form of the details card. */
export function formatLongDate(value: string | Date): string {
  return toDate(value).toLocaleDateString("en-US", {
    timeZone: UTC,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The one line that answers "what day is this?" on the details screen.
 *
 * A single calendar day gets the long form; anything spanning days gets the
 * range with its year, which is the web's own wording. The end is the last
 * block's *start*, not its end — an event finishing after midnight ends on the
 * day it was billed for, not on the following morning.
 */
export function formatDateSpan(dates: EventDate[]): string {
  const sorted = sortDates(dates);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return "";

  if (!isMultiDay(dates)) {
    return formatLongDate(first.startTime);
  }

  const end = new Date(last.startTime);

  return `${formatShortDate(first.startTime)} – ${formatShortDate(end)}, ${end.getUTCFullYear()}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * When a log entry was written, in **device time**.
 *
 * The one date in this app that is not UTC wall-clock: an event at 9am is
 * written `09:00Z` wherever it happens, but an activity row records the moment
 * something actually occurred, and that moment belongs to the reader's clock.
 *
 * Relative inside a week and dated beyond it, matching the web's `date-fns`
 * pairing of `formatDistanceToNow` and `format(…, "MMM d, yyyy")`.
 */
export function formatActivityTime(value: string | Date): string {
  const date = toDate(value);
  const elapsed = Date.now() - date.getTime();

  // A row from the future is a clock disagreeing with the server, not news.
  if (elapsed < MINUTE) return "Just now";

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The three lines of a date tile — `AUG` / `30` / `SUN`. */
export function formatDateTile(value: string | Date): {
  month: string;
  day: string;
  weekday: string;
} {
  const date = toDate(value);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleString("en-US", { timeZone: UTC, ...options });

  return {
    month: part({ month: "short" }).toUpperCase(),
    day: String(date.getUTCDate()),
    weekday: part({ weekday: "short" }).toUpperCase(),
  };
}
