import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import type { NotificationFeed, NotificationItem } from "@/types/notification";

/**
 * Under `["organizations", userId]`, so membership writes already expire it.
 * Event writes expire it by name.
 */
export const notificationsKey = (userId: string | null | undefined) => [
  "organizations",
  userId,
  "notifications",
];

/**
 * The caller's bell across every organization — the same feed the dashboard
 * navbar reads. Refetches on returning to the foreground, since nothing pushes
 * a row somebody else caused to the phone.
 */
export function useNotifications() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: notificationsKey(userId),
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
    queryFn: () => apiGet<NotificationFeed>("/api/mobile/v1/notifications"),
  });
}

/** The feed as it will read once the server has cleared the matching rows. */
function markRead(
  feed: NotificationFeed,
  matches: (item: NotificationItem) => boolean,
): NotificationFeed {
  let cleared = 0;

  const items = feed.items.map((item) => {
    if (!item.unread || !matches(item)) return item;
    cleared += 1;
    return { ...item, unread: false };
  });

  return { items, unreadCount: Math.max(feed.unreadCount - cleared, 0) };
}

/**
 * Optimistic, so the badge drops on tap. The refetch afterwards restores the
 * server's unread-first order.
 */
function useMarkRead<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  apply: (feed: NotificationFeed, variables: TVariables) => NotificationFeed,
) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const key = notificationsKey(userId);

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<NotificationFeed>(key);

      queryClient.setQueryData<NotificationFeed>(key, (feed) =>
        feed ? apply(feed, variables) : feed,
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useMarkNotificationRead() {
  return useMarkRead(
    (notificationId: string) =>
      apiPost<{ success: true }>(
        `/api/mobile/v1/notifications/${notificationId}/read`,
      ),
    (feed, notificationId) =>
      markRead(feed, (item) => item.id === notificationId),
  );
}

export function useMarkAllNotificationsRead() {
  return useMarkRead(
    () => apiPost<{ success: true }>("/api/mobile/v1/notifications/read"),
    // Includes rows past the feed's cap, which only the count knows about.
    (feed) => ({ ...markRead(feed, () => true), unreadCount: 0 }),
  );
}
