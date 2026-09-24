import { useAuth } from "@clerk/expo";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import { useCurrentOrganization } from "@/components/organization-provider";
import { useOrganizations } from "@/hooks/use-organizations";
import { obtainPushToken, registerPushToken, unregisterPushToken } from "@/lib/push";
import type { OrganizationSummary } from "@/types/organization";
import type { PushData } from "@/types/push";

/** The notification's `data`, checked, or null when it isn't one of ours. */
function pushDataOf(notification: Notifications.Notification): PushData | null {
  const data = notification.request.content.data;

  if (!data) return null;

  const { type, organizationId, eventId, token } = data;

  if (type === "organization-invite") {
    return typeof token === "string" ? { type, token } : null;
  }

  if (typeof organizationId !== "string") return null;

  if ((type === "event" || type === "invitation") && typeof eventId === "string") {
    return { type, organizationId, eventId };
  }

  // A type this build predates still belongs to an organization.
  return { type: "organization", organizationId };
}

/** Marks stale whatever a notification is about, so an open screen redraws. */
function refreshFor(queryClient: QueryClient, userId: string, data: PushData) {
  queryClient.invalidateQueries({ queryKey: ["organizations", userId, "notifications"] });

  if (data.type === "organization-invite") {
    queryClient.invalidateQueries({ queryKey: ["my-invitations", userId] });
    return;
  }

  const { organizationId } = data;

  queryClient.invalidateQueries({
    queryKey: ["organizations", userId, "user-events", organizationId],
  });
  queryClient.invalidateQueries({
    queryKey: ["organizations", userId, "org-events", organizationId],
  });

  if (data.type === "event" || data.type === "invitation") {
    queryClient.invalidateQueries({
      queryKey: ["organizations", userId, "event-details", organizationId, data.eventId],
    });
  }
}

/**
 * Push notifications for the whole app. Registers this phone while somebody is
 * signed in and unregisters it when they sign out, refreshes what a
 * notification is about when one arrives, and opens it when tapped.
 *
 * `ready` is the root stack's auth guard: a tap that launched the app waits
 * for it, and for the organizations, before navigating.
 */
export function PushNotifications({ ready }: { ready: boolean }) {
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { organizations, isPending, select } = useCurrentOrganization();
  const refetchOrganizations = useOrganizations().refetch;

  const registered = useRef<string | null>(null);
  const unregistering = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (isSignedIn === undefined) return;

    if (!isSignedIn) {
      const token = registered.current;
      registered.current = null;

      if (token) {
        unregistering.current = unregisterPushToken(token).catch(() => {});
        // The last account's notifications shouldn't outlive it on this phone.
        Notifications.dismissAllNotificationsAsync().catch(() => {});
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
      }
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const token = await obtainPushToken();

        if (!token || cancelled) return;

        registered.current = token;

        // A sign-out's unregister must not land after this and undo it.
        await unregistering.current;
        await registerPushToken(token);
      } catch (error) {
        if (__DEV__) console.warn("Push registration failed", error);
      }
    };

    // Deliberately not re-run from `addPushTokenListener`: that event fires on
    // every token request, this one included, so re-registering from it loops
    // forever. A token that rotates is picked up on the next launch.
    register();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!userId) return;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = pushDataOf(notification);
      if (data) refreshFor(queryClient, userId, data);
    });

    return () => subscription.remove();
  }, [userId, queryClient]);

  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || !ready || isPending || !userId) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const id = response.notification.request.identifier;

    if (handled.current === id) return;

    handled.current = id;
    // Otherwise a remount would open it a second time.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});

    const data = pushDataOf(response.notification);

    if (!data) return;

    refreshFor(queryClient, userId, data);

    if (data.type === "organization-invite") {
      router.push(`/invite/${data.token}`);
      return;
    }

    const open = async () => {
      const belongs = (list: OrganizationSummary[] | undefined) =>
        list?.some((candidate) => candidate.id === data.organizationId) ?? false;

      // Re-checked against a fresh list, for an organization joined since it loaded.
      if (!belongs(organizations) && !belongs((await refetchOrganizations()).data)) {
        Alert.alert("Not available", "You're no longer a member of this organization.");
        return;
      }

      select(data.organizationId);

      // The same moves the bell makes: an event page pushes, and the list is
      // dismissed back to, so an open event page doesn't stack another.
      if (data.type === "event") {
        router.push(`/events/${data.eventId}`);
      } else if (data.type === "invitation") {
        router.dismissTo({ pathname: "/", params: { tab: "pending" } });
      } else {
        router.dismissTo("/");
      }
    };

    open();
  }, [
    response,
    ready,
    isPending,
    userId,
    queryClient,
    router,
    organizations,
    refetchOrganizations,
    select,
  ]);

  return null;
}
