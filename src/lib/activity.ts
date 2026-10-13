import type { ActivityFilter } from "@/types/activity";

/**
 * How the Activity feed is sliced and dated on the phone: the dashboard's
 * `lib/activity-feed.ts`, chip for chip and heading for heading. The server
 * does the filtering; this only names the chips and files rows under days.
 *
 * Days are read in device time, like every other instant on the phone.
 */

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string; empty: string }[] = [
  { value: "all", label: "All", empty: "Nothing has happened here yet." },
  { value: "smart", label: "Smart Scheduling", empty: "Nothing from Smart Scheduling yet." },
  { value: "invites", label: "Invites", empty: "No invitations yet." },
  { value: "members", label: "Members", empty: "No member changes yet." },
  { value: "events", label: "Events", empty: "No events created or deleted yet." },
];

const DAY_MS = 86_400_000;

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Whole days between an entry and now: 0 today, 1 yesterday. Rounded, so a
 * day that daylight saving made 23 or 25 hours long still counts as one. A row
 * stamped a moment ahead of this clock counts as today.
 */
export function activityDaysAgo(createdAt: string, now: Date): number {
  return Math.max(0, Math.round((dayStart(now) - dayStart(new Date(createdAt))) / DAY_MS));
}

/** The heading a row files under. "This week" is the last seven days, as the Events filter means it. */
export function activityGroupLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return daysAgo < 7 ? "Earlier this week" : "Earlier";
}

// Built once. Hermes builds a fresh formatter inside every `toLocale…String`
// call, which made grouping 300 rows take 13ms against 0.2ms for these — and
// the screen regroups on every loading flag. They keep the device zone the app
// started in, so a trip across zones shows on the next launch.
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DATE = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const DATE_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * The stamp under a row: the clock time where the heading already names the
 * day ("9:14 AM"), the date where it doesn't ("Sun, Oct 11"), with the year
 * once it isn't this one.
 */
export function formatActivityStamp(createdAt: string, daysAgo: number, now: Date): string {
  const date = new Date(createdAt);

  if (daysAgo <= 1) return TIME.format(date);

  return (date.getFullYear() === now.getFullYear() ? DATE : DATE_YEAR).format(date);
}
