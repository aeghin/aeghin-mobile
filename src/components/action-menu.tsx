import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable as RNPressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";

export type ActionMenuItem = {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  /** Reddens the row, as the web's `text-destructive` menu item. */
  destructive?: boolean;
};

/** The ⋮ itself. Small enough to tuck into a corner, wide enough to hit. */
const TRIGGER = 30;
const MENU_WIDTH = 200;
/** Between the trigger and the card. */
const GAP = 6;
/** How close to a screen edge the card may land. */
const EDGE = 12;
/** Fixed, because the card is positioned before it has ever been laid out. */
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 28;
const CARD_PADDING = 6;
const RADIUS = 14;

/** Where the trigger sits in the window, once it has been measured. */
type Anchor = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** The window the card has to fit inside. */
type Bounds = { width: number; height: number; top: number; bottom: number };

/**
 * Where the card lands: right-aligned to the trigger, below it when there is
 * room and above it when there is not, and never past a screen edge.
 */
function placeMenu(anchor: Anchor, menuHeight: number, bounds: Bounds) {
  const below = anchor.y + anchor.height + GAP;
  const flipped = below + menuHeight > bounds.height - bounds.bottom - EDGE;

  return {
    flipped,
    top: flipped
      ? Math.max(bounds.top + EDGE, anchor.y - menuHeight - GAP)
      : below,
    left: clamp(
      anchor.x + anchor.width - MENU_WIDTH,
      EDGE,
      Math.max(EDGE, bounds.width - MENU_WIDTH - EDGE),
    ),
  };
}

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** What the ⋮ announces — "Event actions", not "More". */
  label: string;
  /** The uppercase rule over the items. The web's `DropdownMenuLabel`. */
  heading?: string;
};

/**
 * The dashboard's overflow menu: a ⋮ that drops a small card of actions,
 * right-aligned under itself.
 *
 * The web reaches for this whenever a thing has actions that are neither
 * frequent nor safe enough to sit on the surface — editing and deleting the
 * whole event, as opposed to the roster work that lives on the Team card.
 *
 * The card is positioned from a `measureInWindow` of the trigger rather than
 * laid out beside it, because the surfaces this hangs off clip their own
 * children: the event hero is `overflow-hidden` so its washes round off with
 * the card, and a popover drawn inside it would be cut in half.
 */
export function ActionMenu({ items, label, heading = "Actions" }: ActionMenuProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const triggerRef = useRef<View>(null);

  // Where the card sits, and whether it is up — two pieces, because the anchor
  // has to outlive the closing. The modal fades out over its own quarter
  // second, and an anchor cleared on close drops the card's `top`/`left` to
  // zero for exactly that long: it jumps to the top-left corner of the screen
  // and fades out from there. Retained, it fades where you left it.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);

  // Whether this closing is animated. Dismissing off a *chosen* item is not:
  // something else is about to open, and the fade is 400ms of watching a menu
  // you have already finished with — the whole press-to-dialog round trip
  // measured ~850ms with it. A scrim tap keeps the fade, because there the
  // fade is the only feedback that the tap landed.
  const [fading, setFading] = useState(true);

  // What to run once the menu is off screen. A row that opens anything modal
  // of its own — the destructive ones open a confirmation dialog — cannot
  // present it while this modal is still dismissing, so the row only ever
  // closes the menu and the action waits for the dismissal to finish.
  const pending = useRef<(() => void) | null>(null);

  const [scale] = useState(() => new Animated.Value(0.92));

  useEffect(() => {
    if (!open) return;

    scale.setValue(0.92);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 320,
      mass: 0.7,
    }).start();
  }, [open, scale]);

  const flush = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const choose = (item: ActionMenuItem) => {
    pending.current = item.onPress;
    setFading(false);
    setOpen(false);

    // `onDismiss` is iOS-only, so elsewhere the next frame is as long as the
    // menu can be waited on.
    if (Platform.OS !== "ios") requestAnimationFrame(flush);
  };

  const menuHeight =
    HEADER_HEIGHT + items.length * ROW_HEIGHT + CARD_PADDING * 2;

  // Below the trigger by default, flipped above it when there is no room —
  // and the card grows up from its own bottom edge when it does. Null only
  // before the first open, when there is no modal on screen to place.
  const placement = anchor && placeMenu(anchor, menuHeight, {
    width,
    height,
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
              setFading(true);
              setOpen(true);
            })
          }
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
          style={{ width: TRIGGER, height: TRIGGER }}
        >
          <AppIcon icon={EllipsisVertical} size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType={fading ? "fade" : "none"}
        statusBarTranslucent
        onDismiss={flush}
        onRequestClose={() => setOpen(false)}
      >
        {/* Lighter than a dialog's scrim: this is a menu hanging off something
            you are still looking at, not a page that has been replaced. */}
        <RNPressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `rgba(0, 0, 0, ${theme.scheme === "dark" ? 0.4 : 0.18})`,
          }}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />

        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="menu"
          style={{
            position: "absolute",
            top: placement ? placement.top : 0,
            left: placement ? placement.left : 0,
            width: MENU_WIDTH,
            paddingVertical: CARD_PADDING,
            borderRadius: RADIUS,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            overflow: "hidden",
            boxShadow: "0px 16px 32px rgba(0, 0, 0, 0.24)",
            transformOrigin: placement?.flipped ? "bottom right" : "top right",
            opacity: scale.interpolate({
              inputRange: [0.92, 1],
              outputRange: [0, 1],
            }),
            transform: [{ scale }],
          }}
        >
          <VStack className="justify-center px-3" style={{ height: HEADER_HEIGHT }}>
            <Text className="text-[10px] font-bold uppercase tracking-[0.9px] text-muted-foreground">
              {heading}
            </Text>
          </VStack>

          {items.map((item, index) => (
            <VStack key={item.label}>
              {index === 0 ? <Divider /> : null}

              <Pressable
                onPress={() => choose(item)}
                accessibilityRole="menuitem"
                className="data-[active=true]:bg-border/50"
              >
                <HStack
                  className="items-center gap-2.5 px-3"
                  style={{ height: ROW_HEIGHT }}
                >
                  <AppIcon
                    icon={item.icon}
                    size={17}
                    color={item.destructive ? theme.destructive : theme.textMuted}
                  />
                  <Text
                    className={`flex-1 text-[15px] ${
                      item.destructive ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </Text>
                </HStack>
              </Pressable>
            </VStack>
          ))}
        </Animated.View>
      </Modal>
    </>
  );
}
