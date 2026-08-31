import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import type { AppSymbolName } from "@/components/app-symbol";
import { DayHeading } from "@/components/events/day-heading";
import {
  EventCard,
  EventCardSkeleton,
} from "@/components/events/event-card";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import {
  MonthStepper,
  ScopeFilter,
  ServiceFilter,
} from "@/components/events/events-filter-bar";
import {
  PendingEventCard,
  PendingEventCardSkeleton,
  type PendingAction,
} from "@/components/events/pending-event-card";
import {
  SegmentedControl,
  type Segment,
} from "@/components/events/segmented-control";
import { UpNextCard } from "@/components/events/up-next-card";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Skeleton } from "@/components/ui/skeleton";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useOrgEvents, useUserEvents } from "@/hooks/use-events";
import { useServiceTypes } from "@/hooks/use-service-types";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { currentMonthKey, formatMonth, todayKey } from "@/lib/events/format";
import {
  assignmentFor,
  findUpNext,
  groupByDay,
  isEventPast,
  isInScope,
  scopeUsesMonth,
  type EventsTab,
  type TimeScope,
} from "@/lib/events/schedule";
import type {
  InvitationStatus,
  OrganizationEvent,
  ServiceType,
} from "@/types/event";

/** How much page the tab bar covers once the list has scrolled under it. */
const TAB_BAR_CLEARANCE = 64;

const SYMBOL = {
  caughtUp: { ios: "checkmark.seal.fill", android: "task_alt" },
  calendar: { ios: "calendar", android: "calendar_month" },
  filter: { ios: "line.3.horizontal.decrease", android: "filter_list" },
  error: { ios: "exclamationmark.triangle.fill", android: "warning" },
} satisfies Record<string, AppSymbolName>;

/** Stable identity, so an empty result does not remake the array each render. */
const NO_EVENTS: OrganizationEvent[] = [];

/** Same, for an organization that has not defined a service type yet. */
const NO_SERVICES: ServiceType[] = [];

