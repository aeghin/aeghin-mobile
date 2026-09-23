import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import Pencil from "lucide-react-native/icons/pencil";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Dialog } from "@/components/dialog";
import { EventChatCard } from "@/components/events/event-chat-card";
import {
  EventDetailHero,
  EventDetailHeroSkeleton,
} from "@/components/events/event-detail-hero";
import { EventSetlistCard } from "@/components/events/event-setlist-card";
import { EventSmartSchedulingCard } from "@/components/events/event-smart-scheduling-card";
import { EventTeamCard } from "@/components/events/event-team-card";
import {
  EventWhenWhereCard,
  EventWhenWhereCardSkeleton,
} from "@/components/events/event-when-where-card";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { VocalistDialog } from "@/components/events/vocalist-dialog";
import { ErrorBanner } from "@/components/form-fields";
import { useCurrentOrganization } from "@/components/organization-provider";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useCancelAssignment,
  useDeleteEvent,
  useDeleteExpiredAssignment,
  useEventDetails,
  useRemoveEventRole,
  useResendAssignment,
} from "@/hooks/use-events";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSongKeys } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { getServiceColors } from "@/lib/config/service-types";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type { EventDetailsAssignment, EventSetlistSong, VolunteerRole } from "@/types/event";

/** How much page the tab bar covers once the list has scrolled under it. */
const TAB_BAR_CLEARANCE = 64;

/**
 * What a manager is being asked to confirm.
 *
 * It carries its own words rather than pointing back at the event, because the
 * dialog outlives the answer: {@link Dialog} keeps its children mounted so the
 * card has something to fade out, and a descriptor cleared on close would fade
 * a blank card.
 */
type Confirm =
  | { kind: "deleteEvent"; name: string }
  | { kind: "removeAssignment"; assignment: EventDetailsAssignment }
  | { kind: "deleteExpired"; assignment: EventDetailsAssignment }
  | { kind: "removeRole"; role: VolunteerRole };

/** What each one says. Every case is destructive and none of them is undoable. */
function describeConfirm(confirm: Confirm) {
  switch (confirm.kind) {
    case "deleteEvent":
      return {
        title: "Delete event",
        description: `${confirm.name} and its roster, setlist and chat will be deleted. This can't be undone.`,
        label: "Delete",
      };

    case "removeAssignment": {
      const { user, role } = confirm.assignment;
      const name = personName(user);

      return {
        title: "Remove from event",
        description: `${name} will be taken off ${getVolunteerRoleConfig(role).label}.`,
        label: "Remove",
      };
    }

    case "deleteExpired": {
      const { user, role } = confirm.assignment;
      const name = personName(user);

      return {
        title: "Delete expired invite",
        description: `${name}'s expired ${getVolunteerRoleConfig(role).label} invitation comes off the roster, and the role reads as needing someone again.`,
        label: "Delete",
      };
    }

    case "removeRole":
      return {
        title: "Remove role",
        description: `${getVolunteerRoleConfig(confirm.role).label} will come off this event's roster.`,
        label: "Remove",
      };
  }
}

/**
 * One event in full.
 *
 * The sections are the dashboard's, in the order its grid falls back to on a
 * narrow viewport: what this is, what auto-fill has been doing, when and
 * where, the setlist, the team, the chat.
 *
 * Every manager action sits on the section it changes — the setlist's editor
 * on the setlist card, the roster's on the Team card — and the two that change
 * the *whole* event hang off the hero's ⋮, which is where the dashboard keeps
 * them too.
 */
