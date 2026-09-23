import { useRouter } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import { Alert, ScrollView } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { NotificationRow } from "@/components/notification-row";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useExpireUserEvents } from "@/hooks/use-events";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { useOrganizations } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { NotificationItem } from "@/types/notification";
import type { OrganizationSummary } from "@/types/organization";

/**
 * The bell, opened: the dashboard's dropdown, part for part. Rows span every
 * organization, so tapping one switches to its organization before going there.
 *
 * `onSelect` closes the menu and runs what it is given once the menu is gone —
 * navigating, or an alert, can't present while the menu's modal is dismissing.
 */
export function NotificationsMenu({
  maxListHeight,
  onSelect,
}: {
  maxListHeight: number;
  onSelect: (action: () => void) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { organizations, select } = useCurrentOrganization();
  const refetchOrganizations = useOrganizations().refetch;
  const expireUserEvents = useExpireUserEvents();

  const feed = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

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

    if (item.category !== "AWAITING_RESPONSE") {
      router.push(`/events/${item.eventId}`);
      return;
    }

    // Nothing refetches the list on resume, so it can predate this row.
    expireUserEvents(item.organizationId);

    // A pending invitee can't open the event page yet, so they answer from the
    // events list — the same split the dashboard's links make. `dismissTo`, so
    // an event page already open pops back to the list instead of stacking one.
    router.dismissTo({ pathname: "/", params: { tab: "pending" } });
  };

  return (
    <VStack>
      <HStack className="items-center justify-between px-4 py-3">
        <Text className="text-[15px] font-semibold text-foreground">Notifications</Text>

        {unreadCount > 0 ? (
          <Pressable
            onPress={onMarkAllRead}
            accessibilityRole="button"
            hitSlop={8}
            className="data-[active=true]:opacity-60"
          >
            <Text className="text-[13px] font-medium" style={{ color: brand.orange }}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </HStack>

      <Divider />

      {items.length > 0 ? (
        <ScrollView style={{ maxHeight: maxListHeight }} bounces={false}>
          {items.map((item, index) => (
            <VStack key={item.id}>
              {index > 0 ? <Divider style={{ marginLeft: 62 }} /> : null}
              <NotificationRow item={item} onPress={() => onSelect(() => open(item))} />
            </VStack>
          ))}
        </ScrollView>
      ) : feed.isLoadingError ? (
        <VStack className="items-center gap-2 py-10">
          <Text className="text-[14px] font-medium text-muted-foreground">
            Couldn&apos;t load notifications
          </Text>
          <Pressable
            onPress={() => feed.refetch()}
            accessibilityRole="button"
            hitSlop={8}
            className="data-[active=true]:opacity-60"
          >
            <Text className="text-[13px] font-medium" style={{ color: brand.orange }}>
              Try again
            </Text>
          </Pressable>
        </VStack>
      ) : !feed.data ? (
        <Center className="py-10">
          <Spinner color={theme.textMuted} />
        </Center>
      ) : (
        // Honest, because rows are deleted once the roster is fixed rather
        // than left behind to be marked read.
        <VStack className="items-center py-10">
          <Center className="mb-3 h-12 w-12 rounded-full bg-surface">
            <AppIcon icon={Bell} size={20} color={theme.textMuted} />
          </Center>
          <Text className="text-[14px] font-medium text-muted-foreground">
            No notifications
          </Text>
          <Text className="mt-1 text-[12px] text-muted-foreground">
            You&apos;re all caught up!
          </Text>
        </VStack>
      )}
    </VStack>
  );
}
