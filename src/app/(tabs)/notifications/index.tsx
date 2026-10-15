import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useCallback } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { HeaderCapsule } from "@/components/header-capsule";
import { InsetCard } from "@/components/inset-list";
import { InvitationNoticeRow, NotificationRow } from "@/components/notification-row";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useNowPlayingInset } from "@/components/track-player-provider";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useExpireUserEvents } from "@/hooks/use-events";
import { myInvitationsKey, useMyInvitations } from "@/hooks/use-my-invitations";
import {
  notificationsKey,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { useOpenInTabs } from "@/hooks/use-open-in-tabs";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { NotificationItem } from "@/types/notification";
import type { OrganizationSummary, PendingInvitation } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;
/** Past each row's icon, where the bell's list started its hairlines. */
const SEPARATOR_INSET = 62;

/**
 * The bell, as a tab: the dashboard's notifications dropdown, part for part.
 * Rows span every organization, so tapping one switches to its organization
 * before going there.
 */
export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nowPlayingInset = useNowPlayingInset();
  const router = useRouter();
  const openInTabs = useOpenInTabs();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { organizations, select } = useCurrentOrganization();
  const refetchOrganizations = useOrganizations().refetch;
  const expireUserEvents = useExpireUserEvents();

  const feed = useNotifications();
  const invitationsQuery = useMyInvitations();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Opening the tab refreshes a list gone stale, as opening the bell did.
  useFocusEffect(
    useCallback(() => {
      for (const queryKey of [notificationsKey(userId), myInvitationsKey(userId)]) {
        queryClient.refetchQueries({ queryKey, stale: true }, { cancelRefetch: false });
      }
    }, [queryClient, userId]),
  );

  const refetchFeed = feed.refetch;
  const refetchInvitations = invitationsQuery.refetch;
  const refresh = useCallback(
    () => Promise.all([refetchFeed(), refetchInvitations()]),
    [refetchFeed, refetchInvitations],
  );
  const pullToRefresh = usePullToRefresh(refresh);

  // Organizations asking to have you head the list, as on the dashboard.
  const invitations = invitationsQuery.data ?? [];
  const items = feed.data?.items ?? [];
  const unreadCount =
    (feed.data?.unreadCount ?? 0) + invitations.filter((invitation) => !invitation.seen).length;

  const onMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onError: (error) => Alert.alert("Couldn't mark as read", failureMessage(error)),
    });
  };

  // Answered on the picker, which lists every invitation waiting on you.
  const openInvitation = (invitation: PendingInvitation) => {
    if (!invitation.seen) markRead.mutate(invitation.id);
    router.push("/organizations");
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
      openInTabs.event(`/events/${item.eventId}`);
      return;
    }

    // Nothing refetches the list on resume, so it can predate this row.
    expireUserEvents(item.organizationId);

    // A pending invitee can't open the event page yet, so they answer from the
    // events list — the same split the dashboard's links make.
    openInTabs.list("pending");
  };

  return (
    <VStack className="flex-1 bg-grouped">
      <AppHeader
        actions={
          unreadCount > 0 ? (
            <Pressable
              onPress={onMarkAllRead}
              accessibilityRole="button"
              className="data-[active=true]:opacity-60"
            >
              <HeaderCapsule>
                <Text className="px-4 text-[15px] font-medium" style={{ color: brand.orange }}>
                  Mark all read
                </Text>
              </HeaderCapsule>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + nowPlayingInset,
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
      >
        {items.length > 0 || invitations.length > 0 ? (
          <InsetCard elevated separatorInset={SEPARATOR_INSET}>
            {invitations.map((invitation) => (
              <InvitationNoticeRow
                key={invitation.id}
                invitation={invitation}
                onPress={() => openInvitation(invitation)}
              />
            ))}
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onPress={() => open(item)} />
            ))}
          </InsetCard>
        ) : feed.isLoadingError ? (
          <EventsEmptyState
            icon={CircleAlert}
            title="Couldn't load notifications"
            body="Pull down to try again."
            tone="error"
          />
        ) : !feed.data ? (
          <Box className="flex-1 items-center justify-center">
            <Spinner color={theme.textMuted} />
          </Box>
        ) : (
          // Honest, because rows are deleted once the roster is fixed rather
          // than left behind to be marked read.
          <EventsEmptyState icon={Bell} title="No notifications" body="You're all caught up!" />
        )}
      </ScrollView>
    </VStack>
  );
}
