import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import ListFilter from "lucide-react-native/icons/list-filter";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useEffect, useState } from "react";
import { Animated, Keyboard, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/** Air between the capsule and the keyboard, once the keyboard is up. */
const GAP = 10;

/**
 * Air between the capsule and the tab bar at rest.
 *
 * `insets.bottom` alone leaves 11pt, which reads as the two capsules touching
 * — and the tab bar's touch area is wider than the glass it draws, so the
 * bottom of the field was hard to hit.
 */
const TAB_BAR_MARGIN = 14;

/** The capsule itself. */
const HEIGHT = 46;

/**
 * What a list under this dock has to clear, on top of `insets.bottom`.
 *
 * The dock is absolutely positioned, so it takes no layout space and a list
 * would otherwise run its last row underneath.
 */
export const SEARCH_DOCK_CLEARANCE = TAB_BAR_MARGIN + HEIGHT + 16;

type KeyboardState = { height: number; duration: number };

const KEYBOARD_DOWN: KeyboardState = { height: 0, duration: 250 };

type Props = {
  query: string;
  onChange: (query: string) => void;
  /** How many filters are on, shown as a badge on the button. */
  activeFilters: number;
  onOpenFilters: () => void;
};

/**
 * The members search field, floating over the roster in a glass capsule.
 *
 * It lives *in the screen* rather than in `NativeTabs.BottomAccessory`, which
 * is what the earlier version got wrong: UIKit never lifts a tab bar accessory
 * off the keyboard, so the field spent every keystroke buried under it. A view
 * of our own can be moved, and `keyboardWillShow` hands us the system's own
 * curve and duration to move it with.
 */
export function MembersSearchDock({
  query,
  onChange,
  activeFilters,
  onOpenFilters,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Inside a `NativeTabs` screen the bottom inset already covers the floating
  // tab bar — 83pt on an iPhone 17, not the home indicator's 34 — so this plus
  // a margin parks the capsule clear of it.
  const resting = insets.bottom + TAB_BAR_MARGIN;

  // Lazily, not `useRef(...).current` — reading a ref during render is an
  // error under this project's lint.
  const [lift] = useState(() => new Animated.Value(0));
  const [keyboard, setKeyboard] = useState(KEYBOARD_DOWN);

  useEffect(() => {
    // `will` on iOS so the capsule rides the keyboard up rather than chasing
    // it; Android only offers `did`.
    const ios = Platform.OS === "ios";

    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (event) =>
      setKeyboard({
        height: event.endCoordinates.height,
        duration: event.duration || KEYBOARD_DOWN.duration,
      }),
    );

    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (event) =>
      setKeyboard({
        height: 0,
        duration: event.duration || KEYBOARD_DOWN.duration,
      }),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Kept out of the listener on purpose. `insets.bottom` arrives as the home
  // indicator's 34 and only grows to include the tab bar a frame later, so a
  // `resting` captured at subscribe time can be stale by the time the keyboard
  // opens — and the lift would then disagree with the `bottom` it is measured
  // from. Deriving it here means a late inset simply re-runs the sum.
  useEffect(() => {
    Animated.timing(lift, {
      toValue: keyboard.height
        ? -Math.max(keyboard.height + GAP - resting, 0)
        : 0,
      duration: keyboard.duration,
      useNativeDriver: true,
    }).start();
  }, [keyboard, lift, resting]);

  const field = (
    <HStack className="items-center gap-2 px-4" style={{ height: HEIGHT }}>
      <AppIcon icon={Search} size={17} color={theme.textMuted} />

      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="Search members"
        placeholderTextColor={theme.textMuted}
        style={{ flex: 1, fontSize: 17, color: theme.text }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {query ? (
        <Pressable
          onPress={() => onChange("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <AppIcon icon={X} size={15} color={theme.textMuted} />
        </Pressable>
      ) : null}

      {/* In the capsule rather than up the page with the list: search and
          filter narrow the same roster, and this is the end of the screen a
          thumb already rests on. Tinted whenever it is doing something, so an
          unexpectedly short list explains itself without scrolling. */}
      <Pressable
        onPress={onOpenFilters}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          activeFilters === 0
            ? "Filter members"
            : `Filter members, ${activeFilters} ${activeFilters === 1 ? "filter" : "filters"} on`
        }
        className="-mr-1 flex-row items-center gap-1 px-1 data-[active=true]:opacity-60"
      >
        <AppIcon
          icon={ListFilter}
          size={17}
          color={activeFilters > 0 ? brand.orange : theme.textMuted}
        />

        {activeFilters > 0 ? (
          <Box
            className="min-w-[16px] items-center rounded-full px-1"
            style={{ backgroundColor: brand.orange }}
          >
            <Text className="text-[11px] font-bold text-white">{activeFilters}</Text>
          </Box>
        ) : null}
      </Pressable>
    </HStack>
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: resting,
        transform: [{ translateY: lift }],
      }}
    >
      {/* Behind the field rather than around it. `GlassView` mounts children
          into a `UIVisualEffectView`'s content view, and nothing about the
          field needs to be in there — this way no glass of any kind sits
          between a finger and the input. */}
      {isLiquidGlassAvailable() ? (
        <GlassView
          glassEffectStyle="regular"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: HEIGHT / 2 }]}
        />
      ) : (
        // Pre-26 there is no glass to sit in, so the capsule draws itself.
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: HEIGHT / 2,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
            },
          ]}
        />
      )}

      {field}
    </Animated.View>
  );
}
