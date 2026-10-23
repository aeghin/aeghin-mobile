import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import FaceSlightlyFrowning from "lucide-react-native/icons/face-slightly-frowning";
import Pencil from "lucide-react-native/icons/pencil";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Dialog } from "@/components/dialog";
import { EventChatCard, EventChatCardSkeleton } from "@/components/events/event-chat-card";
import {
  EventDetailHero,
  EventDetailHeroSkeleton,
} from "@/components/events/event-detail-hero";
import {
  EventSetlistCard,
  EventSetlistCardSkeleton,
} from "@/components/events/event-setlist-card";
import { EventPager } from "@/components/events/event-pager";
import { EventSmartSchedulingCard } from "@/components/events/event-smart-scheduling-card";
import { EventTeamCard, EventTeamCardSkeleton } from "@/components/events/event-team-card";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { VocalistDialog } from "@/components/events/vocalist-dialog";
import { ErrorBanner } from "@/components/form-fields";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useNowPlayingInset, useTrackPlayer } from "@/components/track-player-provider";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useSmartSchedulingAvailable } from "@/hooks/use-billing";
import { useChurchClock } from "@/hooks/use-church-clock";
import { useChatHistory, usePrefetchChatHistory } from "@/hooks/use-event-chat";
import {
  useCancelAssignment,
  useDeleteEvent,
  useDeleteInvite,
  useEventDetails,
  usePrefetchEventDetails,
  useRemoveEventRole,
  useResendAssignment,
  useWithdrawFromEvent,
} from "@/hooks/use-events";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useRoles } from "@/hooks/use-roles";
import { useSongKeys } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { getServiceColors } from "@/lib/config/service-types";
import type { Roles } from "@/lib/config/volunteer-roles";
import { roleStanding, type RoleStanding } from "@/lib/events/spots";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type {
  EventDate,
  EventDetailsAssignment,
  EventNeighbor,
  VolunteerRole,
} from "@/types/event";

/** How much page the tab bar covers once the list has scrolled under it. */
const TAB_BAR_CLEARANCE = 64;

/** The clock's dates before the event has loaded. */
const NO_DATES: EventDate[] = [];

/**
 * What the viewer is being asked to confirm.
 *
 * It carries its own words rather than pointing back at the event, because the
 * dialog outlives the answer: {@link Dialog} keeps its children mounted so the
 * card has something to fade out, and a descriptor cleared on close would fade
 * a blank card.
 */
type Confirm =
  | { kind: "deleteEvent"; name: string }
  | { kind: "removeAssignment"; assignment: EventDetailsAssignment }
  | {
      kind: "deleteInvite";
      assignment: EventDetailsAssignment;
      /** The role as it stood when Delete was tapped, for what the dialog promises. */
      standing: RoleStanding;
    }
  | {
      kind: "removeRole";
      role: VolunteerRole;
      /** It still carries declined, removed or lapsed invites, which go with it. */
      withInvites: boolean;
    }
  | { kind: "withdraw"; name: string; role: VolunteerRole };

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

    case "deleteInvite": {
      const { user, role } = confirm.assignment;
      const { needed, open } = confirm.standing;
      const name = personName(user);
      const label = roles.get(role).label;

      // Their spot closes when it's still open and the role has others to keep.
      const effect =
        open === 0
          ? ""
          : needed > 1
            ? `, and ${label} will need ${needed - 1} instead of ${needed}`
            : `, and ${label} still needs someone`;

      // They declined, let it lapse, backed out or were taken off: there's no
      // invite left to delete, only their crossed-out row.
      return {
        title: "Remove person",
        description: `${name} comes off the roster${effect}.`,
        label: "Remove",
      };
    }

    case "removeRole":
      return {
        title: "Remove role",
        description: `${roles.get(confirm.role).label} will come off this event's roster.${
          confirm.withInvites ? " Its past invites go with it." : ""
        }`,
        label: "Remove",
      };

    case "withdraw":
      return {
        title: "Can't make it?",
        description: (
          <>
            {"You'll be taken off "}
            <Text className="font-semibold text-foreground">{roles.get(confirm.role).label}</Text>
            {" for "}
            <Text className="font-semibold text-foreground">{confirm.name}</Text>
            {", and whoever runs your team will be told."}
          </>
        ),
        label: "Take me off",
      };
  }
}

