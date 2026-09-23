import { useRouter } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { Alert, FlatList, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EventsEmptyState } from "@/components/events/events-empty-state";
import { NotificationRow } from "@/components/notification-row";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { NotificationItem } from "@/types/notification";
import type { OrganizationSummary } from "@/types/organization";

/**
 * The bell, opened. Rows span every organization, as on the dashboard, so
 * tapping one switches to its organization before going there.
 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { organizations, select } = useCurrentOrganization();
  const refetchOrganizations = useOrganizations().refetch;

  const feed = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const pullToRefresh = usePullToRefresh(feed.refetch);

  const items = feed.data?.items ?? [];
  const unreadCount = feed.data?.unreadCount ?? 0;

  const onMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onError: (error) => Alert.alert("Couldn't mark as read", failureMessage(error)),
    });
  };

  const open = async (item: NotificationItem) => {
    const belongs = (list: OrganizationSummary[] | undefined) =>
      list?.some((candidate) => candidate.id === item.organizationId) ?? false;

    // Re-checked against a fresh list, for an organization joined on another device.
    if (!belongs(organizations) && !belongs((await refetchOrganizations()).data)) {
      Alert.alert("Not available", "You're no longer a member of this organization.");
      feed.refetch();
      return;
    }

    if (item.unread) markRead.mutate(item.id);

    select(item.organizationId);

    // A pending invitee can't open the event page yet, so they answer from the
    // events list — the same split the dashboard's links make.
    router.dismissTo(
      item.category === "AWAITING_RESPONSE"
        ? { pathname: "/", params: { tab: "pending" } }
        : `/events/${item.eventId}`,
    );
  };

  return (
    <VStack className="flex-1 bg-grouped">
      <HStack
        className="items-center gap-4 border-b px-4 pb-2.5"
        style={{
          backgroundColor: theme.card,
          borderColor: theme.border,
          // A pageSheet modal already sits below the status bar on iOS.
          paddingTop: Platform.OS === "ios" ? 14 : insets.top + 10,
        }}
      >
        <Text className="flex-1 text-[16px] font-semibold text-foreground">
          Notifications
        </Text>

        {unreadCount > 0 ? (
          <Pressable onPress={onMarkAllRead} accessibilityRole="button" hitSlop={8}>
            <Text className="text-[15px]" style={{ color: brand.orange }}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text className="text-[15px] font-semibold" style={{ color: brand.orange }}>
            Done
          </Text>
        </Pressable>
      </HStack>

      <FlatList<NotificationItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
        ItemSeparatorComponent={() => <Divider style={{ marginLeft: 62 }} />}
        renderItem={({ item, index }) => (
          <Box
            className={`border-x border-border bg-card ${
              index === 0 ? "rounded-t-2xl border-t" : ""
            } ${index === items.length - 1 ? "rounded-b-2xl border-b" : ""}`}
          >
            <NotificationRow item={item} onPress={() => open(item)} />
          </Box>
        )}
        ListEmptyComponent={
          feed.isError ? (
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load notifications"
              body="Pull down to try again."
              tone="error"
            />
          ) : feed.isPending ? (
            <Box className="flex-1 items-center justify-center">
              <Spinner color={theme.textMuted} />
            </Box>
          ) : (
            <EventsEmptyState
              icon={Bell}
              title="No notifications"
              body="You're all caught up!"
            />
          )
        }
      />
    </VStack>
  );
}
