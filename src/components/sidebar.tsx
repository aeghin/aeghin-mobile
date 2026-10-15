import * as Notifications from "expo-notifications";
import { useNavigationContainerRef } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useTheme } from "@/hooks/use-theme";

/** Wide enough for an organization's name, narrow enough to leave the page in view. */
const MAX_WIDTH = 288;
const WIDTH_RATIO = 0.74;
/** The sidebar trails the page by a quarter of its width as the two slide. */
const PARALLAX = 0.25;
const DURATION = 300;
const EASING = Easing.bezier(0.32, 0.72, 0, 1);

type SidebarContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /**
   * Where the page's nav bar ends, as its header measures it, so the
   * sidebar's top rule can meet the bar's line. Null until a header reports.
   */
  headerHeight: number | null;
  setHeaderHeight: (height: number) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const value = useContext(SidebarContext);

  if (!value) {
    throw new Error("useSidebar must be used inside <SidebarLayout>.");
  }

  return value;
}

/**
 * The phone's sidebar, the web dashboard's in a drawer: it opens from the left
 * and pushes the whole app across rather than covering it, header and tab bar
 * included, so nothing sits on top of the page's own buttons. The strip of
 * page left showing is dimmed, and a tap or a drag back to the left closes it.
 */
export function SidebarLayout({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(MAX_WIDTH, Math.round(screenWidth * WIDTH_RATIO));

  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : DURATION;

  const progress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);

  const open = useCallback(() => {
    Keyboard.dismiss();
    setIsOpen(true);
    progress.set(withTiming(1, { duration, easing: EASING }));
  }, [duration, progress]);

  const close = useCallback(() => {
    setIsOpen(false);
    progress.set(withTiming(0, { duration, easing: EASING }));
  }, [duration, progress]);

  // Under a page that's leaving for another screen it shuts at once, so the
  // page uncovers that screen rather than the sidebar sliding away.
  const closeFor = useCallback(
    (covered: boolean) => {
      if (covered) {
        setIsOpen(false);
        progress.set(0);
      } else {
        close();
      }
    },
    [close, progress],
  );

  // A screen opened inside the tabs while it's open, by a link followed from
  // one of its pages, closes it, so the new screen isn't left behind the
  // dimmed strip. Its own pages push over the tabs and come back to it open.
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const opened = tabsPosition(navigation.getRootState());
    let covered = !tabsOnTop(navigation.getRootState());

    return navigation.addListener("state", () => {
      const root = navigation.getRootState();
      if (tabsPosition(root) !== opened) closeFor(covered);
      covered = !tabsOnTop(root);
    });
  }, [isOpen, navigation, closeFor]);

  // A notification tapped always opens with it shut. Watching navigation isn't
  // enough: one for the events list, when the list is already the screen
  // beneath, only changes which of its tabs shows.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      closeFor(!tabsOnTop(navigation.getRootState()));
    });

    return () => subscription.remove();
  }, [isOpen, navigation, closeFor]);

  // Android's back button shuts the sidebar before it leaves the screen. On a
  // page pushed over it, the press is that page's.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!tabsOnTop(navigation.getRootState())) return false;
      close();
      return true;
    });

    return () => subscription.remove();
  }, [isOpen, navigation, close]);

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * width }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateX: progress.get() * width }],
  }));

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.get() - 1) * width * PARALLAX }],
  }));

  const value = useMemo(
    () => ({ isOpen, open, close, headerHeight, setHeaderHeight }),
    [isOpen, open, close, headerHeight],
  );

  return (
    <SidebarContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: theme.muted }}>
        <GestureDetector gesture={dragToClose(progress, width, duration, setIsOpen)}>
          <Animated.View
            style={[
              styles.sidebar,
              {
                width,
                borderRightColor: theme.border,
                // The web's `--sidebar`: a step off white, and a step above the page in dark.
                backgroundColor: theme.muted,
              },
              sidebarStyle,
            ]}
            pointerEvents={isOpen ? "auto" : "none"}
            accessibilityViewIsModal={isOpen}
            onAccessibilityEscape={close}
            accessibilityElementsHidden={!isOpen}
            importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
          >
            {sidebar}
          </Animated.View>
        </GestureDetector>

        <Animated.View
          style={[styles.page, { backgroundColor: theme.groupedBackground }, pageStyle]}
          accessibilityElementsHidden={isOpen}
          importantForAccessibility={isOpen ? "no-hide-descendants" : "auto"}
        >
          {children}
        </Animated.View>

        <GestureDetector gesture={dragToClose(progress, width, duration, setIsOpen)}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.scheme === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.22)" },
              scrimStyle,
            ]}
            pointerEvents={isOpen ? "auto" : "none"}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </SidebarContext.Provider>
  );
}

/**
 * Dragging the open sidebar back to the left, on the sidebar or on the page
 * beside it. It follows the finger, then settles open or shut by where it was
 * let go and how fast. Vertical drags pass through, so the sidebar's list
 * still scrolls.
 */
function dragToClose(
  progress: SharedValue<number>,
  width: number,
  duration: number,
  setIsOpen: (open: boolean) => void,
) {
  return Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      "worklet";
      progress.set(Math.min(1, Math.max(0, 1 + event.translationX / width)));
    })
    .onEnd((event) => {
      "worklet";
      const shut = event.velocityX < -400 || progress.get() < 0.6;
      progress.set(withTiming(shut ? 0 : 1, { duration, easing: EASING }));

      if (shut) {
        scheduleOnRN(setIsOpen, false);
      }
    });
}

type RouteState = {
  index?: number;
  routes: { key?: string; name: string; state?: RouteState }[];
};

/** The root stack the tabs sit in, beneath expo-router's own root route. */
function stackOfTabs(state: RouteState | undefined): RouteState | undefined {
  while (state && !state.routes.some((route) => route.name === "(tabs)")) {
    state = state.routes[state.index ?? 0]?.state;
  }
  return state;
}

/** Whether the tabs are on screen, rather than a page pushed over them. */
function tabsOnTop(root: RouteState | undefined): boolean {
  const stack = stackOfTabs(root);
  return !stack || stack.routes[stack.index ?? 0]?.name === "(tabs)";
}

/**
 * The screens on show inside the tabs, as keys. Pushing a page over the tabs
 * or going back from one leaves it as it was; opening anything inside them
 * changes it.
 */
function tabsPosition(root: RouteState | undefined): string {
  let state = stackOfTabs(root)?.routes.find((route) => route.name === "(tabs)")?.state;
  const keys: string[] = [];

  while (state) {
    const route: RouteState["routes"][number] | undefined = state.routes[state.index ?? 0];
    if (!route) break;
    keys.push(route.key ?? route.name);
    state = route.state;
  }

  return keys.join("/");
}

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  page: {
    flex: 1,
  },
});
