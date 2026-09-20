import Check from "lucide-react-native/icons/check";
import Clock from "lucide-react-native/icons/clock";
import Hourglass from "lucide-react-native/icons/hourglass";
import X from "lucide-react-native/icons/x";

import type { AppIconName } from "@/components/app-icon";
import type { InvitationStatus } from "@/types/event";

/**
 * How an invitation's status looks, ported from the web's `lib/config/status.ts`.
 *
 * That file is eight Tailwind class strings per status; this is the one colour
 * they are all shades of, because a `View` tints through a style and lucide
 * through a prop.
 *
 * The hue is the **`-500` stop and does not move with the theme** — the web's
 * `dot`, `badgeBg`, `ring`, `border` and `bgSoft` carry no `dark:` variant, so
 * borrowing the palette's `success`/`warning`/`destructive` (which do shift, and
 * sit on the 600/400 stops) would put the phone a stop off the dashboard in both
 * schemes. Values converted from Tailwind v4's `oklch()` source, same as
 * `service-types.ts` — see the note there before touching a hex.
 *
 * The icon is the glyph the web draws in the corner badge on the avatar.
 */
export type StatusConfig = {
  label: string;
  /** `bg-<c>-500` — the corner badge, and the status word beside the name. */
  color: string;
  icon: AppIconName;
  /** `ring-<c>-500/70` on a live invitation, `/60` once it is settled. */
  ringAlpha: number;
};

/** `border-<c>-500/40` on the signed-in user's own row. */
export const ROW_BORDER_ALPHA = 0.4;

/** `bg-<c>-500/2` behind it — the border is what marks the row, not the fill. */
export const ROW_FILL_ALPHA = 0.02;

const EMERALD_500 = "#00BC7D";
const AMBER_500 = "#FE9A00";
const RED_500 = "#FB2C36";
const SLATE_500 = "#62748E";

export function getStatusConfig(status: InvitationStatus): StatusConfig {
  switch (status) {
    case "ACCEPTED":
      return {
        label: "Accepted",
        color: EMERALD_500,
        icon: Check,
        ringAlpha: 0.7,
      };
    case "PENDING":
      return {
        label: "Pending",
        color: AMBER_500,
        icon: Clock,
        ringAlpha: 0.7,
      };
    case "DECLINED":
      return { label: "Declined", color: RED_500, icon: X, ringAlpha: 0.6 };
    // Slate rather than red: a lapse is an absence of an answer, not a
    // refusal, and reading it as loudly as DECLINED misreports what happened.
    //
    // This case has to exist before the API can return the status. Without it
    // the `default` below caught EXPIRED and rendered it as a red "Canceled"
    // X — a lapsed invitation reported as one somebody withdrew, which is the
    // kind of wrong that gets acted on.
    case "EXPIRED":
      return { label: "Expired", color: SLATE_500, icon: Hourglass, ringAlpha: 0.6 };
    default:
      return { label: "Canceled", color: RED_500, icon: X, ringAlpha: 0.6 };
  }
}

/**
 * Statuses that dim rather than being dropped from the list.
 *
 * EXPIRED belongs here: the row is just as settled as a decline, and leaving
 * it out left a lapsed invitation looking as live as one still in flight.
 */
export const isInactiveStatus = (status: InvitationStatus): boolean =>
  status === "DECLINED" || status === "CANCELED" || status === "EXPIRED";
