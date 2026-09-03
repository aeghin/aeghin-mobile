import ChevronRight from "lucide-react-native/icons/chevron-right";
import MessagesSquare from "lucide-react-native/icons/messages-square";

import { AppIcon } from "@/components/app-icon";
import {
  DetailCard,
  DetailCardHeader,
  DetailCount,
} from "@/components/events/event-detail-parts";
import { OrgAvatar } from "@/components/org-avatar";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useChatHistory } from "@/hooks/use-event-chat";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { formatActivityTime } from "@/lib/events/format";
import type { ServiceType } from "@/types/event";

type EventChatCardProps = {
  organizationId: string;
  eventId: string;
  service: ServiceType;
  onOpen: () => void;
};

/**
 * The chat's doorway on the event screen: the latest message and who said
 * it. Reads the cached first page only — no socket opens until the chat
 * itself does.
 */
export function EventChatCard({ organizationId, eventId, service, onOpen }: EventChatCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);
  const history = useChatHistory(organizationId, eventId);

  const latest = history.data?.messages[0];
  const canPost = history.data?.viewer.canPost ?? false;

  return (
    <DetailCard>
      <DetailCardHeader
        icon={MessagesSquare}
        title="Event chat"
        tint={colors.base}
        trailing={
          history.data ? (
            <DetailCount>{canPost ? "You can post" : "View only"}</DetailCount>
          ) : undefined
        }
      />

      <Divider />

      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Open event chat"
        className="data-[active=true]:bg-border/40"
      >
        <HStack className="items-center gap-3 px-3.5 py-3">
          {history.isPending ? (
            <>
              <Skeleton variant="circular" startColor="bg-border" style={{ width: 32, height: 32 }} />
              <VStack className="flex-1 gap-1.5">
                <Skeleton startColor="bg-border" style={{ width: 120, height: 11 }} />
                <Skeleton startColor="bg-border" style={{ width: 200, height: 11 }} />
              </VStack>
            </>
          ) : latest ? (
            <>
              <OrgAvatar
                name={`${latest.author.firstName} ${latest.author.lastName}`}
                logoUrl={latest.author.userImageUrl}
                size={32}
                shape="circle"
              />
              <VStack className="flex-1">
                <HStack className="items-baseline gap-1.5">
                  <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
                    {`${latest.author.firstName} ${latest.author.lastName}`.trim()}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {formatActivityTime(latest.createdAt)}
                  </Text>
                </HStack>
                <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
                  {latest.body}
                </Text>
              </VStack>
            </>
          ) : (
            <Text className="flex-1 text-[13px] text-muted-foreground">
              {history.isError
                ? "Couldn't load the chat."
                : canPost
                  ? "No messages yet. Say hello to the team."
                  : "No messages yet."}
            </Text>
          )}

          <AppIcon icon={ChevronRight} size={14} color={theme.textMuted} />
        </HStack>
      </Pressable>
    </DetailCard>
  );
}
