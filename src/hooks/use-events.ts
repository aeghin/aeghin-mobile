import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiGet } from "@/lib/api";
import type { OrganizationEvent } from "@/types/event";

type EventsResponse = {
  events: OrganizationEvent[];
};

/**
 * Every event in one organization the signed-in user has been invited to —
 * accepted and still pending, past and upcoming. Which of those belong on
 * which tab is the screen's decision, not this hook's.
 *
 * `userId` is in the key for cache scoping only; it is never sent, since the
 * server reads the caller from the token. Unlike the members roster this list
 * *is* the caller's, so two accounts on one device must not share an entry.
 *
 * Nesting under `["organizations", userId]` means invalidating the membership
 * list also invalidates this — the same trade `useOrganizationDetails` makes.
 */
export function useUserEvents(orgId: string) {
  const { userId } = useAuth();

  // A missing orgId leaves the query disabled, which reports as `pending`
  // forever — a spinner that never resolves and never errors. Say so out loud.
  useEffect(() => {
    if (__DEV__ && !orgId) {
      console.warn("useUserEvents: called without an orgId; query disabled.");
    }
  }, [orgId]);

  return useQuery({
    queryKey: ["organizations", userId, "user-events", orgId],
    enabled: Boolean(userId && orgId),
    queryFn: async () => {
      const { events } = await apiGet<EventsResponse>(
        `/api/mobile/v1/organizations/${orgId}/user-events`,
      );
      return events;
    },
  });
}

/**
 * Every event in one organization, whoever it belongs to — the All tab.
 *
 * Owners and admins only. The route answers 403 to a plain member, so
 * `canManage` gates the request rather than letting it fire and fail; that
 * also means a member's cache never holds a roster-wide list at all.
 *
 * Each event still carries the caller's own assignments — an event nobody
 * invited them to arrives with an empty array — plus `filledRoleCount`, which
 * is what the staffing meter on the card reads.
 */
export function useOrgEvents(orgId: string, canManage: boolean) {
  const { userId } = useAuth();

  useEffect(() => {
    if (__DEV__ && !orgId) {
      console.warn("useOrgEvents: called without an orgId; query disabled.");
    }
  }, [orgId]);

  return useQuery({
    queryKey: ["organizations", userId, "org-events", orgId],
    enabled: Boolean(userId && orgId && canManage),
    queryFn: async () => {
      const { events } = await apiGet<EventsResponse>(
        `/api/mobile/v1/organizations/${orgId}/events`,
      );
      return events;
    },
  });
}
