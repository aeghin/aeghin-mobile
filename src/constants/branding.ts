export const brand = {
  orange: "#F77F00",
  orangePressed: "#D96E00",
} as const;

export type Palette = {
  /** Which half of the palette this is. Config helpers branch on it. */
  scheme: "light" | "dark";
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  /** Owner accent. Mirrors the web app's `--gold` token, which also shifts by scheme. */
  gold: string;
  /** Admin accent. The web config uses Tailwind blue-500/600 here. */
  admin: string;
  /** Accept, "fully staffed", "up next" — the web's emerald-600/400. */
  success: string;
  /** Expiring invitations and other "act soon" states. Tailwind amber-600/400. */
  warning: string;
  /** Leave, delete, and the like. iOS system red, which reads on both schemes. */
  destructive: string;
  /** Minor keys in the song library. The web's violet-700/400. */
  violet: string;
  /** iOS systemGroupedBackground: the page *behind* inset cards. */
  groupedBackground: string;
  /** A card sitting on `groupedBackground`. Deliberately lighter than `surface`. */
  card: string;
};

export const palette: Record<"light" | "dark", Palette> = {
  light: {
    scheme: "light",
    background: "#FFFFFF",
    surface: "#F6F6F7",
    border: "#E4E4E7",
    text: "#111113",
    textMuted: "#6B6B75",
    gold: "#C4A03E",
    admin: "#2563EB",
    success: "#059669",
    warning: "#D97706",
    destructive: "#FF3B30",
    violet: "#6D28D9",
    groupedBackground: "#F2F2F7",
    card: "#FFFFFF",
  },
  dark: {
    scheme: "dark",
    background: "#0E0E10",
    surface: "#1A1A1D",
    border: "#2A2A2F",
    text: "#F5F5F6",
    textMuted: "#9A9AA3",
    gold: "#D8B353",
    admin: "#5B8DEF",
    success: "#34D399",
    warning: "#FBBF24",
    destructive: "#FF453A",
    violet: "#A78BFA",
    groupedBackground: "#0E0E10",
    card: "#1C1C1E",
  },
};

/**
 * "#F77F00" -> "247 127 0".
 *
 * Tailwind's `<alpha-value>` colors need the channels unwrapped so a utility
 * like `bg-primary/20` can compose its own alpha. Every token below is fed
 * through this, which is what keeps the className tokens and the raw hex values
 * taken as props (lucide's `color`, RefreshControl, NativeTabs) from drifting.
 */
export function toRgbChannels(hex: string): string {
  const value = parseInt(hex.replace("#", ""), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** "#F77F00", 0.12 -> "rgba(247, 127, 0, 0.12)". */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = toRgbChannels(hex).split(" ");
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The opaque colour that `overlay` at `alpha` shows as when it sits on `base`.
 *
 * Gradients need this. React Native interpolates a stop's *alpha* along the
 * ramp, and a stop declared `rgba(…, 0.05)` lands far stronger than 5% — the
 * hero's 5% wash measured ~25% on device. Blending to an opaque colour up front
 * takes alpha out of the interpolation entirely, and is what the web's own
 * `from-card via-card to-<c>-500/5` resolves to anyway: a translucent tint over
 * an opaque card.
 */
export function blendOver(base: string, overlay: string, alpha: number): string {
  const channels = (hex: string) =>
    toRgbChannels(hex).split(" ").map(Number) as [number, number, number];

  const [br, bg, bb] = channels(base);
  const [or, og, ob] = channels(overlay);

  const mix = (from: number, to: number) =>
    Math.round(from + (to - from) * alpha)
      .toString(16)
      .padStart(2, "0");

  return `#${mix(br, or)}${mix(bg, og)}${mix(bb, ob)}`.toUpperCase();
}
