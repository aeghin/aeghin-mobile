import CalendarClock from "lucide-react-native/icons/calendar-clock";
import CalendarPlus from "lucide-react-native/icons/calendar-plus";
import CalendarX from "lucide-react-native/icons/calendar-x";
import CircleX from "lucide-react-native/icons/circle-x";
import Mail from "lucide-react-native/icons/mail";
import MailX from "lucide-react-native/icons/mail-x";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserCheck from "lucide-react-native/icons/user-check";
import UserCog from "lucide-react-native/icons/user-cog";
import UserMinus from "lucide-react-native/icons/user-minus";
import UserSearch from "lucide-react-native/icons/user-search";
import UserX from "lucide-react-native/icons/user-x";
import Zap from "lucide-react-native/icons/zap";
import ZapOff from "lucide-react-native/icons/zap-off";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatActivityTime } from "@/lib/events/format";
import type { ActivityItem, ActivityType } from "@/types/activity";

type RowStyle = { icon: AppIconName; color: (theme: Palette) => string };

/** The dashboard's `activityConfig`, with its Tailwind classes resolved. */
const ROW_STYLES: Record<ActivityType, RowStyle> = {
  EVENT_CREATED: { icon: CalendarPlus, color: (t) => t.success },
  EVENT_DELETED: { icon: CalendarX, color: (t) => t.destructive },
  INVITE_SENT: { icon: Mail, color: (t) => t.admin },
  INVITE_ACCEPTED: { icon: UserCheck, color: (t) => t.success },
  INVITE_DECLINED: { icon: CircleX, color: (t) => t.destructive },
  INVITE_CANCELED: { icon: MailX, color: (t) => t.textMuted },
  AUTO_INVITE_SENT: { icon: Zap, color: (t) => t.warning },
  MEMBER_REMOVED: { icon: UserX, color: (t) => t.destructive },
  MEMBER_LEFT: { icon: UserMinus, color: (t) => t.textMuted },
  ROLE_CHANGED: { icon: UserCog, color: (t) => t.violet },
  SMART_FILL_SKIPPED: { icon: ZapOff, color: (t) => t.textMuted },
  SMART_FILL_NO_CANDIDATES: { icon: UserSearch, color: (t) => t.warning },
  SMART_FILL_ALL_UNAVAILABLE: { icon: CalendarClock, color: (t) => t.warning },
  SMART_FILL_FAILED: { icon: TriangleAlert, color: (t) => t.destructive },
  SMART_SCHEDULING_ENABLED: { icon: Zap, color: (t) => t.success },
  SMART_SCHEDULING_DISABLED: { icon: ZapOff, color: (t) => t.textMuted },
};

type Part = { text: string; bold?: boolean };

const name = (text: string | null): Part => ({ text: text ?? "Someone", bold: true });
const plain = (text: string): Part => ({ text });
const onEvent = (eventName: string | null): Part[] =>
  eventName ? [plain(" on "), name(eventName)] : [];

/** The dashboard's `describeActivity`, sentence for sentence. */
function describe(item: ActivityItem): Part[] {
  switch (item.type) {
    case "EVENT_CREATED":
      return [name(item.actorName), plain(" created the event "), name(item.eventName ?? item.targetName)];
    case "EVENT_DELETED":
      return [name(item.actorName), plain(" deleted the event "), name(item.targetName)];
    case "INVITE_SENT":
      return item.eventName
        ? [name(item.actorName), plain(" sent invites for "), name(item.eventName)]
        : [name(item.actorName), plain(" invited "), name(item.targetName), plain(" to the organization")];
    case "INVITE_ACCEPTED":
      return [name(item.actorName), plain(" accepted their invitation and joined")];
    case "INVITE_DECLINED":
      return [name(item.actorName), plain(" declined their invitation")];
    case "INVITE_CANCELED":
      return [name(item.actorName), plain(" canceled the invitation to "), name(item.targetName)];
    case "AUTO_INVITE_SENT":
      return item.actorName
        ? [plain("Smart Scheduling invited "), name(item.targetName), plain(" after "), name(item.actorName), plain(" declined"), ...onEvent(item.eventName)]
        : [plain("Smart Scheduling auto-invited "), name(item.targetName)];
    case "SMART_FILL_SKIPPED":
      return [name(item.actorName), plain(" declined "), name(item.targetName), ...onEvent(item.eventName), plain(" — auto-fill is off, so the slot is still open")];
    case "SMART_FILL_NO_CANDIDATES":
      return [plain("Smart Scheduling couldn't fill "), name(item.targetName), ...onEvent(item.eventName), plain(" — nobody in this organization has that role")];
    case "SMART_FILL_ALL_UNAVAILABLE":
      return [plain("Smart Scheduling couldn't fill "), name(item.targetName), ...onEvent(item.eventName), plain(" — everyone qualified is unavailable")];
    case "SMART_FILL_FAILED":
      return [plain("Smart Scheduling hit an error filling "), name(item.targetName), ...onEvent(item.eventName), plain(" after "), name(item.actorName), plain(" declined")];
    case "SMART_SCHEDULING_ENABLED":
      return [name(item.actorName), plain(" turned auto-fill on"), ...onEvent(item.eventName)];
    case "SMART_SCHEDULING_DISABLED":
      return [name(item.actorName), plain(" turned auto-fill off"), ...onEvent(item.eventName)];
    case "ROLE_CHANGED":
      return item.actorName
        ? [name(item.actorName), plain(" changed "), name(item.targetName), plain("'s role to "), name(item.detail)]
        : [name(item.targetName), plain(" was automatically promoted to "), name(item.detail)];
    case "MEMBER_REMOVED":
      return [name(item.actorName), plain(" removed "), name(item.targetName), plain(" from the organization")];
    case "MEMBER_LEFT":
      return [name(item.actorName), plain(" left the organization")];
  }
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  const theme = useTheme();
  const style = ROW_STYLES[item.type];
  const color = style.color(theme);
  const detail = item.type === "ROLE_CHANGED" ? null : item.detail;

  return (
    <HStack className="items-start gap-3 px-3.5 py-3">
      <Center
        className="h-9 w-9 rounded-full"
        style={{ backgroundColor: withAlpha(color, 0.12) }}
      >
        <AppIcon icon={style.icon} size={16} color={color} />
      </Center>

      <VStack className="flex-1 gap-0.5">
        <Text className="text-[14px] leading-[19px] text-muted-foreground">
          {describe(item).map((part, index) => (
            <Text
              key={index}
              className={`text-[14px] leading-[19px] ${
                part.bold ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {part.text}
            </Text>
          ))}
        </Text>

        {detail ? (
          <Text className="text-[12px] text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}

        <Text className="text-[11px] text-muted-foreground">
          {formatActivityTime(item.createdAt)}
        </Text>
      </VStack>
    </HStack>
  );
}
