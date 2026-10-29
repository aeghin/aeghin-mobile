import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * A one-time hint pointing up at whatever sits just above it: the page's ink
 * as its fill so it reads as a note on the screen rather than part of it, in
 * either scheme. Pair it with `useTip` so "Got it" is remembered.
 */
export function Tip({
  icon,
  title,
  message,
  onDismiss,
  align = "start",
}: {
  icon: AppIconName;
  title: string;
  message: string;
  onDismiss: () => void;
  /** The end of the bubble its arrow sits at, under the thing it points to. */
  align?: "start" | "end";
}) {
  const theme = useTheme();
  const fill = theme.text;
  const ink = theme.card;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <VStack className="pt-2">
        <VStack
          className="gap-2.5 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: fill,
            borderCurve: "continuous",
            shadowColor: "#000000",
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <HStack className="items-start gap-3">
            <AppIcon icon={icon} size={18} color={ink} />
            <VStack className="flex-1 gap-0.5">
              <Text className="text-[14px] font-semibold" style={{ color: ink }}>
                {title}
              </Text>
              <Text className="text-[13px] leading-[18px]" style={{ color: withAlpha(ink, 0.75) }}>
                {message}
              </Text>
            </VStack>
          </HStack>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            className="self-end data-[active=true]:opacity-70"
          >
            <Box className="rounded-full px-3.5 py-1.5" style={{ backgroundColor: ink }}>
              <Text className="text-[13px] font-semibold" style={{ color: fill }}>
                Got it
              </Text>
            </Box>
          </Pressable>
        </VStack>

        {/* The arrow: a square turned on its point, half tucked into the
            bubble, and drawn after it so the bubble's shadow stays off it. */}
        <Box
          className={`absolute top-0.5 h-3 w-3 ${align === "end" ? "right-5" : "left-5"}`}
          style={{ backgroundColor: fill, transform: [{ rotate: "45deg" }] }}
        />
      </VStack>
    </Animated.View>
  );
}