export default function EventsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // The organization comes from the provider, not from a route param: the tabs
  // are permanent and have no `[id]` segment above them to read.
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  // Three requests, because they answer to different people: the caller's own
  // events, the whole organization's — managers only — and the service types
  // that colour both.
  const userEvents = useUserEvents(organizationId);
  const orgEvents = useOrgEvents(organizationId, canManage);
  const serviceTypes = useServiceTypes(organizationId);

  // ── View state ────────────────────────────────────────────────────────
  // A null tab means the viewer has not chosen one; the screen picks below.
  const [tab, setTab] = useState<EventsTab | null>(null);
  const [scope, setScope] = useState<TimeScope>("upcoming");
  const [month, setMonth] = useState(currentMonthKey);
  const [serviceId, setServiceId] = useState<string | null>(null);

  // ── Answering an invitation ───────────────────────────────────────────
  // Still local to this screen: accept and decline have no route yet, so an
  // answer moves the card here and the next refetch forgets it.
  const [answers, setAnswers] = useState<Record<string, PendingAction>>({});
  const [busy, setBusy] = useState<{ id: string; action: PendingAction } | null>(
    null,
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = useCallback((run: () => void, ms: number) => {
    timers.current.push(setTimeout(run, ms));
  }, []);

  const answer = useCallback(
    (id: string, action: PendingAction) => {
      setBusy({ id, action });
      // A beat of latency, so the button's loading state is something you can
      // actually see rather than a frame that flashes past.
      later(() => {
        setAnswers((current) => ({ ...current, [id]: action }));
        setBusy(null);
      }, 650);
    },
    [later],
  );

  const refetchUserEvents = userEvents.refetch;
  const refetchOrgEvents = orgEvents.refetch;
  const refetchServiceTypes = serviceTypes.refetch;

  const refresh = useCallback(() => {
    // Answers live only in this component, so a refresh has to drop them:
    // what comes back is what the server actually holds.
    setAnswers({});
    refetchUserEvents();
    refetchServiceTypes();
    // Refetching by hand fires even a disabled query, and the roster-wide list
    // is not a member's to ask for.
    if (canManage) {
      refetchOrgEvents();
    }
  }, [canManage, refetchOrgEvents, refetchServiceTypes, refetchUserEvents]);

  const services = serviceTypes.data ?? NO_SERVICES;
  // A first load and a failed one both have nothing behind them, and an empty
  // list is what the counts and the tabs below should read in either case.
  const myEvents = applyAnswers(userEvents.data ?? NO_EVENTS, answers);
  const allEvents = applyAnswers(orgEvents.data ?? NO_EVENTS, answers);

  const today = todayKey();
  const serviceById = new Map(services.map((service) => [service.id, service]));

  const matchesService = (event: OrganizationEvent) =>
    !serviceId || event.serviceTypeId === serviceId;

  const inPeriod = (event: OrganizationEvent) =>
    isInScope(event, scope, month, today) &&
    (scope === "past" || !isEventPast(event, today));

  const isInvitation = (event: OrganizationEvent) =>
    assignmentFor(event, "PENDING") !== null && !isEventPast(event, today);

  const invitations = myEvents.filter(isInvitation);
  const accepted = myEvents.filter(
    (event) => assignmentFor(event, "ACCEPTED") !== null,
  );

  // Until the viewer picks a tab, the screen opens on the one that wants
  // something from them. Derived rather than set from an effect, so the frame
  // the data arrives on is already right instead of correcting itself a render
  // later — and read off the server's list rather than the answered view, so
  // answering the last invitation leaves you on the tab you answered it on
  // instead of pulling the page out from under you.
  const chosenTab =
    tab ??
    ((userEvents.data ?? NO_EVENTS).some(isInvitation)
      ? "pending"
      : "schedule");

  // A tab can vanish under you when the role changes; derive rather than
  // correct after the fact, so there is never a frame pointing at nothing.
  const activeTab: EventsTab =
    chosenTab === "all" && !canManage ? "schedule" : chosenTab;

  // The All tab is a different request from the two beside it, so each waits
  // on its own: neither should hold the other's skeleton on the screen.
  const source = activeTab === "all" ? orgEvents : userEvents;

  // The counts on the control answer "is there anything for me here at all",
  // so they ignore the filters below them — a count that moved when you tapped
  // a chip would stop being an answer to that question.
  const counts = {
    pending: userEvents.isPending ? undefined : invitations.length,
    schedule: userEvents.isPending
      ? undefined
      : accepted.filter((event) => !isEventPast(event, today)).length,
    all: orgEvents.isPending
      ? undefined
      : allEvents.filter((event) => !isEventPast(event, today)).length,
  };

  const segments: Segment<EventsTab>[] = [
    {
      value: "pending",
      label: "Pending",
      count: counts.pending,
      dot: counts.pending ? theme.warning : undefined,
    },
    { value: "schedule", label: "Schedule", count: counts.schedule },
    ...(canManage
      ? [{ value: "all" as const, label: "All", count: counts.all }]
      : []),
  ];

  const visibleInvitations = invitations.filter(matchesService);

  const scheduled = (activeTab === "all" ? allEvents : accepted)
    .filter(matchesService)
    .filter(inPeriod);
  const groups = groupByDay(scheduled, scope, month, today);
  const nextKey = groups.find((group) => group.key >= today)?.key;

  // Only on the default period. Narrowed to a week or a month, a hero
  // announcing something outside that window contradicts the list under it.
  const upNext =
    activeTab === "schedule" && scope === "upcoming"
      ? findUpNext(accepted.filter(matchesService), today)
      : null;

  // The tabs layout redirects when there is no organization; this is only the
  // frame between that decision and the redirect committing.
  if (!organization) {
    return null;
  }

  const showPeriodControls = activeTab !== "pending";

  /**
   * The body under the controls, in the order the states rule each other out:
   * a failed load beats a pending one, a pending one beats whatever the tab
   * would otherwise show, and only then does the tab decide.
   */
  function content() {
    if (source.isError) {
      return (
        <EventsEmptyState
          symbol={SYMBOL.error}
          title="Couldn't load events"
          body="Pull down to try again."
          tone="error"
        />
      );
    }

    if (source.isPending) {
      return activeTab === "pending" ? <PendingLoading /> : <ScheduleLoading />;
    }

    if (activeTab === "pending") {
      if (visibleInvitations.length === 0) {
        return serviceId ? (
          <EventsEmptyState
            symbol={SYMBOL.filter}
            title="Nothing here"
            body="No invitations for this kind of service."
            action={{
              label: "Show all services",
              onPress: () => setServiceId(null),
            }}
          />
        ) : (
          <EventsEmptyState
            symbol={SYMBOL.caughtUp}
            title="You're all caught up"
            body="No invitations are waiting on you."
            tone="success"
          />
        );
      }

      return (
        <VStack className="gap-3 px-4">
          {visibleInvitations.map((event) => (
            <PendingEventCard
              key={event.id}
              event={event}
              service={serviceById.get(event.serviceTypeId)}
              today={today}
              busy={busy?.id === event.id ? busy.action : undefined}
              onAccept={() => answer(event.id, "accept")}
              onDecline={() => answer(event.id, "decline")}
            />
          ))}
        </VStack>
      );
    }

    return (
      <VStack className="gap-4">
        {upNext ? (
          <UpNextCard
            upNext={upNext}
            service={serviceById.get(upNext.event.serviceTypeId)}
          />
        ) : null}

        {groups.length === 0 ? (
          <EventsEmptyState
            {...emptyScheduleState({
              tab: activeTab,
              scope,
              month,
              filtered: serviceId !== null,
              clearFilter: () => setServiceId(null),
            })}
          />
        ) : (
          <VStack
            className="gap-5 px-4"
            // Every other period drops finished events, so a past day can only
            // ever appear here — which makes marking them one by one say
            // nothing the period selector hasn't. The whole list recedes
            // instead: still legible, plainly an archive, and quieter than the
            // live controls above it.
            style={scope === "past" ? { opacity: 0.6 } : undefined}
          >
            {groups.map((group) => (
              <VStack key={group.key} className="gap-2">
                <DayHeading
                  dayKey={group.key}
                  today={today}
                  isNext={group.key === nextKey}
                />

                {group.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    service={serviceById.get(event.serviceTypeId)}
                    showStaffing={activeTab === "all"}
                  />
                ))}
              </VStack>
            ))}
          </VStack>
        )}
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 bg-grouped">
      <AppHeader />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          // Lets a short state centre itself instead of hugging the controls.
          flexGrow: 1,
        }}
        // The nav bar is opaque and the list already starts below it.
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={
              userEvents.isRefetching ||
              orgEvents.isRefetching ||
              serviceTypes.isRefetching
            }
            onRefresh={refresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        <VStack className="gap-3">
          <Box className="px-4">
            <SegmentedControl
              segments={segments}
              value={activeTab}
              onChange={setTab}
            />
          </Box>

          {showPeriodControls ? (
            <ScopeFilter value={scope} onChange={setScope} />
          ) : null}

          {showPeriodControls && scopeUsesMonth(scope) ? (
            <MonthStepper value={month} onChange={setMonth} />
          ) : null}

          {services.length > 0 ? (
            <ServiceFilter
              services={services}
              value={serviceId}
              onChange={setServiceId}
            />
          ) : null}
        </VStack>

        <VStack className="flex-1 pt-4">{content()}</VStack>
      </ScrollView>
    </VStack>
  );
}

