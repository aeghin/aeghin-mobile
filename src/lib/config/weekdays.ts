/**
 * Weekday names, indexed the way `Date.getDay()` and the template's
 * `dayOfWeek` column both are: 0 is Sunday.
 *
 * Mirrors `lib/config/weekdays.ts` in the web app, with a short form the
 * phone needs — seven full names do not fit across a row of chips.
 */
export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The weekday `offset` days after `dayOfWeek`, wrapping around the week. */
export const weekdayAfter = (dayOfWeek: number, offset: number) =>
  WEEKDAY_LABELS[(dayOfWeek + offset) % 7];
