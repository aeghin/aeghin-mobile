import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EventChatCard } from "@/components/events/event-chat-card";
import {
  EventDetailHero,
  EventDetailHeroSkeleton,
} from "@/components/events/event-detail-hero";
import { EventManageCard } from "@/components/events/event-manage-card";
import { EventSetlistCard } from "@/components/events/event-setlist-card";
import { EventSmartSchedulingCard } from "@/components/events/event-smart-scheduling-card";
import { EventTeamCard } from "@/components/events/event-team-card";
import {
  EventWhenWhereCard,
  EventWhenWhereCardSkeleton,
} from "@/components/events/event-when-where-card";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { VocalistDialog } from "@/components/events/vocalist-dialog";
import { useCurrentOrganization } from "@/components/organization-provider";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useCancelAssignment,
  useEventDetails,
  useRemoveEventRole,
} from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { getServiceColors } from "@/lib/config/service-types";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { failureMessage } from "@/lib/failure";
import type { EventDetailsAssignment, EventSetlistSong, VolunteerRole } from "@/types/event";

/** How much page the tab bar covers once the list has scrolled under it. */
const TAB_BAR_CLEARANCE = 64;

/**
 * One event in full.
 *
 * The sections are the dashboard's, in the order its grid falls back to on a
 * narrow viewport: what this is, what auto-fill has been doing, when and
 * where, the setlist, the team, the chat — and, for managers, the actions the
 * web puts in the header.
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
  const event = details.data;

  const cancelAssignment = useCancelAssignment(organizationId, eventId ?? "");
  const removeRole = useRemoveEventRole(organizationId, eventId ?? "");

  const [vocalistsFor, setVocalistsFor] = useState<EventSetlistSong | null>(null);

  const confirmRemoveAssignment = (assignment: EventDetailsAssignment) => {
    const name = `${assignment.user.firstName} ${assignment.user.lastName}`.trim();
    Alert.alert(
      "Remove from event",
      `${name} will be taken off ${getVolunteerRoleConfig(assignment.role).label}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            cancelAssignment.mutate(assignment.userId, {
              onError: (error) => Alert.alert("Couldn't remove", failureMessage(error)),
            }),
        },
      ],
    );
  };

  const confirmRemoveRole = (role: VolunteerRole) =>
    Alert.alert(
      "Remove role",
      `${getVolunteerRoleConfig(role).label} will come off this event's roster.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeRole.mutate(role, {
              onError: (error) => Alert.alert("Couldn't remove", failureMessage(error)),
            }),
        },
      ],
    );

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
            refreshing={details.isRefetching}
            onRefresh={details.refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {details.isError ? (
          <Unavailable error={details.error} />
        ) : details.isPending || !event ? (
          <DetailLoading />
        ) : (
          <VStack className="gap-4">
            <EventDetailHero event={event} />

            {event.viewer.canManage ? (
              <EventSmartSchedulingCard
                enabled={event.smartSchedulingEnabled}
                items={event.smartSchedulingActivity}
                expiredCount={event.expiredInviteCount}
              />
            ) : null}

            <EventWhenWhereCard
              dates={event.dates}
              location={event.location}
              service={event.serviceType}
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
            />

            <EventTeamCard
              assignments={event.assignments}
              rolesNeeded={event.rolesNeeded}
              currentUserId={event.viewer.userId}
              service={event.serviceType}
              onRemoveAssignment={event.viewer.canManage ? confirmRemoveAssignment : undefined}
              onRemoveRole={event.viewer.canManage ? confirmRemoveRole : undefined}
            />

            <EventChatCard
              organizationId={organizationId}
              eventId={event.id}
              service={event.serviceType}
              onOpen={() => router.push(`/events/${event.id}/chat`)}
            />

            {event.viewer.canManage ? (
              <EventManageCard organizationId={organizationId} event={event} />
            ) : null}
          </VStack>
        )}
      </ScrollView>

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