/**
 * One event in full.
 *
 * The sections are the dashboard's, in the order its grid falls back to on a
 * narrow viewport: what this is and when and where, what auto-fill has been
 * doing, the setlist, the team. The chat is the exception: one line right under
 * the top card, with its unread count, rather than a card at the very end.
 *
 * Every manager action sits on the section it changes — the setlist's editor
 * on the setlist card, the roster's on the Team card — and the two that change
 * the *whole* event hang off the hero's ⋮, which is where the dashboard keeps
 * them too. "Can't make it" sits in that ⋮ as well, tucked away rather than on
 * the roster, so nothing on the page invites backing out.
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

  // Asked for alongside the event rather than once the chat card mounts, so
  // the chat line fills with the rest of the page instead of after it.
  const chat = useChatHistory(organizationId, eventId ?? "");

  // A pull is the only re-read, so it takes the chat line with it.
  const refetchDetails = details.refetch;
  const refetchChat = chat.refetch;
  const refresh = useCallback(
    () => Promise.all([refetchDetails(), refetchChat()]),
    [refetchDetails, refetchChat],
  );
  const pullToRefresh = usePullToRefresh(refresh);
  const event = details.data;

  // A 404 is authoritative: the event is gone, so a cached copy must stop
  // being shown. Every other failure leaves the cache alone — `isError` goes
  // true on a failed *refetch* too, and dropping a rendered event because a
  // pull-to-refresh timed out loses something the phone still has.
  const eventGone = details.error instanceof ApiError && details.error.status === 404;

  const cancelAssignment = useCancelAssignment(organizationId, eventId ?? "");
  const resendInvite = useResendAssignment(organizationId, eventId ?? "");
  const deleteInvite = useDeleteInvite(organizationId, eventId ?? "");
  const removeRole = useRemoveEventRole(organizationId, eventId ?? "");
  const removeEvent = useDeleteEvent(organizationId, eventId ?? "");
  const withdraw = useWithdrawFromEvent(organizationId, eventId ?? "");
  const autoFillAvailable = useSmartSchedulingAvailable(organizationId);

  // "Can't make it" is offered until the event starts on the church's clock —
  // the rule the server holds to as well.
  const { now } = useChurchClock(event?.dates ?? NO_DATES);
  const ownSpot = event?.assignments.find(
    (assignment) =>
      assignment.userId === event.viewer.userId && assignment.status === "ACCEPTED",
  );
  const canWithdraw =
    !!ownSpot &&
    !event?.dates.some((date) => new Date(date.startTime).getTime() <= now.getTime());

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

  // Whose vocalists are up, by id, so the dialog reads each refetch. Held as
  // the row itself, it kept the singers as they were when it opened.
  const [vocalistsFor, setVocalistsFor] = useState<string | null>(null);

  const { play: playTrack } = useTrackPlayer();
  const nowPlayingInset = useNowPlayingInset();

  const scrollRef = useRef<ScrollView>(null);
  const prefetchEvent = usePrefetchEventDetails(organizationId);
  const prefetchChat = usePrefetchChatHistory(organizationId);
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
    for (const id of [nextId, previousId]) {
      if (!id) continue;
      prefetchEvent(id);
      prefetchChat(id);
    }
  }, [nextId, previousId, prefetchEvent, prefetchChat]);

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

  // A deep link opens this screen with nothing behind it, and there `back()`
  // is a no-op that would leave you sitting on an event you can't open any
  // more. The events tab is `/`.
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const runConfirm = () => {
    if (!confirm) return;

    switch (confirm.kind) {
      case "deleteEvent":
        removeEvent.mutate(undefined, {
          onSuccess: () => {
            setConfirmOpen(false);
            leave();
          },
          onError: failed,
        });
        return;

      case "withdraw": {
        // Only a manager can still open an event they're not on.
        const stays = event?.viewer.canManage ?? false;

        withdraw.mutate(
          { stays },
          {
            onSuccess: () => {
              setConfirmOpen(false);
              if (!stays) leave();
            },
            onError: failed,
          },
        );
        return;
      }

      case "removeAssignment":
        cancelAssignment.mutate(confirm.assignment.userId, {
          onSuccess: () => setConfirmOpen(false),
          onError: failed,
        });
        return;

      case "deleteInvite":
        deleteInvite.mutate(confirm.assignment.userId, {
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
      : confirm?.kind === "withdraw"
        ? withdraw.isPending
        : confirm?.kind === "removeRole"
          ? removeRole.isPending
          : confirm?.kind === "deleteInvite"
            ? deleteInvite.isPending
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
              actions={[
                ...(event.viewer.canManage
                  ? [
                      {
                        icon: Pencil,
                        label: "Edit details",
                        onPress: () => router.push(`/events/${event.id}/edit`),
                      },
                    ]
                  : []),
                ...(canWithdraw && ownSpot
                  ? [
                      {
                        icon: FaceSlightlyFrowning,
                        label: "Can't make it?",
                        onPress: () =>
                          ask({ kind: "withdraw", name: event.name, role: ownSpot.role }),
                        destructive: true,
                      },
                    ]
                  : []),
                ...(event.viewer.canManage
                  ? [
                      {
                        icon: Trash2,
                        label: "Delete event",
                        onPress: () =>
                          ask({ kind: "deleteEvent", name: event.name }),
                        destructive: true,
                      },
                    ]
                  : []),
              ]}
            />

            <EventChatCard
              organizationId={organizationId}
              eventId={event.id}
              service={event.serviceType}
              onOpen={() => router.push(`/events/${event.id}/chat`)}
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
              onSongPress={event.viewer.canManage ? (song) => setVocalistsFor(song.id) : undefined}
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
                  ? (role) =>
                      ask({
                        kind: "removeRole",
                        role,
                        withInvites: event.assignments.some(
                          (assignment) => assignment.role === role,
                        ),
                      })
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
              onDeleteInvite={
                event.viewer.canManage
                  ? (assignment) =>
                      ask({
                        kind: "deleteInvite",
                        assignment,
                        standing: roleStanding(
                          assignment.role,
                          event.roleSpots,
                          event.assignments,
                          Date.now(),
                        ),
                      })
                  : undefined
              }
              canWithdraw={canWithdraw}
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
          song={event.setlist.find((song) => song.id === vocalistsFor) ?? null}
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

/** The page's own order, so each card lands where its placeholder sat. */
function DetailLoading() {
  return (
    <VStack className="gap-4">
      <EventDetailHeroSkeleton />
      <EventChatCardSkeleton />
      <EventSetlistCardSkeleton />
      <EventTeamCardSkeleton />
    </VStack>
  );
}
