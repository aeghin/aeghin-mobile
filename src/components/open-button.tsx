import type { ReactNode } from "react";
import { Linking } from "react-native";

import { Pressable } from "@/components/ui/pressable";

/**
 * Hands a URL to the system.
 *
 * Nothing is rendered in-app: a Spotify link belongs to Spotify, and a PDF
 * chart to whatever the player already reads charts in.
 *
 * Shared by the song library, the event's setlist card and the setlist editor
 * — the same square target beside the same kinds of link in all three, so a
 * player reaches for a chart in the same place wherever they are standing.
 */

/** The square each of these occupies. Small, because a row can carry several. */
export const OPEN_BUTTON_TAP = 28;

/**
 * 28 is under the 44 Apple asks for, and these sit inside rows that are
 * themselves pressable — so a near-miss did not just fail, it fired the row's
 * action instead. Slop is vertical only: the buttons sit flush against each
 * other, so widening them sideways would overlap a neighbour and make which
 * one you hit ambiguous. Up and down is the free direction, and the direction
 * a thumb actually misses in.
 */
const SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

type OpenButtonProps = {
  url: string;
  label: string;
  children: ReactNode;
};

export function OpenButton({ url, label, children }: OpenButtonProps) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={SLOP}
      className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
      style={{ width: OPEN_BUTTON_TAP, height: OPEN_BUTTON_TAP }}
    >
      {children}
    </Pressable>
  );
}
