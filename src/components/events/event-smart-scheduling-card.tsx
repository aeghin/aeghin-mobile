import CalendarClock from "lucide-react-native/icons/calendar-clock";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import MailWarning from "lucide-react-native/icons/mail-warning";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserSearch from "lucide-react-native/icons/user-search";
import Zap from "lucide-react-native/icons/zap";
import ZapOff from "lucide-react-native/icons/zap-off";
import { useState } from "react";
import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { DetailCard } from "@/components/events/event-detail-parts";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatActivityTime } from "@/lib/events/format";
import type {
  SmartActivityType,
  SmartSchedulingActivityItem,
} from "@/types/event";

/** The four kinds of entry that mean a slot was *not* filled. */
const UNFILLED: SmartActivityType[] = [
  "SMART_FILL_SKIPPED",
  "SMART_FILL_NO_CANDIDATES",
  "SMART_FILL_ALL_UNAVAILABLE",
  "SMART_FILL_FAILED",
];

type RowStyle = { icon: AppIconName; color: (theme: Palette) => string };

const ROW_STYLES: Record<SmartActivityType, RowStyle> = {
  AUTO_INVITE_SENT: { icon: Zap, color: (theme) => theme.success },
  SMART_FILL_SKIPPED: { icon: ZapOff, color: (theme) => theme.textMuted },
  SMART_FILL_NO_CANDIDATES: { icon: UserSearch, color: (theme) => theme.warning },
  SMART_FILL_ALL_UNAVAILABLE: {
    icon: CalendarClock,
    color: (theme) => theme.warning,
  },
  SMART_FILL_FAILED: { icon: TriangleAlert, color: (theme) => theme.destructive },
  SMART_SCHEDULING_ENABLED: { icon: Zap, color: (theme) => theme.success },
  SMART_SCHEDULING_DISABLED: { icon: ZapOff, color: (theme) => theme.textMuted },
};

type EventSmartSchedulingCardProps = {
  enabled: boolean;
  items: SmartSchedulingActivityItem[];
  expiredCount: number;
};

/**
 * What auto-fill has been doing about this event's declines.
 *
 * Managers only, and it hides itself entirely when auto-fill is off and there
 * is nothing to report — the same three-way condition the web uses, so a
 * quiet event does not carry a card explaining that nothing happened.
 *
 * The log expands in place rather than opening a dialog. It is already inside
 * a scroll view, and a modal on a phone would cost a dismiss for a list most
 * people read once.
 */
export function EventSmartSchedulingCard({
  enabled,
  items,
  expiredCount,
}: EventSmartSchedulingCardProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const filledCount = items.filter(
    (item) => item.type === "AUTO_INVITE_SENT",
  ).length;
  const unfilledCount = items.filter((item) =>
    UNFILLED.includes(item.type),
  ).length;

  if (!enabled && items.length === 0 && expiredCount === 0) {
    return null;
  }

  const stats = [
    filledCount > 0 && {
      key: "filled",
      icon: Zap,
      label: `${filledCount} filled automatically`,
      color: theme.success,
    },
    unfilledCount > 0 && {
      key: "unfilled",
      icon: CalendarClock,
      label: `${unfilledCount} ${unfilledCount === 1 ? "slot" : "slots"} left open`,
      color: theme.warning,
    },
    expiredCount > 0 && {
      key: "expired",
      icon: MailWarning,
      label: `${expiredCount} ${expiredCount === 1 ? "invite" : "invites"} expired`,
      color: theme.warning,
    },
  ].filter(Boolean) as {
    key: string;
    icon: AppIconName;
    label: string;
    color: string;
  }[];

  const accent = enabled ? theme.success : theme.textMuted;

  return (
    <DetailCard>
      <VStack className="gap-2.5 px-3.5 py-3.5">
        <HStack className="items-center gap-2.5">
          <Center
            className="h-8 w-8 shrink-0 rounded-xl"
            style={{ backgroundColor: withAlpha(accent, enabled ? 0.14 : 0.1) }}
          >
            <AppIcon icon={enabled ? Zap : ZapOff} size={15} color={accent} />
          </Center>

          <VStack className="flex-1 gap-px">
            <Text className="text-[14px] font-semibold tracking-[-0.2px] text-foreground">
              Smart Scheduling
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {`Auto-fill ${enabled ? "on" : "off"}`}
            </Text>
          </VStack>

          {items.length > 0 ? (
            <Pressable
              onPress={() => setOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={open ? "Hide log" : "View log"}
              className="rounded-full border border-border bg-surface px-2.5 py-1 data-[active=true]:opacity-60"
            >
              <HStack className="items-center gap-1">
                <Text className="text-[12px] font-semibold text-muted-foreground">
                  {open ? "Hide log" : "View log"}
                </Text>
                <Box
                  style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                >
                  <AppIcon icon={ChevronDown} size={11} color={theme.textMuted} />
                </Box>
              </HStack>
            </Pressable>
          ) : null}
        </HStack>

        {stats.length > 0 ? (
          <HStack className="flex-wrap items-center gap-x-3.5 gap-y-1">
            {stats.map((stat) => (
              <HStack key={stat.key} className="items-center gap-1.5">
                <AppIcon icon={stat.icon} size={12} color={stat.color} />
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: stat.color, fontVariant: ["tabular-nums"] }}
                >
                  {stat.label}
                </Text>
              </HStack>
            ))}
          </HStack>
        ) : (
          <Text className="text-[12px] text-muted-foreground">
            No declines to fill yet
          </Text>
        )}
      </VStack>

      {open ? (
        <>
          <Divider />
          <VStack className="gap-3 px-3.5 py-3">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </VStack>
        </>
      ) : null}
    </DetailCard>
  );
}

