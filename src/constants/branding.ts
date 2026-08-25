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
    groupedBackground: "#0E0E10",
    card: "#1C1C1E",
  },
};
