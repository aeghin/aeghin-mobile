import type { ViewStyle } from "react-native";

import { brand, withAlpha } from "@/constants/branding";

/**
 * The gradients the web app's dashboard is built from, as React Native styles.
 *
 * React Native 0.86 renders CSS gradients natively — `RCTLinearGradient` and
 * `RCTRadialGradient` on iOS Fabric — but NativeWind v4 has no `bg-gradient-*`
 * support, so these are style objects rather than classes.
 *
 * The prop is still `experimental_` prefixed upstream. Every caller also paints
 * a solid background class underneath, so a runtime that ignores the prop loses
 * the sheen and keeps a correct, opaque surface.
 *
 * Each gradient fades to its *own* colour at zero alpha rather than to
 * `transparent`: interpolating to transparent runs the midpoint through
 * transparent black, which shows up as a grey bloom on light backgrounds.
 */

/**
 * How much brand colour the dashboard surfaces carry. Every gradient below
 * reads from here, so the whole screen's warmth is one edit.
 *
 * `sheenStart` is the second lever on the hero: pushing it later confines the
 * tint to the corner instead of dimming it, which keeps the gradient's shape
 * while lightening how much of the card it covers.
 */
const INTENSITY = {
  /** Peak alpha of the hero's diagonal wash, at the bottom-right corner. */
  sheen: 0.045,
  /** Where the surface colour stops and the wash begins. */
  sheenStart: "68%",
  /** The stronger corner glow. */
  glowLead: 0.09,
  /** The quieter one on the opposite corner. */
  glowTrail: 0.055,
  /** The tile behind an organization's initials, which should stay legible. */
  avatarFrom: 0.28,
  avatarTo: 0.12,
} as const;

/** The web's `bg-linear-to-br from-card via-card to-primary/5`. */
export function brandSheen(surface: string): ViewStyle {
  return {
    experimental_backgroundImage: [
      {
        type: "linear-gradient",
        direction: "to bottom right",
        colorStops: [
          { color: surface, positions: ["0%"] },
          { color: surface, positions: [INTENSITY.sheenStart] },
          { color: withAlpha(brand.orange, INTENSITY.sheen), positions: ["100%"] },
        ],
      },
    ],
  };
}

/**
 * The web's `bg-primary/5 blur-3xl` corner blobs.
 *
 * A radial gradient rather than a blurred circle: it is what a blurred circle
 * resolves to visually, and it costs no filter pass.
 */
export function brandGlow(role: "lead" | "trail"): ViewStyle {
  const alpha = role === "lead" ? INTENSITY.glowLead : INTENSITY.glowTrail;

  return {
    experimental_backgroundImage: [
      {
        type: "radial-gradient",
        shape: "circle",
        size: "farthest-side",
        position: { top: "50%", left: "50%" },
        colorStops: [
          { color: withAlpha(brand.orange, alpha), positions: ["0%"] },
          { color: withAlpha(brand.orange, 0), positions: ["100%"] },
        ],
      },
    ],
  };
}

/** The tinted fill behind an organization's initials, when it has no logo. */
export function avatarSheen(): ViewStyle {
  return {
    experimental_backgroundImage: [
      {
        type: "linear-gradient",
        direction: "to bottom right",
        colorStops: [
          { color: withAlpha(brand.orange, INTENSITY.avatarFrom), positions: ["0%"] },
          { color: withAlpha(brand.orange, INTENSITY.avatarTo), positions: ["100%"] },
        ],
      },
    ],
  };
}
