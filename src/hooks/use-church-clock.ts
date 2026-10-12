import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useCurrentOrganization } from "@/components/organization-provider";
import { dayKey } from "@/lib/events/format";
import { nextChange } from "@/lib/events/schedule";
import { floatingNow, zoneOrDevice } from "@/lib/time-zone";
import type { EventDate } from "@/types/event";

export type ChurchClock = {
  /** When the clock was read, as a real instant — what deadlines compare with. */
  instant: number;
  /** The organization's wall clock at that instant, floating like event times. */
  now: Date;
  /** The organization's calendar day, as a day key. */
  today: string;
};

/**
 * The organization's clock, for a screen showing what is still to come.
 *
 * Read again at the next moment the screen would change — a block ending, a
 * deadline passing, the church's midnight — and whenever the app comes back to
 * the front, since a phone asleep in a pocket keeps no timers. Nothing is
 * fetched; the screen just works its lists out again against the new time.
 */
export function useChurchClock(
  dates: readonly EventDate[],
  deadlines: readonly string[] = [],
): ChurchClock {
  const { organization } = useCurrentOrganization();
  const zone = zoneOrDevice(organization?.timeZone);
  const [instant, setInstant] = useState(() => Date.now());

  const now = floatingNow(zone, instant);
  const today = dayKey(now);
  const due = nextChange(dates, deadlines, zone, now, instant);

  useEffect(() => {
    const timer = setTimeout(() => setInstant(Date.now()), Math.max(0, due - Date.now()));
    return () => clearTimeout(timer);
  }, [due]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setInstant(Date.now());
    });
    return () => subscription.remove();
  }, []);

  return { instant, now, today };
}
