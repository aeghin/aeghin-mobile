import { useColorScheme } from "react-native";

import { palette, type Palette } from "@/constants/branding";

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return palette[scheme === "dark" ? "dark" : "light"];
}
