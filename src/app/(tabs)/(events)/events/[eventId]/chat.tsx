import { useLocalSearchParams, useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import MessagesSquare from "lucide-react-native/icons/messages-square";
import { useCallback, useEffect, useMemo } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { Composer, MessageRow } from "@/components/events/chat-parts";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useEventChat, useInvalidateChat } from "@/hooks/use-event-chat";
import { useEventDetails } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { ChatMessage } from "@/types/chat";

/**
 * The event chat, full screen.
 *
 * Presented as a modal so the tab bar is out of the way of the keyboard, with
 * its own header bar rather than the stack's — a hand-drawn bar has a known
 * height, which is what `KeyboardAvoidingView` needs to leave the composer
 * sitting on the keyboard rather than under or above it.
 */
export default function EventChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const details = useEventDetails(organizationId, eventId ?? "");
  const service = details.data?.serviceType;
  const colors = getServiceColors(service?.color ?? "indigo", theme);

  const chat = useEventChat(organizationId, eventId ?? "");
  const invalidateChat = useInvalidateChat(organizationId, eventId ?? "");

  // The preview card on the event screen reads the cached first page; leaving
  // refreshes it so the card shows what was said here.
  useEffect(() => () => void invalidateChat(), [invalidateChat]);

  // Newest first for the inverted list, which is what keeps the view pinned to
  // the bottom as messages arrive.
  const rows = useMemo(() => (chat.messages ? [...chat.messages].reverse() : []), [chat.messages]);

  const myId = chat.viewer?.userId;

  const send = useCallback(
    async (body: string) => {
      try {
        await chat.send(body);
      } catch (error) {
        Alert.alert("Couldn't send", failureMessage(error, "Couldn't send your message. Try again."));
        throw error;
      }
    },
    [chat],
  );

  const online = chat.presence.length;

  return (
    <VStack className="flex-1" style={{ backgroundColor: theme.card }}>
      <HStack
        className="items-center border-b px-4 pb-2.5"
        style={{
          borderColor: theme.border,
          // A pageSheet modal already sits below the status bar on iOS.
          paddingTop: Platform.OS === "ios" ? 14 : insets.top + 10,
        }}
      >
        <VStack className="flex-1">
          <Text className="text-[16px] font-semibold text-foreground" numberOfLines={1}>
            {details.data?.name ?? "Event chat"}
          </Text>
          <HStack className="items-center gap-1.5">
            <Box
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  chat.status === "connected" ? theme.success : theme.textMuted,
                opacity: chat.status === "connected" ? 1 : 0.5,
              }}
            />
            <Text className="text-[12px] text-muted-foreground">
              {chat.status === "connected"
                ? `${online} online`
                : chat.status === "connecting"
                  ? "Connecting…"
                  : "Reconnecting…"}
            </Text>
          </HStack>
        </VStack>

        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text className="text-[15px] font-semibold" style={{ color: brand.orange }}>
            Done
          </Text>
        </Pressable>
      </HStack>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {chat.isError ? (
          <Box className="flex-1 justify-center">
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load the chat"
              body="Check your connection and try again."
              tone="error"
              action={{ label: "Try again", onPress: () => chat.refetch() }}
            />
          </Box>
        ) : chat.isPending || !chat.messages ? (
          <Box className="flex-1 items-center justify-center">
            <Spinner color={theme.textMuted} />
          </Box>
        ) : (
          <FlatList<ChatMessage>
            data={rows}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardDismissMode="interactive"
            onEndReached={chat.hasMore ? () => void chat.loadOlder() : undefined}
            onEndReachedThreshold={0.4}
            renderItem={({ item, index }) => {
              // The list is inverted, so the message "above" is the next index.
              const above = rows[index + 1];
              return (
                <MessageRow
                  message={item}
                  isMe={item.author.id === myId}
                  colors={colors}
                  continued={
                    above !== undefined &&
                    above.author.id === item.author.id &&
                    minutesApart(above.createdAt, item.createdAt) < 5
                  }
                />
              );
            }}
            ListFooterComponent={
              chat.loadingOlder ? (
                <Box className="items-center py-3">
                  <Spinner size="small" color={theme.textMuted} />
                </Box>
              ) : null
            }
            ListEmptyComponent={
              <VStack className="items-center gap-2 px-8 py-16" style={{ transform: [{ scaleY: -1 }] }}>
                <AppIcon icon={MessagesSquare} size={30} color={theme.textMuted} />
                <Text className="text-[15px] font-semibold text-foreground">No messages yet</Text>
                <Text className="text-center text-[13px] text-muted-foreground">
                  {chat.viewer?.canPost
                    ? "Say hello to the team."
                    : "Nothing has been said here yet."}
                </Text>
              </VStack>
            }
          />
        )}

        {chat.viewer?.canPost ? (
          <Box style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
            <Composer colors={colors} onSend={send} />
          </Box>
        ) : chat.viewer ? (
          <Box
            className="mx-4 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: theme.surface, marginBottom: Math.max(insets.bottom, 8) }}
          >
            <Text className="text-center text-[12px] text-muted-foreground">
              {"You're previewing this chat as an organizer. Only assigned volunteers can reply."}
            </Text>
          </Box>
        ) : null}
      </KeyboardAvoidingView>
    </VStack>
  );
}

function minutesApart(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60_000;
}
