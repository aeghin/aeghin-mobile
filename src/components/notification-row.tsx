import Bell from "lucide-react-native/icons/bell";
import Building2 from "lucide-react-native/icons/building-2";
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
import { personName } from "@/lib/names";
import type { NotificationCategory, NotificationItem } from "@/types/notification";
import type { PendingInvitation } from "@/types/organization";

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
// predates. Without this its row would crash the whole menu.
const FALLBACK_STYLE: RowStyle = { icon: Bell, color: (t) => t.textMuted, tint: 0.12 };

/** The dashboard's `describe`, plus a line for a category this build predates. */
function describe(item: NotificationItem): string {
  if (item.category === "AWAITING_RESPONSE") return "Waiting on your answer";
  if (item.category === "FULLY_STAFFED") return "Fully staffed";

  if (item.category === "ROSTER_ATTENTION") {
    return item.count === 1 ? "1 spot still open" : `${item.count} spots still open`;
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
  const when = formatActivityTime(item.updatedAt);

  return (
    <BellRow
      icon={style.icon}
      color={style.color(theme)}
      tint={style.tint}
      title={item.eventName}
      line={describe(item)}
      meta={`${item.organizationName} · ${when}`}
      unread={item.unread}
      onPress={onPress}
    />
  );
}

/**
 * An organization asking to have you, at the top of the bell. It asks for an
 * answer, so it wears the colour of the rows that do.
 */
export function InvitationNoticeRow({
  invitation,
  onPress,
}: {
  invitation: PendingInvitation;
  onPress: () => void;
}) {
  const theme = useTheme();
  const inviter = personName(invitation.invitedBy);

  return (
    <BellRow
      icon={Building2}
      color={theme.sky}
      tint={0.1}
      title={invitation.organization.name}
      line={inviter ? `${inviter} invited you to join` : "You've been invited to join"}
      meta={formatActivityTime(invitation.createdAt)}
      unread={!invitation.seen}
      onPress={onPress}
    />
  );
}

/** One row of the bell, whatever it points at. */
function BellRow({
  icon,
  color,
  tint,
  title,
  line,
  meta,
  unread,
  onPress,
}: {
  icon: AppIconName;
  color: string;
  tint: number;
  title: string;
  line: string;
  meta: string;
  unread: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The dot is the only visual cue for unread, so the label says it.
      accessibilityLabel={`${title}. ${line}. ${meta}.${unread ? " Unread." : ""}`}
      className="data-[active=true]:opacity-60"
    >
      <HStack className="items-start gap-3 px-3.5 py-3">
        <Center
          className="mt-0.5 h-9 w-9 rounded-full"
          style={{ backgroundColor: withAlpha(color, tint) }}
        >
          <AppIcon icon={icon} size={16} color={color} />
        </Center>

        <VStack className="flex-1 gap-0.5">
          <HStack className="items-center gap-2">
            <Text
              className="flex-1 text-[15px] font-medium leading-[20px] text-foreground"
              numberOfLines={1}
            >
              {title}
            </Text>
            {unread ? <Box className="h-2 w-2 rounded-full bg-brand" /> : null}
          </HStack>

          <Text className="text-[13px] leading-[18px] text-muted-foreground">{line}</Text>

          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {meta}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}
