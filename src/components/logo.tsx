import { Image } from "expo-image";

// Relative rather than the "@/assets/*" alias: this is a Metro asset require,
// not a TS import, so it resolves through Metro instead of tsconfig paths.
const MARK = require("../../assets/images/logo-mark.png");

type LogoProps = {
  /** Rendered width and height in points. The mark is square. */
  size?: number;
};

/**
 * The aeghin chevron mark, in brand orange on a transparent background so it
 * reads on both the light and dark system backgrounds.
 */
export function Logo({ size = 48 }: LogoProps) {
  return (
    <Image
      source={MARK}
      // AuthView's `logo` slot requires the element to size itself, so these
      // are explicit rather than inherited from a parent.
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Aeghin"
    />
  );
}
