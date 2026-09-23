import Bell from "lucide-react-native/icons/bell";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Inbox from "lucide-react-native/icons/inbox";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatActivityTime } from "@/lib/events/format";
import type { NotificationCategory, NotificationItem } from "@/types/notification";

type RowStyle = {
  icon: AppIconName;
  color: (theme: Palette) => string;
  tint: number;
};

/** The dashboard's `CATEGORY_ICONS` and `CATEGORY_COLORS`, resolved. */
const ROW_STYLES: Record<NotificationCategory, RowStyle> = {
  ROSTER_ATTENTION: { icon: TriangleAlert, color: () => brand.orange, tint: 0.15 },
  AWAITING_RESPONSE: { icon: Inbox, color: (t) => t.sky, tint: 0.1 },
  FULLY_STAFFED: { icon: CircleCheck, color: (t) => t.success, tint: 0.1 },
};

// The contract is additive, so a newer server can send a category this build
// predates. Without this its row would crash the whole sheet.
const FALLBACK_STYLE: RowStyle = { icon: Bell, color: (t) => t.textMuted, tint: 0.12 };

/** The dashboard's `describe`, plus a line for a category this build predates. */
function describe(item: NotificationItem): string {
  if (item.category === "AWAITING_RESPONSE") return "Waiting on your answer";
  if (item.category === "FULLY_STAFFED") return "Fully staffed";

  if (item.category === "ROSTER_ATTENTION") {
    return item.count === 1 ? "1 role still open" : `${item.count} roles still open`;
  }

  return "Tap for details";
}

export function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const theme = useTheme();
  const style = ROW_STYLES[item.category] ?? FALLBACK_STYLE;
  const color = style.color(theme);
  const when = formatActivityTime(item.updatedAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The dot is the only visual cue for unread, so the label says it.
      accessibilityLabel={`${item.eventName}. ${describe(item)}. ${item.organizationName}, ${when}.${
        item.unread ? " Unread." : ""
      }`}
      className="data-[active=true]:opacity-60"
    >
      <HStack className="items-start gap-3 px-3.5 py-3">
        <Center
          className="mt-0.5 h-9 w-9 rounded-full"
          style={{ backgroundColor: withAlpha(color, style.tint) }}
        >
          <AppIcon icon={style.icon} size={16} color={color} />
        </Center>

        <VStack className="flex-1 gap-0.5">
          <HStack className="items-center gap-2">
            <Text
              className="flex-1 text-[15px] font-medium leading-[20px] text-foreground"
              numberOfLines={1}
            >
              {item.eventName}
            </Text>
            {item.unread ? <Box className="h-2 w-2 rounded-full bg-brand" /> : null}
          </HStack>

          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            {describe(item)}
          </Text>

          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {item.organizationName} · {when}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}
