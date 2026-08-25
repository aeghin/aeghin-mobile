import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { View } from "react-native";

/** One icon, named for each platform's own symbol set. */
export type AppSymbolName = {
  ios: SFSymbol;
  android: AndroidSymbol;
};

type AppSymbolProps = {
  name: AppSymbolName;
  size?: number;
  /** A resolved colour — `tintColor` is a native prop, not a style. */
  tint: string;
};

/**
 * The app's icon.
 *
 * SF Symbols stay the icon language rather than gluestack's bundled SVG set:
 * on iOS they carry the weight and optical alignment of the system chrome
 * they sit beside — the native tab bar, Clerk's account sheets — which a
 * generic icon set cannot match. `expo-symbols` draws Material symbols on
 * Android from the same call.
 */
export function AppSymbol({ name, size = 20, tint }: AppSymbolProps) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android, web: name.android }}
      size={size}
      tintColor={tint}
      // Keeps the icon column from collapsing where no symbol set is available.
      fallback={<View style={{ width: size, height: size }} />}
    />
  );
}
