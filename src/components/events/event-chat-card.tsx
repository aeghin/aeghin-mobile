import ChevronRight from "lucide-react-native/icons/chevron-right";
import MessagesSquare from "lucide-react-native/icons/messages-square";

import { AppIcon } from "@/components/app-icon";
import { DetailCard } from "@/components/events/event-detail-parts";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useChatHistory } from "@/hooks/use-event-chat";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { formatActivityTime } from "@/lib/events/format";
import { personName } from "@/lib/names";
import type { ServiceType } from "@/types/event";

type EventChatCardProps = {
  organizationId: string;
  eventId: string;
  service: ServiceType;
  onOpen: () => void;
};

/**
 * The chat's doorway, one line under the event's top card: the latest message,
 * who said it, and how many from others came in since you last had the chat
 * open. Reads the cached first page only — no socket opens until the chat
 * itself does.
 */
export function EventChatCard({ organizationId, eventId, service, onOpen }: EventChatCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);
  const history = useChatHistory(organizationId, eventId);

  const latest = history.data?.messages[0];
  const canPost = history.data?.viewer.canPost ?? false;
  const unread = history.data?.unreadCount ?? 0;

  const label = [
    unread > 0 ? `Event chat, ${unread} new ${unread === 1 ? "message" : "messages"}` : "Event chat",
    latest
      ? `${personName(latest.author)}, ${formatActivityTime(latest.createdAt)}: ${latest.body}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <DetailCard>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the chat"
        className="data-[active=true]:bg-border/40"
      >
        <HStack className="items-center gap-3 py-[11px] pl-3 pr-3.5">
          <Center
            className="rounded-[10px]"
            style={{
              width: 30,
              height: 30,
              borderCurve: "continuous",
              backgroundColor: withAlpha(colors.base, 0.12),
            }}
          >
            <AppIcon icon={MessagesSquare} size={15} color={colors.text} />
          </Center>

          {/* Two lines in every state, so nothing below moves when it loads. */}
          <VStack className="flex-1 justify-center gap-px" style={{ minHeight: 35 }}>
            {history.isPending ? (
              <VStack className="gap-2">
                <Skeleton startColor="bg-border" style={{ width: 110, height: 11 }} />
                <Skeleton startColor="bg-border" style={{ width: 200, height: 12 }} />
              </VStack>
            ) : latest ? (
              <>
                <HStack className="items-baseline gap-1.5">
                  <Text
                    className="shrink text-[12.5px] font-semibold leading-[16px] text-foreground"
                    numberOfLines={1}
                  >
                    {personName(latest.author)}
                  </Text>
                  <Text className="text-[12.5px] leading-[16px] text-muted-foreground">
                    {formatActivityTime(latest.createdAt)}
                  </Text>
                </HStack>
                <Text
                  className={`text-[13.5px] leading-[18px] ${
                    unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                  numberOfLines={1}
                >
                  {latest.body}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-[12.5px] font-semibold leading-[16px] text-foreground">
                  Event chat
                </Text>
                <Text className="text-[13.5px] leading-[18px] text-muted-foreground" numberOfLines={1}>
                  {history.isError
                    ? "Couldn't load the chat."
                    : canPost
                      ? "No messages yet. Say hello to the team."
                      : "No messages yet."}
                </Text>
              </>
            )}
          </VStack>

          {unread > 0 ? (
            <Center className="h-5 min-w-5 rounded-full bg-brand px-1.5">
              <Text className="text-[11px] font-bold leading-[13px] text-white">
                {unread > 9 ? "9+" : unread}
              </Text>
            </Center>
          ) : null}

          <AppIcon icon={ChevronRight} size={14} color={theme.textMuted} />
        </HStack>
      </Pressable>
    </DetailCard>
  );
}
