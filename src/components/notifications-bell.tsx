import Bell from "lucide-react-native/icons/bell";
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

import { AppIcon } from "@/components/app-icon";
import { HeaderCapsule } from "@/components/header-capsule";
import { NotificationsMenu } from "@/components/notifications-menu";
import { Center } from "@/components/ui/center";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useNotifications } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";

/** Between the bell and the card. */
const GAP = 8;
/** The page's gutter, so the card lines up with the content under it. */
const GUTTER = 16;
const MAX_WIDTH = 400;
/** The dashboard's `max-h-100`. */
const MAX_LIST_HEIGHT = 400;
/** The card's title row, which sits above the list. */
const MENU_HEADER = 50;

/** Where the bell sits in the window, once it has been measured. */
type Anchor = { x: number; y: number; width: number; height: number };

/**
 * One feed for every organization, like the dashboard's, dropping its list
 * under the bell the way the dashboard's `DropdownMenu` does. The badge stays
 * inside the button's box: the native bar can clip anything outside a toolbar
 * item.
 *
 * The card mechanics are `ActionMenu`'s — a retained anchor so it fades out
 * where it was, and a chosen row that closes without the fade and runs once
 * the modal is gone.
 */
export function NotificationsBell() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { data, isStale, refetch } = useNotifications();

  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  const [fading, setFading] = useState(true);
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

  const unreadCount = data?.unreadCount ?? 0;

  const show = () =>
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      // Opening the old sheet mounted the query afresh; the bell already has.
      if (isStale) refetch();
      setAnchor({ x, y, width: w, height: h });
      setFading(true);
      setOpen(true);
    });

  const flush = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const select = (action: () => void) => {
    pending.current = action;
    setFading(false);
    setOpen(false);

    // `onDismiss` is iOS-only.
    if (Platform.OS !== "ios") requestAnimationFrame(flush);
  };

  const cardWidth = Math.min(MAX_WIDTH, width - GUTTER * 2);
  const top = anchor ? anchor.y + anchor.height + GAP : 0;
  const maxListHeight = Math.min(
    MAX_LIST_HEIGHT,
    height - top - MENU_HEADER - insets.bottom - GUTTER,
  );

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={show}
          accessibilityRole="button"
          // The badge truncates at 9+; the label carries the real number.
          accessibilityLabel={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          accessibilityState={{ expanded: open }}
          className="data-[active=true]:opacity-60"
        >
          <HeaderCapsule>
            <AppIcon icon={Bell} size={20} color={theme.text} />

            {unreadCount > 0 ? (
              <Center className="absolute right-0 top-0 h-4 min-w-4 rounded-full bg-brand px-1">
                <Text className="text-[10px] font-semibold leading-[12px] text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </Center>
            ) : null}
          </HeaderCapsule>
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
          accessibilityLabel="Close notifications"
        />

        <Animated.View
          accessibilityViewIsModal
          style={{
            position: "absolute",
            top,
            right: GUTTER,
            width: cardWidth,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            overflow: "hidden",
            boxShadow: "0px 16px 32px rgba(0, 0, 0, 0.24)",
            transformOrigin: "top right",
            opacity: scale.interpolate({ inputRange: [0.92, 1], outputRange: [0, 1] }),
            transform: [{ scale }],
          }}
        >
          <NotificationsMenu maxListHeight={maxListHeight} onSelect={select} />
        </Animated.View>
      </Modal>
    </>
  );
}