/**
 * Rewrites the assignments the viewer has answered in this session.
 *
 * Accepting an invitation is what moves an event from Pending to My Schedule,
 * and seeing that happen is most of what the Pending tab is for — but there is
 * no accept/decline route yet, so the answer lives here and the next refetch
 * forgets it. Goes out when the mutation lands.
 */
function applyAnswers(
  events: OrganizationEvent[],
  answers: Record<string, PendingAction>,
): OrganizationEvent[] {
  return events.map((event) => {
    const answered = answers[event.id];
    if (!answered) return event;

    const status: InvitationStatus =
      answered === "accept" ? "ACCEPTED" : "DECLINED";

    return {
      ...event,
      assignments: event.assignments.map((assignment) =>
        assignment.status === "PENDING" ? { ...assignment, status } : assignment,
      ),
    };
  });
}

function emptyScheduleState({
  tab,
  scope,
  month,
  filtered,
  clearFilter,
}: {
  tab: EventsTab;
  scope: TimeScope;
  month: string;
  filtered: boolean;
  clearFilter: () => void;
}) {
  if (filtered) {
    return {
      symbol: SYMBOL.filter,
      title: "Nothing here",
      body: "No events of this kind in the period you're looking at.",
      action: { label: "Show all services", onPress: clearFilter },
    };
  }

  if (scope === "past") {
    return {
      symbol: SYMBOL.calendar,
      title: "No past events",
      body: `Nothing on the calendar for ${formatMonth(month)}.`,
    };
  }

  return {
    symbol: SYMBOL.calendar,
    title: tab === "all" ? "No events" : "No scheduled events",
    body:
      tab === "all"
        ? "Nothing on the organization's calendar for this period."
        : "Nothing you've accepted falls in this period.",
  };
}

function PendingLoading() {
  return (
    <VStack className="gap-3 px-4">
      <PendingEventCardSkeleton />
      <PendingEventCardSkeleton />
    </VStack>
  );
}

/** Two short days rather than one long one — the real list is grouped. */
function ScheduleLoading() {
  return (
    <VStack className="gap-5 px-4">
      {[0, 1].map((group) => (
        <VStack key={group} className="gap-2">
          <Skeleton startColor="bg-border" style={{ width: 104, height: 13 }} />
          <EventCardSkeleton index={group * 2} />
          <EventCardSkeleton index={group * 2 + 1} />
        </VStack>
      ))}
    </VStack>
  );
}
