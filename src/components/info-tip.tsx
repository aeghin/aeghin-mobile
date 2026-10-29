import Info from "lucide-react-native/icons/info";
import { useRef, useState } from "react";
import {
  Modal,
  Pressable as RNPressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";

/** The bubble's widest, before a narrow screen takes some off. */
const BUBBLE_WIDTH = 260;
/** Between the (i) and the arrow's point. */
const GAP = 2;
/** How close to a screen edge the bubble may land. */
const EDGE = 12;
/** The arrow: a square turned on its point, centred on the bubble's edge. */
const ARROW = 12;
/** How far the turned square reaches past that edge. */
const POINT = ARROW * Math.SQRT1_2;
const RADIUS = 16;

/** Where the (i) sits in the window, once it has been measured. */
type Anchor = { x: number; y: number; width: number; height: number };

/** The window the bubble has to fit inside. */
type Bounds = { width: number; height: number; top: number; bottom: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Where the bubble lands: centred under the (i) when there is room below and
 * over it when there is not, never past a screen edge, and with its arrow
 * still on the (i) wherever the edges pushed the bubble.
 */
function placeBubble(anchor: Anchor, width: number, height: number, bounds: Bounds) {
  const centre = anchor.x + anchor.width / 2;
  const left = clamp(centre - width / 2, EDGE, bounds.width - width - EDGE);
  const below = anchor.y + anchor.height + GAP + POINT;
  const flipped = below + height > bounds.height - bounds.bottom - EDGE;

  return {
    flipped,
    left,
    top: flipped
      ? Math.max(bounds.top + EDGE, anchor.y - GAP - POINT - height)
      : below,
    arrowLeft: clamp(centre - left - ARROW / 2, RADIUS, width - RADIUS - ARROW),
  };
}

/**
 * An (i) that explains whatever it sits beside. A tap opens a bubble in the
 * hints' ink, pointing at the (i), and a tap anywhere puts it away. The web's
 * also opens on hover; a phone only has the tap.
 *
 * Placed from a `measureInWindow` of the (i), as the ⋮ menu is, so a card that
 * clips its children can't cut the bubble off.
 */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  const triggerRef = useRef<View>(null);

  // Kept after closing, so the bubble fades out where it was instead of
  // jumping to the corner — the ⋮ menu's reason for the same split.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  // The words decide it, so it is only known after the first layout, and the
  // bubble is laid out unseen until then.
  const [height, setHeight] = useState<number | null>(null);

  const fill = theme.text;
  const ink = theme.card;

  const width = Math.min(BUBBLE_WIDTH, window.width - EDGE * 2);
  const placement =
    anchor &&
    placeBubble(anchor, width, height ?? 0, {
      width: window.width,
      height: window.height,
      top: insets.top,
      bottom: insets.bottom,
    });

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={() =>
            triggerRef.current?.measureInWindow((x, y, w, h) => {
              setAnchor({ x, y, width: w, height: h });
              setOpen(true);
            })
          }
          accessibilityRole="button"
          accessibilityLabel={label}
          // VoiceOver reads it straight off the (i), bubble or not.
          accessibilityHint={children}
          hitSlop={10}
          className="data-[active=true]:opacity-60"
        >
          <AppIcon icon={Info} size={14} color={theme.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* No scrim: it's a note over the screen, not a menu. */}
        <RNPressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        {placement ? (
          // Taps go through to the backdrop, so the bubble closes itself too.
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: placement.top,
              left: placement.left,
              width,
              opacity: height === null ? 0 : 1,
            }}
          >
            <Box
              onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
              className="px-3.5 py-2.5"
              style={{
                backgroundColor: fill,
                borderRadius: RADIUS,
                borderCurve: "continuous",
                shadowColor: "#000000",
                shadowOpacity: 0.15,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Text className="text-[13px] leading-[18px]" style={{ color: ink }}>
                {children}
              </Text>
            </Box>

            {/* Drawn after the bubble so its shadow stays off the arrow. */}
            <Box
              style={{
                position: "absolute",
                left: placement.arrowLeft,
                ...(placement.flipped ? { bottom: -ARROW / 2 } : { top: -ARROW / 2 }),
                width: ARROW,
                height: ARROW,
                backgroundColor: fill,
                transform: [{ rotate: "45deg" }],
              }}
            />
          </View>
        ) : null}
      </Modal>
    </>
  );
}
