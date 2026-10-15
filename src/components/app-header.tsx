import { Stack } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, type ReactNode } from "react";
import { Path, Svg } from "react-native-svg";

import { HeaderCapsule } from "@/components/header-capsule";
import { Logo } from "@/components/logo";
import { useSidebar } from "@/components/sidebar";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";

/**
 * Every tab's bar: the menu that opens the sidebar and the aeghin lockup on the
 * left, the screen's own `actions` on the right. Switching organizations lives
 * in the sidebar and notifications in their own tab, so the bar carries
 * neither.
 *
 * `actions` share one bar item, so several keep an 8pt rhythm rather than
 * UIKit's 16pt item gap.
 */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  const theme = useTheme();
  // Not `isOpen`: reading it would redraw every tab's bar items as the sidebar
  // starts to move, and the page hides this button from VoiceOver while open.
  const { open, setHeaderHeight } = useSidebar();

  // The bar is 54pt on iOS 26 and 44pt before it, so the sidebar is told
  // the measured height rather than guessing.
  const headerHeight = useHeaderHeight();
  useEffect(() => {
    setHeaderHeight(headerHeight);
  }, [headerHeight, setHeaderHeight]);

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <HStack className="items-center gap-2.5">
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel="Menu"
              className="data-[active=true]:opacity-60"
            >
              <HeaderCapsule>
                <MenuGlyph color={theme.text} />
              </HeaderCapsule>
            </Pressable>

            <HStack className="items-center gap-2">
              <Logo size={28} trim />
              <Text className="text-[22px] font-bold tracking-[-0.3px] text-brand">
                aeghin
              </Text>
            </HStack>
          </HStack>
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      {actions ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.View hidesSharedBackground>
            <HStack className="items-center gap-2">{actions}</HStack>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

/** Two lines, the lower one short: the usual glyph for a sidebar. */
function MenuGlyph({ color }: { color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <Path d="M4 9h16" />
      <Path d="M4 15h10" />
    </Svg>
  );
}
