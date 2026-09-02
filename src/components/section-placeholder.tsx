import { ScrollView } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";

type SectionPlaceholderProps = {
  icon: AppIconName;
  title: string;
  body: string;
};

/**
 * What a tab shows before its endpoint exists.
 *
 * `/api/mobile/v1` serves organizations, one organization, and its members.
 * There is no events or songs payload, so these tabs render this rather than a
 * list built around a guess at a shape. Each replaces it with its own list when
 * its endpoint lands.
 *
 * It is a `ScrollView` rather than a `View` so the tab bar's `minimizeBehavior`
 * has something to react to. The nav bar above it is opaque, so the screen
 * already starts below it and needs no inset adjustment.
 */
export function SectionPlaceholder({
  icon,
  title,
  body,
}: SectionPlaceholderProps) {
  const theme = useTheme();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ flexGrow: 1 }}
      contentInsetAdjustmentBehavior="never"
    >
      <VStack space="sm" className="flex-1 items-center justify-center px-8">
        <AppIcon icon={icon} size={40} color={theme.textMuted} />
        <Text className="text-[17px] font-semibold text-foreground">
          {title}
        </Text>
        <Text className="max-w-[280px] text-center text-sm text-muted-foreground">
          {body}
        </Text>
      </VStack>
    </ScrollView>
  );
}
