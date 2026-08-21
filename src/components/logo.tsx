import { Image } from "expo-image";

// Relative rather than the "@/assets/*" alias: these are Metro asset requires,
// not TS imports, so they resolve through Metro instead of tsconfig paths.
const MARK = require("../../assets/images/logo-mark.png");
const TILE = require("../../assets/images/icon.png");

type LogoProps = {
  /** Rendered width and height in points. The mark is square. */
  size?: number;
  /**
   * `mark` — brand orange chevrons on transparent, for sitting directly on a
   * page background. `tile` — the app icon: white chevrons on a rounded orange
   * square, for when the logo needs to hold its own against content.
   */
  variant?: "mark" | "tile";
};

/**
 * The aeghin chevron mark. The default variant is transparent so it reads on
 * both the light and dark system backgrounds.
 */
export function Logo({ size = 48, variant = "mark" }: LogoProps) {
  const isTile = variant === "tile";

  return (
    <Image
      source={isTile ? TILE : MARK}
      // AuthView's `logo` slot requires the element to size itself, so these
      // are explicit rather than inherited from a parent.
      style={{
        width: size,
        height: size,
        // Approximates the iOS icon squircle, which is ~22% of the side.
        borderRadius: isTile ? size * 0.22 : 0,
      }}
      contentFit={isTile ? "cover" : "contain"}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Aeghin"
    />
  );
}
