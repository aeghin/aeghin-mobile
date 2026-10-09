import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import Pencil from "lucide-react-native/icons/pencil";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useEffect, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Dialog } from "@/components/dialog";
import { EventChatCard } from "@/components/events/event-chat-card";
import {
  EventDetailHero,
  EventDetailHeroSkeleton,
} from "@/components/events/event-detail-hero";
import { EventSetlistCard } from "@/components/events/event-setlist-card";
import { EventPager } from "@/components/events/event-pager";
import { EventSmartSchedulingCard } from "@/components/events/event-smart-scheduling-card";
import { EventTeamCard } from "@/components/events/event-team-card";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { VocalistDialog } from "@/components/events/vocalist-dialog";
import { ErrorBanner } from "@/components/form-fields";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useNowPlayingInset, useTrackPlayer } from "@/components/track-player-provider";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useSmartSchedulingAvailable } from "@/hooks/use-billing";
import {
  useCancelAssignment,
  useDeleteEvent,
  useDeleteExpiredAssignment,
  useEventDetails,
  usePrefetchEventDetails,
  useRemoveEventRole,
  useResendAssignment,
} from "@/hooks/use-events";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useRoles } from "@/hooks/use-roles";
import { useSongKeys } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { getServiceColors } from "@/lib/config/service-types";
import type { Roles } from "@/lib/config/volunteer-roles";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type {
  EventDetailsAssignment,
  EventNeighbor,
  EventSetlistSong,
  VolunteerRole,
} from "@/types/event";

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
function describeConfirm(confirm: Confirm, roles: Roles) {
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
        description: `${name} will be taken off ${roles.get(role).label}.`,
        label: "Remove",
      };
    }

    case "deleteExpired": {
      const { user, role } = confirm.assignment;
      const name = personName(user);

      return {
        title: "Delete expired invite",
        description: `${name}'s expired ${roles.get(role).label} invitation comes off the roster, and the role reads as needing someone again.`,
        label: "Delete",
      };
    }

    case "removeRole":
      return {
        title: "Remove role",
        description: `${roles.get(confirm.role).label} will come off this event's roster.`,
        label: "Remove",
      };
  }
}

/**
 * One event in full.
 *
 * The sections are the dashboard's, in the order its grid falls back to on a
 * narrow viewport: what this is and when and where, what auto-fill has been
 * doing, the setlist, the team, the chat.
 *
 * Every manager action sits on the section it changes — the setlist's editor
 * on the setlist card, the roster's on the Team card — and the two that change
 * the *whole* event hang off the hero's ⋮, which is where the dashboard keeps
 * them too.
 */
export default function EventDetailScreen() {
  const theme = useTheme();
  const roles = useRoles();
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
  const autoFillAvailable = useSmartSchedulingAvailable(organizationId);

  // Offering the one-tap save comes off this event's roster rather than off
  // the membership's volunteer roles — if you're singing here you get it, and
  // the roster is already loaded. The dashboard reads it the same way.
  const canSaveKeys = event
    ? event.assignments.some(
        (assignment) =>
          assignment.userId === event.viewer.userId &&
          assignment.status === "ACCEPTED" &&
          roles.get(assignment.role).sings,
      )
    : false;

  // Their own journal, so each setlist row can say whether this key is already
  // in it. Nobody else's request is made: a player who doesn't sing here never
  // asks for one.
  const songKeys = useSongKeys(organizationId, { enabled: canSaveKeys });

  const [vocalistsFor, setVocalistsFor] = useState<EventSetlistSong | null>(null);

  const { play: playTrack } = useTrackPlayer();
  const nowPlayingInset = useNowPlayingInset();

  const scrollRef = useRef<ScrollView>(null);
  const prefetchEvent = usePrefetchEventDetails(organizationId);
  const serviceColors = event ? getServiceColors(event.serviceType.color, theme) : null;

  // The step in flight. Until its event arrives it names the header at once,
  // rather than the title falling back to "Event" for a frame.
  const [stepping, setStepping] = useState<EventNeighbor | null>(null);
  const pendingStep =
    stepping && !details.isError && event?.id !== stepping.id ? stepping : null;

  // The same screen with a new event, rather than a screen pushed per step:
  // Back still means the list, not whichever event came before.
  const step = (target: EventNeighbor) => {
    setStepping(target);
    router.setParams({ eventId: target.id });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const previousId = event?.adjacent?.previous?.id;
  const nextId = event?.adjacent?.next?.id;

  // Warm both neighbours once this event is up, so a step lands at once rather
  // than on the skeleton. Free while a cached copy is still fresh.
  useEffect(() => {
    if (nextId) prefetchEvent(nextId);
    if (previousId) prefetchEvent(previousId);
  }, [nextId, previousId, prefetchEvent]);

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

  const confirmWords = confirm ? describeConfirm(confirm, roles) : null;

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen
        options={{
          title: event?.name ?? pendingStep?.name ?? "Event",
          headerBackTitle: "Events",
        }}
      />

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + nowPlayingInset,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        // The team card's dialogs render inside this scroll view, and a touch
        // reaches it before them. Without this, the first tap on Cancel or Send
        // while typing only put the keyboard away, and needed tapping twice.
        keyboardShouldPersistTaps="handled"
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
          // Keyed so each card starts fresh when a step swaps the event.
          <VStack key={event.id} className="gap-4">
            <EventDetailHero
              event={event}
              pager={
                event.adjacent &&
                serviceColors &&
                (event.adjacent.previous || event.adjacent.next) ? (
                  <EventPager
                    previous={event.adjacent.previous}
                    next={event.adjacent.next}
                    serviceName={event.serviceType.name}
                    service={serviceColors}
                    onStep={step}
                  />
                ) : undefined
              }
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
                available={autoFillAvailable}
                items={event.smartSchedulingActivity}
                service={event.serviceType}
              />
            ) : null}

            <EventSetlistCard
              setlist={event.setlist}
              service={event.serviceType}
              onSongPress={event.viewer.canManage ? setVocalistsFor : undefined}
              onEdit={
                event.viewer.canManage
                  ? () => router.push(`/events/${event.id}/setlist`)
                  : undefined
              }
              onPlayTrack={playTrack}
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
  return <EventDetailHeroSkeleton />;
}
