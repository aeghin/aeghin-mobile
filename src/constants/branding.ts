/**
 * Brand tokens, taken from assets/images/aeghin-icon.svg — the orange there is
 * the source of truth, so keep this in sync if the mark ever changes.
 */
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
};

// Explicitly typed rather than `as const`: the two schemes have to stay
// assignable to one another so a `Palette` can be passed around.
export const palette: Record<"light" | "dark", Palette> = {
  light: {
    background: "#FFFFFF",
    surface: "#F6F6F7",
    border: "#E4E4E7",
    text: "#111113",
    textMuted: "#6B6B75",
  },
  dark: {
    background: "#0E0E10",
    surface: "#1A1A1D",
    border: "#2A2A2F",
    text: "#F5F5F6",
    textMuted: "#9A9AA3",
  },
};