export default function EventDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // `eventId` is this screen's own segment, not an ancestor's, so it resolves
  // here — the trap that leaves a query permanently disabled needs a `[param]`
  // above the screen reading it.
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const details = useEventDetails(organizationId, eventId ?? "");
  const pullToRefresh = usePullToRefresh(details.refetch);
  const event = details.data;

  // A 404 is authoritative: the event is gone, so a cached copy must stop
  // being shown. Every other failure leaves the cache alone — `isError` goes
  // true on a failed *refetch* too, and dropping a rendered event because a
  // pull-to-refresh timed out loses something the phone still has.
  const eventGone = details.error instanceof ApiError && details.error.status === 404;

  const cancelAssignment = useCancelAssignment(organizationId, eventId ?? "");
  const resendInvite = useResendAssignment(organizationId, eventId ?? "");
  const deleteExpired = useDeleteExpiredAssignment(organizationId, eventId ?? "");
  const removeRole = useRemoveEventRole(organizationId, eventId ?? "");
  const removeEvent = useDeleteEvent(organizationId, eventId ?? "");

  // Offering the one-tap save comes off this event's roster rather than off
  // the membership's volunteer roles — if you're singing here you get it, and
  // the roster is already loaded. The dashboard reads it the same way.
  const canSaveKeys = event
    ? event.assignments.some(
        (assignment) =>
          assignment.userId === event.viewer.userId &&
          assignment.status === "ACCEPTED" &&
          (assignment.role === "LEAD_VOCALIST" || assignment.role === "BGVS"),
      )
    : false;

  // Their own journal, so each setlist row can say whether this key is already
  // in it. Nobody else's request is made: a player who doesn't sing here never
  // asks for one.
  const songKeys = useSongKeys(organizationId, { enabled: canSaveKeys });

  const [vocalistsFor, setVocalistsFor] = useState<EventSetlistSong | null>(null);

  // `confirm` is what the dialog *says*; `confirmOpen` is whether it is up.
  // Two pieces rather than one nullable, so closing does not blank the card
  // it is still fading out.
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const ask = (next: Confirm) => {
    setConfirmError(null);
    setConfirm(next);
    setConfirmOpen(true);
  };

  // A failure keeps the dialog up and says why, rather than closing and
  // leaving the roster looking as though the removal worked.
  const failed = (error: unknown) => setConfirmError(failureMessage(error));

  const runConfirm = () => {
    if (!confirm) return;

    switch (confirm.kind) {
      case "deleteEvent":
        removeEvent.mutate(undefined, {
          onSuccess: () => {
            setConfirmOpen(false);

            // A deep link opens this screen with nothing behind it, and there
            // `back()` is a no-op that would leave you sitting on an event
            // that no longer exists. The events tab is `/`.
            if (router.canGoBack()) router.back();
            else router.replace("/");
          },
          onError: failed,
        });
        return;

      case "removeAssignment":
        cancelAssignment.mutate(confirm.assignment.userId, {
          onSuccess: () => setConfirmOpen(false),
          onError: failed,
        });
        return;

      case "deleteExpired":
        deleteExpired.mutate(confirm.assignment.userId, {
          onSuccess: () => setConfirmOpen(false),
          onError: failed,
        });
        return;

      case "removeRole":
        removeRole.mutate(confirm.role, {
          onSuccess: () => setConfirmOpen(false),
          onError: failed,
        });
    }
  };

  const confirmBusy =
    confirm?.kind === "deleteEvent"
      ? removeEvent.isPending
      : confirm?.kind === "removeRole"
        ? removeRole.isPending
        : confirm?.kind === "deleteExpired"
          ? deleteExpired.isPending
          : cancelAssignment.isPending;

  const confirmWords = confirm ? describeConfirm(confirm) : null;

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen
        options={{
          title: event?.name ?? "Event",
          headerBackTitle: "Events",
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
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
        {details.isLoadingError || eventGone ? (
          <Unavailable error={details.error} />
        ) : !event ? (
          <DetailLoading />
        ) : (
          <VStack className="gap-4">
            <EventDetailHero
              event={event}
              actions={
                event.viewer.canManage
                  ? [
                      {
                        icon: Pencil,
                        label: "Edit details",
                        onPress: () => router.push(`/events/${event.id}/edit`),
                      },
                      {
                        icon: Trash2,
                        label: "Delete event",
                        onPress: () =>
                          ask({ kind: "deleteEvent", name: event.name }),
                        destructive: true,
                      },
                    ]
                  : undefined
              }
            />

            {event.viewer.canManage ? (
              <EventSmartSchedulingCard
                enabled={event.smartSchedulingEnabled}
                items={event.smartSchedulingActivity}
              />
            ) : null}

            <EventWhenWhereCard
              dates={event.dates}
              location={event.location}
              service={event.serviceType}
              rehearsalStart={event.rehearsalStart}
              rehearsalEnd={event.rehearsalEnd}
            />

            <EventSetlistCard
              setlist={event.setlist}
              service={event.serviceType}
              onSongPress={event.viewer.canManage ? setVocalistsFor : undefined}
              onEdit={
                event.viewer.canManage
                  ? () => router.push(`/events/${event.id}/setlist`)
                  : undefined
              }
              organizationId={organizationId}
              canSaveKeys={canSaveKeys}
              myKeys={songKeys.data}
            />

            <EventTeamCard
              organizationId={organizationId}
              event={event}
              onRemoveAssignment={
                event.viewer.canManage
                  ? (assignment) => ask({ kind: "removeAssignment", assignment })
                  : undefined
              }
              onRemoveRole={
                event.viewer.canManage
                  ? (role) => ask({ kind: "removeRole", role })
                  : undefined
              }
              onResendInvite={
                event.viewer.canManage
                  ? (assignment) =>
                      resendInvite.mutate(assignment.userId, {
                        onError: (error) =>
                          Alert.alert("Couldn't resend", failureMessage(error)),
                      })
                  : undefined
              }
              onDeleteExpired={
                event.viewer.canManage
                  ? (assignment) => ask({ kind: "deleteExpired", assignment })
                  : undefined
              }
            />

            <EventChatCard
              organizationId={organizationId}
              eventId={event.id}
              service={event.serviceType}
              onOpen={() => router.push(`/events/${event.id}/chat`)}
            />
          </VStack>
        )}
      </ScrollView>

      {confirmWords ? (
        <Dialog
          visible={confirmOpen}
          icon={CircleAlert}
          tone="destructive"
          title={confirmWords.title}
          description={confirmWords.description}
          action={{ label: confirmWords.label, onPress: runConfirm }}
          submitting={confirmBusy}
          onClose={() => setConfirmOpen(false)}
        >
          {confirmError ? <ErrorBanner message={confirmError} /> : null}
        </Dialog>
      ) : null}

      {event ? (
        <VocalistDialog
          song={vocalistsFor}
          onClose={() => setVocalistsFor(null)}
          organizationId={organizationId}
          eventId={event.id}
          assignments={event.assignments}
          colors={getServiceColors(event.serviceType.color, theme)}
        />
      ) : null}
    </VStack>
  );
}

/**
 * Why the event isn't on screen. A 404 is "no such event" or "not yours to
 * read" — the server deliberately does not say which.
 */
function Unavailable({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <EventsEmptyState
        icon={CircleSlash}
        title="Event unavailable"
        body="It may have been deleted, or you're no longer on it."
      />
    );
  }

  return (
    <EventsEmptyState
      icon={CircleAlert}
      title="Couldn't load event"
      body="Pull down to try again."
      tone="error"
    />
  );
}

function DetailLoading() {
  return (
    <VStack className="gap-4">
      <EventDetailHeroSkeleton />
      <EventWhenWhereCardSkeleton />
    </VStack>
  );
}
