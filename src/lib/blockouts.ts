import { addDays, dayKey, daysInRange, keyToDate } from "@/lib/events/format";

/**
 * The Blockouts screen's calendar: the dashboard's `lib/blockout-calendar.ts`.
 * Every day is a floating calendar day — a blockout at its UTC midnight, an
 * event in its church's wall clock pinned to Z — so all of it reads UTC.
 */

/** Every day a blockout covers, its last day included. */
export const blockoutDays = (startDate: string, endDate: string): string[] =>
  daysInRange(dayKey(startDate), dayKey(endDate));

/**
 * The days one block of an event is on. A block ending exactly at midnight
 * ends on the day before, so a 7–midnight service doesn't spill into the next.
 */
export function eventBlockDays(startTime: string, endTime: string): string[] {
  const start = new Date(startTime).getTime();
  const end = Math.max(start, new Date(endTime).getTime() - 1);
  return daysInRange(dayKey(new Date(start)), dayKey(new Date(end)));
}

/**
 * A month laid out Sunday first, in whole weeks: blanks before the 1st and
 * after the last day, then a day key per day — rows of seven straight through.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const lead = keyToDate(first).getUTCDay();
  const days: (string | null)[] = Array.from({ length: lead }, () => null);

  for (let day = first; day.startsWith(month); day = addDays(day, 1)) days.push(day);
  while (days.length % 7 !== 0) days.push(null);

  return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}
