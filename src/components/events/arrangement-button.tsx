import Layers from "lucide-react-native/icons/layers";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable as RNPressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { OPEN_BUTTON_TAP } from "@/components/open-button";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * `OpenButton`'s slop: up and down only, so the buttons flush beside it never
 * leave a tap ambiguous.
 */
const SLOP = { top: 8, bottom: 8, left: 0, right: 0 };
/** About 28 characters of the name a line. */
const BUBBLE_MAX_WIDTH = 240;
/** The arrow's square, before it is turned on its point. */
const ARROW = 10;
/** Between the glyph and the bubble: room for the arrow's point. */
const GAP = 9;
/** How close to a screen edge the bubble may land. */
const EDGE = 12;
const RADIUS = 12;

/** Where the glyph sits in the window, once it has been measured. */
type Anchor = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * The arrangement a setlist row plays: one more orange glyph after the row's
 * links and files, on the line where everything is already something to
 * press. A name can run to 60 characters, so a tap shows it in a bubble
 * pointing at the glyph. Screen readers get it from the label without the tap.
 */
export function ArrangementButton({ name }: { name: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const glyphRef = useRef<View>(null);

  // Kept through the closing fade, as `ActionMenu` keeps its anchor, so the
  // bubble fades out where it was instead of jumping to the corner.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  // The bubble's size, from its first layout. Where it goes depends on it, so
  // the bubble stays invisible until it is known.
  const [bubble, setBubble] = useState<Size | null>(null);
  const [scale] = useState(() => new Animated.Value(0.92));

  const measured = bubble !== null;

  useEffect(() => {
    if (!open || !measured) return;

    scale.setValue(0.92);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 320,
      mass: 0.7,
    }).start();
  }, [open, measured, scale]);

  // Below the glyph, or above it when the bubble would run into the tab bar,
  // which the bottom inset includes on a tab's screen. Above pins the
  // bubble's bottom edge to the glyph.
  const below = anchor ? anchor.y + anchor.height + GAP : 0;
  const flipped =
    anchor !== null &&
    bubble !== null &&
    below + bubble.height > height - insets.bottom - EDGE;
  const vertical = anchor
    ? flipped
      ? { bottom: height - anchor.y + GAP }
      : { top: below }
    : { top: 0 };

  // Centred on the glyph where the screen allows, else held off the edge,
  // with the arrow sliding along it to keep pointing at the glyph. The glyph
  // usually sits near the left, after a link or two.
  const center = anchor ? anchor.x + anchor.width / 2 : 0;
  const bubbleLeft = bubble
    ? clamp(center - bubble.width / 2, EDGE, width - EDGE - bubble.width)
    : EDGE;
  const arrowLeft = bubble
    ? clamp(
        center - ARROW / 2,
        bubbleLeft + RADIUS,
        bubbleLeft + bubble.width - RADIUS - ARROW,
      )
    : 0;

  return (
    <>
      <Pressable
        onPress={() =>
          glyphRef.current?.measureInWindow((x, y, w, h) => {
            setAnchor({ x, y, width: w, height: h });
            setOpen(true);
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Arrangement, ${name}`}
        accessibilityState={{ expanded: open }}
        hitSlop={SLOP}
        className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
        style={{ width: OPEN_BUTTON_TAP, height: OPEN_BUTTON_TAP }}
      >
        {/* Measured instead of the square around it, so the arrow points at
            the glyph itself. */}
        <View ref={glyphRef} collapsable={false}>
          <AppIcon icon={Layers} size={17} color={brand.orange} />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* No scrim: the bubble only tells you something, so the setlist
            stays as it was and a tap anywhere puts it away. */}
        <RNPressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        {/* Taps fall through to the backdrop, the bubble's own included. It
            grows out of the arrow's point. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            ...vertical,
            left: 0,
            right: 0,
            alignItems: "flex-start",
            transformOrigin: [center, flipped && bubble ? bubble.height : 0, 0],
            opacity: scale.interpolate({
              inputRange: [0.92, 1],
              outputRange: [0, 1],
            }),
            transform: [{ scale }],
          }}
        >
          {/* Shifted by its margin, which never narrows the name: there is
              always more room to the right of it than the bubble needs. */}
          <View
            onLayout={({ nativeEvent: { layout } }) =>
              setBubble((size) =>
                size?.width === layout.width && size.height === layout.height
                  ? size
                  : { width: layout.width, height: layout.height },
              )
            }
            style={{
              marginLeft: bubbleLeft,
              maxWidth: BUBBLE_MAX_WIDTH,
              paddingHorizontal: 13,
              paddingTop: 10,
              paddingBottom: 11,
              borderRadius: RADIUS,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.popover,
              boxShadow: "0px 10px 24px rgba(0, 0, 0, 0.18)",
            }}
          >
            <HStack className="items-center gap-1.5">
              <AppIcon icon={Layers} size={12} color={brand.orange} />
              <Text className="text-[11.5px] font-semibold text-muted-foreground">
                Arrangement
              </Text>
            </HStack>
            <Text className="mt-1 text-[14px] font-semibold leading-[18px] text-foreground">
              {name}
            </Text>
          </View>

          {/* The arrow: a square turned on its point, as `Tip` draws its own,
              centred on the inside of the bubble's 1pt border so it hides the
              border where they meet. */}
          <Box
            style={{
              position: "absolute",
              left: arrowLeft,
              width: ARROW,
              height: ARROW,
              borderColor: theme.border,
              backgroundColor: theme.popover,
              transform: [{ rotate: "45deg" }],
              ...(flipped
                ? { bottom: 1 - ARROW / 2, borderRightWidth: 1, borderBottomWidth: 1 }
                : { top: 1 - ARROW / 2, borderLeftWidth: 1, borderTopWidth: 1 }),
            }}
          />
        </Animated.View>
      </Modal>
    </>
  );
}
