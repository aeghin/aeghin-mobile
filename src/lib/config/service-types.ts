import { withAlpha, type Palette } from "@/constants/branding";
import type { ServiceTypeColor } from "@/types/event";

/**
 * The eight service-type swatches, matched to the web dashboard exactly.
 *
 * The web keeps this palette as class strings in `lib/config/service-types-config.ts`
 * (`bg-indigo-500`, `text-indigo-600 dark:text-indigo-400`). Class strings can't
 * come back here: a service's colour is chosen at runtime by whoever created the
 * service type, and NativeWind can only ship classes it saw at build time.
 * Resolved values let one lookup drive a `View` background, a lucide `color` prop
 * and a border alike.
 *
 * **These are Tailwind v4 values, and v4 is not v3.** The dashboard runs
 * Tailwind 4, whose palette is authored in `oklch()` and resolves to noticeably
 * different sRGB than the v3 hexes most references still list — emerald-500 is
 * `#00BC7D` here and `#10B981` there, indigo-500 `#615FFF` and not `#6366F1`.
 * Every stop below was converted from `node_modules/tailwindcss/theme.css` in
 * the web repo, which is the actual source the browser paints from. If these
 * ever look wrong, re-convert from that file rather than reaching for a
 * remembered hex.
 */
const SWATCHES: Record<
  ServiceTypeColor,
  { s400: string; s500: string; s600: string }
> = {
  indigo: { s400: "#7C86FF", s500: "#615FFF", s600: "#4F39F6" },
  amber: { s400: "#FFB900", s500: "#FE9A00", s600: "#E17100" },
  emerald: { s400: "#00D492", s500: "#00BC7D", s600: "#009966" },
  pink: { s400: "#FB64B6", s500: "#F6339A", s600: "#E60076" },
  violet: { s400: "#A684FF", s500: "#8E51FF", s600: "#7F22FE" },
  red: { s400: "#FF6467", s500: "#FB2C36", s600: "#E7000B" },
  blue: { s400: "#51A2FF", s500: "#2B7FFF", s600: "#155DFC" },
  cyan: { s400: "#00D3F2", s500: "#00B8DB", s600: "#0092B8" },
};

/**
 * The alphas the web composes over each swatch, as fractions of its `-500`.
 *
 * One per Tailwind utility in `colorClasses`, named after it, so a change on
 * either side is a one-line comparison.
 */
const ALPHA = {
  /** `bg-<c>-500/10` — the badge naming the service. */
  badge: 0.1,
  /** `border-<c>-500/50` — the edge on a selected filter chip. */
  borderSoft: 0.5,
  /** `to-<c>-500/5` — the diagonal wash across a hero. */
  gradientTo: 0.05,
  /** `bg-<c>-500/5 blur-3xl` — the quieter corner bloom. */
  blurSoft: 0.05,
  /** `bg-<c>-500/10 blur-3xl` — the stronger one. */
  blurStrong: 0.1,
  /** `shadow-<c>-500/10` — the drop shadow under the hero's date tile. */
  shadow: 0.1,
} as const;

/**
 * The web masks the team card's wash with
 * `linear-gradient(to bottom, black 0%, black 35%, transparent 75%)`.
 *
 * React Native has no `maskImage`, so the same three stops are applied to the
 * tint's own alpha instead — which is what the mask resolves to visually, and
 * needs no extra layer to composite.
 */
export const WASH_STOPS = ["0%", "35%", "75%"] as const;

export type ServiceColors = {
  /**
   * Full strength: the dot on a filter chip and the rail down a card's edge.
   *
   * The same value in both schemes. The web's `dot`, `border`, `solid` and
   * `ring` carry no `dark:` variant, so the hue must not shift with the theme
   * — only {@link ServiceColors.text} does.
   */
  base: string;
  /** The label on top of {@link ServiceColors.surface}. */
  text: string;
  /** A tinted fill, for the badge naming the service. */
  surface: string;
  /** A hairline of the same hue, so a tinted badge still has an edge. */
  hairline: string;
  /** The wash across a hero card, to be laid over the card's own colour. */
  sheenAlpha: number;
  /** Peak alpha of the quieter corner bloom. */
  glowSoftAlpha: number;
  /** Peak alpha of the stronger corner bloom. */
  glowStrongAlpha: number;
  /** Peak alpha of a drop shadow cast in the service's own hue. */
  shadowAlpha: number;
};

/**
 * Presentation for one service type's colour.
 *
 * Falls back to indigo, matching the web — a colour the seed data doesn't use
 * would otherwise render an invisible badge rather than an obviously wrong one.
 */
export function getServiceColors(
  color: string,
  theme: Palette,
): ServiceColors {
  const swatch = SWATCHES[color as ServiceTypeColor] ?? SWATCHES.indigo;
  const dark = theme.scheme === "dark";
  const base = swatch.s500;

  return {
    base,
    // `text-<c>-600 dark:text-<c>-400`, with amber the single exception the web
    // makes — `dark:text-amber-500`, because amber-400 goes yellow enough on a
    // dark card to read as a warning rather than as a service.
    text: dark ? (color === "amber" ? swatch.s500 : swatch.s400) : swatch.s600,
    surface: withAlpha(base, ALPHA.badge),
    hairline: withAlpha(base, ALPHA.borderSoft),
    sheenAlpha: ALPHA.gradientTo,
    glowSoftAlpha: ALPHA.blurSoft,
    glowStrongAlpha: ALPHA.blurStrong,
    shadowAlpha: ALPHA.shadow,
  };
}
