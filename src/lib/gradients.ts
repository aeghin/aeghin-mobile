import type { ViewStyle } from "react-native";

import { blendOver, brand, withAlpha } from "@/constants/branding";

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
 * Two rules about alpha, both learned the hard way:
 *
 * - A gradient that fades *out* fades to its **own** colour at zero alpha
 *   rather than to `transparent`. Interpolating to transparent runs the
 *   midpoint through transparent black, a grey bloom on light backgrounds.
 * - A gradient that fades *in*, from an opaque stop to a translucent one, is
 *   rendered several times stronger than the alpha it was given — a 5% wash
 *   measured ~25% on device. {@link tintedSheen} therefore ends on an opaque
 *   `blendOver` of the tint and the surface, so no alpha is interpolated at
 *   all. The radial helpers below are unaffected and were always exact.
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

/**
 * The web's `bg-linear-to-br from-card via-card to-<color>/5`.
 *
 * Any hue, because the event screens wash a card in its *service type's*
 * colour rather than the brand's — the dashboard's own hero does the same.
 */
export function tintedSheen(
  surface: string,
  color: string,
  /** Peak alpha at the far corner. Defaults to the brand surfaces' own. */
  alpha: number = INTENSITY.sheen,
): ViewStyle {
  return {
    experimental_backgroundImage: [
      {
        type: "linear-gradient",
        direction: "to bottom right",
        colorStops: [
          { color: surface, positions: ["0%"] },
          { color: surface, positions: [INTENSITY.sheenStart] },
          // Opaque, not `withAlpha`: see `blendOver`. Interpolating toward a
          // translucent stop lands ~5x stronger than the alpha asked for.
          { color: blendOver(surface, color, alpha), positions: ["100%"] },
        ],
      },
    ],
  };
}

/** {@link tintedSheen} in the brand's own orange. */
export function brandSheen(surface: string): ViewStyle {
  return tintedSheen(surface, brand.orange);
}

/**
 * The web's `bg-primary/5 blur-3xl` corner blobs.
 *
 * A radial gradient rather than a blurred circle: it is what a blurred circle
 * resolves to visually, and it costs no filter pass.
 */
export function tintedGlow(
  color: string,
  role: "lead" | "trail",
  /** Peak alpha at the centre. Defaults to the brand surfaces' own. */
  override?: number,
): ViewStyle {
  const alpha =
    override ?? (role === "lead" ? INTENSITY.glowLead : INTENSITY.glowTrail);

  return {
    experimental_backgroundImage: [
      {
        type: "radial-gradient",
        shape: "circle",
        size: "farthest-side",
        position: { top: "50%", left: "50%" },
        colorStops: [
          { color: withAlpha(color, alpha), positions: ["0%"] },
          { color: withAlpha(color, 0), positions: ["100%"] },
        ],
      },
    ],
  };
}

/** {@link tintedGlow} in the brand's own orange. */
export function brandGlow(role: "lead" | "trail"): ViewStyle {
  return tintedGlow(brand.orange, role);
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

/**
 * A tint that fades out downward — the web's masked card headers.
 *
 * The dashboard paints its wash over the whole card and then clips it with
 * `maskImage: linear-gradient(to bottom, black 0%, black 35%, transparent 75%)`.
 * React Native has no `maskImage`, so the mask's own stops are applied to the
 * tint's alpha instead: full through 35%, gone by 75%. Same result, one layer.
 */
export function tintedTopWash(
  color: string,
  alpha: number,
  stops: readonly [string, string, string],
): ViewStyle {
  return {
    experimental_backgroundImage: [
      {
        type: "linear-gradient",
        direction: "to bottom",
        colorStops: [
          { color: withAlpha(color, alpha), positions: [stops[0]] },
          { color: withAlpha(color, alpha), positions: [stops[1]] },
          { color: withAlpha(color, 0), positions: [stops[2]] },
        ],
      },
    ],
  };
}
