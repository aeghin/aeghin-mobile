export const brand = {
  orange: "#F77F00",
  orangePressed: "#D96E00",
} as const;

export type Palette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  /** Owner accent. Mirrors the web app's `--gold` token, which also shifts by scheme. */
  gold: string;
  /** Admin accent. The web config uses Tailwind blue-500/600 here. */
  admin: string;
  /** Leave, delete, and the like. iOS system red, which reads on both schemes. */
  destructive: string;
  /** iOS systemGroupedBackground: the page *behind* inset cards. */
  groupedBackground: string;
  /** A card sitting on `groupedBackground`. Deliberately lighter than `surface`. */
  card: string;
};

export const palette: Record<"light" | "dark", Palette> = {
  light: {
    background: "#FFFFFF",
    surface: "#F6F6F7",
    border: "#E4E4E7",
    text: "#111113",
    textMuted: "#6B6B75",
    gold: "#C4A03E",
    admin: "#2563EB",
    destructive: "#FF3B30",
    groupedBackground: "#F2F2F7",
    card: "#FFFFFF",
  },
  dark: {
    background: "#0E0E10",
    surface: "#1A1A1D",
    border: "#2A2A2F",
    text: "#F5F5F6",
    textMuted: "#9A9AA3",
    gold: "#D8B353",
    admin: "#5B8DEF",
    destructive: "#FF453A",
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
 * used by native props (SymbolView, RefreshControl, NativeTabs) from drifting.
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
