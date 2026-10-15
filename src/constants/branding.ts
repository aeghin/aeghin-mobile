export const brand = {
  orange: "#F77F00",
  orangePressed: "#D96E00",
} as const;

/**
 * The Aeghin design system's colours (the "Aeghin Design system" artifact's
 * tokens.json, shared with the web's `app/globals.css`): neutral cool greys,
 * a neutral near-black dark mode, and brand orange as the only saturated
 * colour. The keys are the app's own names for them.
 */
export type Palette = {
  /** Which half of the palette this is. Config helpers branch on it. */
  scheme: "light" | "dark";
  background: string;
  /** Quiet fills: fields, chips, tracks, tiles inside a card. The system's `secondary`. */
  surface: string;
  /** Banners, tab lists, empty states. The system's `muted`. */
  muted: string;
  /** Menus and popovers, a step above `card` in dark. */
  popover: string;
  border: string;
  /** Form control borders, a step stronger than `border`. */
  input: string;
  /** Focus. Neutral grey, so focus never competes with the orange. */
  ring: string;
  text: string;
  textMuted: string;
  /** Owner accent. Mirrors the web app's `--gold` token, which also shifts by scheme. */
  gold: string;
  /** Admin accent. The web config uses Tailwind blue-500/600 here. */
  admin: string;
  /** Accept, "fully staffed", "up next" — the system's emerald-700/400. */
  success: string;
  /** Expiring invitations and other "act soon" states. Tailwind amber-600/400. */
  warning: string;
  /** Leave, delete, and the like. The system's red-600 / red-400. */
  destructive: string;
  /** Minor keys in the song library. The web's violet-700/400. */
  violet: string;
  /** "Waiting on your answer" in the bell. The web's sky-600/400. */
  sky: string;
  /** iOS systemGroupedBackground: the page *behind* inset cards. */
  groupedBackground: string;
  /** A card sitting on `groupedBackground`. Deliberately lighter than `surface`. */
  card: string;
};

export const palette: Record<"light" | "dark", Palette> = {
  light: {
    scheme: "light",
    background: "#FFFFFF",
    surface: "#EEEEF0",
    muted: "#F7F7F8",
    popover: "#FFFFFF",
    border: "#E3E3E7",
    input: "#D9D9DE",
    ring: "#747686",
    text: "#131316",
    textMuted: "#5E5F6E",
    gold: "#C4A03E",
    admin: "#2563EB",
    success: "#007A55",
    warning: "#D97706",
    destructive: "#E7000B",
    violet: "#6D28D9",
    sky: "#0284C7",
    groupedBackground: "#F7F7F8",
    card: "#FFFFFF",
  },
  // Neutral near-black, never navy: each surface a grey step above the last.
  dark: {
    scheme: "dark",
    background: "#131316",
    surface: "#2F3037",
    muted: "#212126",
    popover: "#27272D",
    border: "#2F3037",
    input: "#42434D",
    ring: "#9394A1",
    text: "#F7F7F8",
    textMuted: "#9394A1",
    gold: "#D8B353",
    admin: "#5B8DEF",
    success: "#00D492",
    warning: "#FBBF24",
    destructive: "#FF6467",
    violet: "#A78BFA",
    sky: "#38BDF8",
    groupedBackground: "#131316",
    card: "#212126",
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

/**
 * What the setlist's media links are tinted.
 *
 * These are the colours the dashboard gives the same marks on `hover:` — a
 * phone has no hover, so the hover state is the resting state here. Tinting
 * them is what lets the glyphs drop their grey button chrome and still read as
 * separate, recognisable targets in a row that carries several.
 */
export const mediaTint = {
  /** Tailwind green-500, the web's `hover:text-green-500`. */
  spotify: "#22C55E",
  /** Tailwind red-500, the web's `hover:text-red-500`. */
  youtube: "#EF4444",
  /** Tailwind sky-500, the web's `hover:text-sky-500` for backing tracks. */
  audio: "#0EA5E9",
} as const;
