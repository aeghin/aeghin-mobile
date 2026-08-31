import { withAlpha, type Palette } from "@/constants/branding";
import type { ServiceTypeColor } from "@/types/event";

/**
 * The eight service-type swatches, as Tailwind's own 400/500/600 stops.
 *
 * The web keeps this palette as class strings (`bg-indigo-500`,
 * `text-indigo-600 dark:text-indigo-400`). Class strings can't come back here:
 * a service's colour is chosen at runtime by whoever created the service type,
 * and NativeWind can only ship classes it saw at build time. Resolved values
 * let one lookup drive a `View` background, a `SymbolView` tint and a border
 * alike.
 */
const SWATCHES: Record<
  ServiceTypeColor,
  { light: string; dark: string; text: { light: string; dark: string } }
> = {
  indigo: { light: "#6366F1", dark: "#818CF8", text: { light: "#4F46E5", dark: "#A5B4FC" } },
  amber: { light: "#F59E0B", dark: "#FBBF24", text: { light: "#D97706", dark: "#FCD34D" } },
  emerald: { light: "#10B981", dark: "#34D399", text: { light: "#059669", dark: "#6EE7B7" } },
  pink: { light: "#EC4899", dark: "#F472B6", text: { light: "#DB2777", dark: "#F9A8D4" } },
  violet: { light: "#8B5CF6", dark: "#A78BFA", text: { light: "#7C3AED", dark: "#C4B5FD" } },
  red: { light: "#EF4444", dark: "#F87171", text: { light: "#DC2626", dark: "#FCA5A5" } },
  blue: { light: "#3B82F6", dark: "#60A5FA", text: { light: "#2563EB", dark: "#93C5FD" } },
  cyan: { light: "#06B6D4", dark: "#22D3EE", text: { light: "#0891B2", dark: "#67E8F9" } },
};

export type ServiceColors = {
  /** Full strength: the dot on a filter chip and the rail down a card's edge. */
  base: string;
  /** The label on top of {@link ServiceColors.surface}. */
  text: string;
  /** A tinted fill, for the badge naming the service. */
  surface: string;
  /** A hairline of the same hue, so a tinted badge still has an edge. */
  hairline: string;
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
  const base = dark ? swatch.dark : swatch.light;

  return {
    base,
    text: dark ? swatch.text.dark : swatch.text.light,
    // Dark surfaces need a little more tint to separate from the card at all.
    surface: withAlpha(base, dark ? 0.18 : 0.12),
    hairline: withAlpha(base, dark ? 0.32 : 0.24),
  };
}
