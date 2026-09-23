import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { HStack } from "@/components/ui/hstack";

/** A nav bar item's height, so a drawn capsule matches the native ones. */
const HEIGHT = 44;

/**
 * A header control's glass, drawn by hand. The bar's own glass is one capsule
 * per item and UIKit fixes the gap between items, so controls that should sit
 * close together share one item with `hidesSharedBackground` and draw this.
 * Before iOS 26 the bar has no glass, and neither does this.
 */
export function HeaderCapsule({ children }: { children: ReactNode }) {
  return (
    <HStack style={{ height: HEIGHT, minWidth: HEIGHT }} className="items-center justify-center">
      {isLiquidGlassAvailable() ? (
        <GlassView
          glassEffectStyle="regular"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: HEIGHT / 2 }]}
        />
      ) : null}
      {children}
    </HStack>
  );
}