function ActivityRow({ item }: { item: SmartSchedulingActivityItem }) {
  const theme = useTheme();

  // A kind this build has never heard of is skipped rather than drawn blank —
  // the server's list of smart-scheduling activity can grow without the
  // installed apps knowing, and they cannot be force-updated.
  const style = ROW_STYLES[item.type];
  if (!style) return null;

  const color = style.color(theme);
  const description = describeRow(item);
  if (!description) return null;

  return (
    <HStack className="items-start gap-2.5">
      <Center
        className="mt-px h-7 w-7 shrink-0 rounded-xl"
        style={{ backgroundColor: withAlpha(color, 0.12) }}
      >
        <AppIcon icon={style.icon} size={13} color={color} />
      </Center>

      <VStack className="min-w-0 flex-1 gap-px">
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          {description}
        </Text>
        <Text className="text-[11.5px] text-muted-foreground">
          {`${formatActivityTime(item.createdAt)}${item.detail ? ` · ${item.detail}` : ""}`}
        </Text>
      </VStack>
    </HStack>
  );
}

/** A name inside a log line, picked out of the sentence around it. */
function Name({ children }: { children: string | null }) {
  return (
    <Text className="font-semibold text-foreground">{children ?? "someone"}</Text>
  );
}

/**
 * One log entry in words, matching the web's phrasing line for line — the two
 * describe the same events and should not word them differently.
 */
function describeRow(item: SmartSchedulingActivityItem): ReactNode {
  switch (item.type) {
    case "AUTO_INVITE_SENT":
      return item.actorName ? (
        <>
          Invited <Name>{item.targetName}</Name> after{" "}
          <Name>{item.actorName}</Name> declined
        </>
      ) : (
        <>
          Auto-invited <Name>{item.targetName}</Name>
        </>
      );
    case "SMART_FILL_SKIPPED":
      return (
        <>
          <Name>{item.actorName}</Name> declined <Name>{item.targetName}</Name>{" "}
          — auto-fill was off, so the slot is still open
        </>
      );
    case "SMART_FILL_NO_CANDIDATES":
      return (
        <>
          Couldn&apos;t fill <Name>{item.targetName}</Name> — nobody in this
          organization has that role
        </>
      );
    case "SMART_FILL_ALL_UNAVAILABLE":
      return (
        <>
          Couldn&apos;t fill <Name>{item.targetName}</Name> — everyone qualified
          is unavailable
        </>
      );
    case "SMART_FILL_FAILED":
      return (
        <>
          Hit an error filling <Name>{item.targetName}</Name> after{" "}
          <Name>{item.actorName}</Name> declined
        </>
      );
    case "SMART_SCHEDULING_ENABLED":
      return (
        <>
          <Name>{item.actorName}</Name> turned auto-fill on
        </>
      );
    case "SMART_SCHEDULING_DISABLED":
      return (
        <>
          <Name>{item.actorName}</Name> turned auto-fill off
        </>
      );
    default:
      return null;
  }
}
