import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiGet, apiPost } from "@/lib/api";
import type {
  EventDetails,
  InvitationStatus,
  OrganizationEvent,
} from "@/types/event";

type EventsResponse = {
  events: OrganizationEvent[];
};

type EventDetailsResponse = {
  event: EventDetails;
};

/** Shared by the detail query and the mutation that has to expire it. */
const eventDetailsKey = (
  userId: string | null | undefined,
  orgId: string,
  eventId: string,
) => ["organizations", userId, "event-details", orgId, eventId];

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

/**
 * One event in full — the detail screen's only request.
 *
 * The route answers 404 to anybody who may not read the event, which is a
 * manager or somebody who has *accepted* an assignment. A pending invitation
 * is not yet a way in, so the invitation card only offers the screen to
 * managers; see `src/app/(tabs)/(events)/index.tsx`.
 *
 * Keyed beside the two list queries so answering an invitation can expire all
 * three together, and so signing out clears this with everything else.
 */
export function useEventDetails(orgId: string, eventId: string) {
  const { userId } = useAuth();

  useEffect(() => {
    if (__DEV__ && (!orgId || !eventId)) {
      console.warn(
        "useEventDetails: called without an orgId or eventId; query disabled.",
      );
    }
  }, [eventId, orgId]);

  return useQuery({
    queryKey: eventDetailsKey(userId, orgId, eventId),
    enabled: Boolean(userId && orgId && eventId),
    queryFn: async () => {
      const { event } = await apiGet<EventDetailsResponse>(
        `/api/mobile/v1/organizations/${orgId}/events/${eventId}`,
      );
      return event;
    },
  });
}

/** The two answers an invitation takes. */
export type InvitationResponse = "accept" | "decline";

export type RespondVariables = {
  eventId: string;
  action: InvitationResponse;
};

/**
 * Accepts or declines one of the caller's own invitations.
 *
 * The route this posts to calls the same server actions the web dashboard
 * does, so declining here also runs smart scheduling, writes the activity
 * entry, and emails whoever gets invited in your place.
 *
 * Answered optimistically: the card moves the moment the button is pressed,
 * because watching an invitation leave the Pending tab is most of what the tab
 * is for. A failure puts the list back exactly as it was and the screen says
 * why.
 *
 * No retries. A decline is not safe to repeat — the second one would find
 * nothing pending, but the smart-fill it triggered has already invited
 * somebody.
 */
export function useRespondToInvitation(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const userEventsKey = ["organizations", userId, "user-events", orgId];
  const orgEventsKey = ["organizations", userId, "org-events", orgId];

  return useMutation({
    mutationFn: ({ eventId, action }: RespondVariables) =>
      apiPost<{ status: InvitationStatus }>(
        `/api/mobile/v1/organizations/${orgId}/events/${eventId}/respond`,
        { action },
      ),
    retry: false,
    onMutate: async ({ eventId, action }: RespondVariables) => {
      // An in-flight refetch would otherwise land after this patch and undo it.
      await queryClient.cancelQueries({ queryKey: userEventsKey });

      const previous =
        queryClient.getQueryData<OrganizationEvent[]>(userEventsKey);

      queryClient.setQueryData<OrganizationEvent[]>(userEventsKey, (events) =>
        events ? applyAnswer(events, eventId, action) : events,
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Rolls back from here rather than from the caller: this has to run even
      // if the screen went away while the request was in flight.
      if (context?.previous) {
        queryClient.setQueryData(userEventsKey, context.previous);
      }
    },
    onSettled: (_data, _error, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: userEventsKey });
      // Accepting fills one of the event's roles, which is what the All tab's
      // staffing meter counts. A member's copy of this query is disabled, and
      // invalidating a disabled query refetches nothing.
      queryClient.invalidateQueries({ queryKey: orgEventsKey });
      // The answer changes a row on the event's own roster, and declining can
      // add somebody else's. Nothing is patched into this one by hand: a
      // decline's replacement is the server's to pick, so the screen would be
      // guessing at half the change.
      queryClient.invalidateQueries({
        queryKey: eventDetailsKey(userId, orgId, eventId),
      });
    },
  });
}

/** The cached list as it will read once the server has agreed. */
function applyAnswer(
  events: OrganizationEvent[],
  eventId: string,
  action: InvitationResponse,
): OrganizationEvent[] {
  const status: InvitationStatus =
    action === "accept" ? "ACCEPTED" : "DECLINED";

  return events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          assignments: event.assignments.map((assignment) =>
            assignment.status === "PENDING"
              ? { ...assignment, status }
              : assignment,
          ),
        }
      : event,
  );
}
