/**
 * The organization's clock, which event times are written in.
 *
 * Event times are floating wall clock pinned to Z: `10:00Z` means 10am wherever
 * the church is. That is right for showing a time and wrong for asking whether
 * it has passed — for a church in Chicago, `10:00Z` reads five hours before the
 * service starts. So "is this over yet" compares event times against
 * {@link floatingNow}, the church's own clock read the same way.
 *
 * The same arithmetic as the dashboard's `lib/time-zone.ts`, so the phone and
 * the web end an event at the same moment.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Built once per zone. Throws on a zone this runtime can't resolve. */
const formatterFor = (timeZone: string) => {
  let format = formatters.get(timeZone);

  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, format);
  }

  return format;
};

const isTimeZone = (value: string | null | undefined): value is string => {
  if (!value) return false;

  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
};

/** The phone's own zone, or UTC when the runtime can't say. */
export const deviceTimeZone = (): string => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isTimeZone(zone) ? zone : "UTC";
};

/**
 * The organization's zone when it resolves. A server from before zones sends
 * none, and the phone's own is the best guess at where the church is.
 */
export const zoneOrDevice = (timeZone: string | null | undefined): string =>
  isTimeZone(timeZone) ? timeZone : deviceTimeZone();

/** How far `timeZone` runs ahead of UTC at `instant`, in ms. */
const offsetAt = (instant: number, timeZone: string) => {
  const parts: Record<string, number> = {};

  for (const { type, value } of formatterFor(timeZone).formatToParts(instant)) {
    parts[type] = Number(value);
  }

  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    // An engine that ignores `hourCycle` writes midnight as 24.
    parts.hour % 24,
    parts.minute,
    parts.second,
  );

  return wall - Math.floor(instant / 1000) * 1000;
};

/**
 * The real instant a floating wall-clock time names in `timeZone`. Two passes,
 * so a time on either side of a daylight-saving change gets its own offset.
 */
export function inZone(floating: Date, timeZone: string): Date {
  const wall = floating.getTime();
  const guess = wall - offsetAt(wall, timeZone);

  return new Date(wall - offsetAt(guess, timeZone));
}

/**
 * What the church's clock reads at `instant`, as a floating time — the thing a
 * stored event time is compared against.
 */
export const floatingNow = (timeZone: string, instant: number = Date.now()): Date =>
  new Date(instant + offsetAt(instant, timeZone));
