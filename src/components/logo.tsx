import { Image } from "expo-image";
import { View } from "react-native";

// Relative rather than the "@/assets/*" alias: these are Metro asset requires,
// not TS imports, so they resolve through Metro instead of tsconfig paths.
const MARK = require("../../assets/images/logo-mark.png");
const TILE = require("../../assets/images/icon.png");

/**
 * How much of the mark's square canvas the chevrons actually cover.
 *
 * Measured from the asset's alpha bounding box: 41% wide by 44% tall, centred
 * in 512×512. The remainder is transparent padding baked into the PNG, and
 * `contentFit="contain"` honours it — so a `size` of 30 draws a glyph about
 * 13pt tall.
 */
const MARK_CONTENT_RATIO = 0.44;

type LogoProps = {
  /** Rendered width and height in points. The mark is square. */
  size?: number;
  /**
   * `mark` — brand orange chevrons on transparent, for sitting directly on a
   * page background. `tile` — the app icon: white chevrons on a rounded orange
   * square, for when the logo needs to hold its own against content.
   */
  variant?: "mark" | "tile";
  /**
   * Treat `size` as the size of the *chevrons* rather than of the canvas they
   * sit on, by scaling past the asset's padding and clipping back to `size`.
   *
   * Worth it wherever the mark sits beside text of its own height — untrimmed
   * it reads as roughly half the size it is asked for. Mark only; the tile
   * fills its canvas already.
   */
  trim?: boolean;
};

/**
 * The aeghin chevron mark. The default variant is transparent so it reads on
 * both the light and dark system backgrounds.
 */
export function Logo({ size = 48, variant = "mark", trim = false }: LogoProps) {
  const isTile = variant === "tile";
  const shouldTrim = trim && !isTile;
  const drawn = shouldTrim ? size / MARK_CONTENT_RATIO : size;

  const image = (
    <Image
      source={isTile ? TILE : MARK}
      // AuthView's `logo` slot requires the element to size itself, so these
      // are explicit rather than inherited from a parent.
      style={{
        width: drawn,
        height: drawn,
        // Approximates the iOS icon squircle, which is ~22% of the side.
        borderRadius: isTile ? size * 0.22 : 0,
      }}
      contentFit={isTile ? "cover" : "contain"}
      // When trimmed, the wrapper below carries the label instead, so the
      // oversized image inside it is not announced a second time.
      accessible={!shouldTrim}
      accessibilityRole={shouldTrim ? undefined : "image"}
      accessibilityLabel={shouldTrim ? undefined : "Aeghin"}
    />
  );

  if (!shouldTrim) {
    return image;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Aeghin"
    >
      {image}
    </View>
  );
}
