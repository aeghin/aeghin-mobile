import { Stack, useLocalSearchParams } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { useCurrentOrganization } from "@/components/organization-provider";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useEventDetails } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";

/** How much page the tab bar covers once the list has scrolled under it. */
const TAB_BAR_CLEARANCE = 64;

/**
 * One event in full.
 *
 * The sections are the dashboard's, in the order its grid falls back to on a
 * narrow viewport: what this is, what auto-fill has been doing, when and
 * where, the setlist, and the team.
 *
 * Everything here reads. Inviting, editing, the setlist editor and the event
 * chat are still the dashboard's, and the route deliberately ships nothing
 * that would let this screen half-do one of them.
 */
export default function EventDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // `eventId` is this screen's own segment, not an ancestor's, so it resolves
  // here — the trap that leaves a query permanently disabled needs a `[param]`
  // above the screen reading it.
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  // The organization comes from the provider, not from the URL: the tabs are
  // permanent and have no `[id]` segment above them.
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const details = useEventDetails(organizationId, eventId ?? "");
  const event = details.data;

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
          // Lets a short state centre itself instead of hugging the header.
          flexGrow: 1,
        }}
        // The nav bar is opaque and the content already starts below it.
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

            {/* Managers only, and it hides itself when there is nothing to
                report — a member's payload carries an empty log either way. */}
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
            />

            <EventTeamCard
              assignments={event.assignments}
              rolesNeeded={event.rolesNeeded}
              currentUserId={event.viewer.userId}
              service={event.serviceType}
            />
          </VStack>
        )}
      </ScrollView>
    </VStack>
  );
}

/**
 * Why the event isn't on screen.
 *
 * A 404 is the interesting one, and it is not only "no such event": the route
 * answers it to anybody who may not read this event, so a volunteer who was
 * taken off the roster lands here too. The wording covers both without
 * claiming which, because the server deliberately does not say.
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
