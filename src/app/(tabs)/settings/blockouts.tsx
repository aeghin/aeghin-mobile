import { Stack, useRouter } from "expo-router";
import CalendarOff from "lucide-react-native/icons/calendar-off";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Plus from "lucide-react-native/icons/plus";
import Trash2 from "lucide-react-native/icons/trash-2";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { BlockoutCalendar } from "@/components/blockout-calendar";
import { DateRangePicker } from "@/components/date-range-picker";
import { Dialog } from "@/components/dialog";
import { Pill } from "@/components/events/chips";
import { AvatarStack } from "@/components/events/event-detail-parts";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { SegmentedControl, type Segment } from "@/components/events/segmented-control";
import { ErrorBanner, Field } from "@/components/form-fields";
import { InsetCard, InsetRow } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useNowPlayingInset } from "@/components/track-player-provider";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useAddBlockout,
  useBlockouts,
  useDeleteBlockout,
  useTeamBlockouts,
} from "@/hooks/use-blockouts";
import { useChurchClock } from "@/hooks/use-church-clock";
import { useUserEvents } from "@/hooks/use-events";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { blockoutDays, eventBlockDays } from "@/lib/blockouts";
import { canManageOrg } from "@/lib/config/roles";
import { dayKey, daysBetween, formatShortDate, shiftMonth } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import { capitalizeName } from "@/lib/names";
import type { Blockout, TeamBlockout } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/** How far ahead the calendar steps: a blockout can run up to a year out. */
const MONTHS_AHEAD = 12;

/** `"Sun, Aug 30"` or `"Sun, Aug 30 – Wed, Sep 2"`, plus how long that is. */
function describe(range: { startDate: string; endDate: string }): { label: string; value: string } {
  const start = dayKey(range.startDate);
  const end = dayKey(range.endDate);
  const days = daysBetween(start, end) + 1;
  const label =
    start === end
      ? formatShortDate(range.startDate)
      : `${formatShortDate(range.startDate)} – ${formatShortDate(range.endDate)}`;
  return { label, value: `${days} ${days === 1 ? "day" : "days"}` };
}

type Pane = "mine" | "team";

/** A section's small caps heading, as the Events screen heads its Expired list. */
function SectionHeading({ children }: { children: string }) {
  return (
    <Text className="ml-1 text-[11px] font-bold uppercase tracking-[0.7px] text-muted-foreground">
      {children}
    </Text>
  );
}

/**
 * The dashboard's Blockouts tab: days you cannot be scheduled, on a calendar
 * beside the days you are. Owners and admins get a second pane for who else is
 * away — split rather than stacked, so neither needs a long scroll, the way
 * Songs gives vocalists a Keys pane. Smart scheduling and the invite picker
 * both refuse to book across a blockout.
 */
export default function BlockoutsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nowPlayingInset = useNowPlayingInset();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const blockouts = useBlockouts(organizationId);
  const team = useTeamBlockouts(organizationId, canManage);
  // The Events screen's own request, so the dots usually cost nothing.
  const userEvents = useUserEvents(organizationId);
  const remove = useDeleteBlockout(organizationId);
  const [adding, setAdding] = useState(false);
  const [pane, setPane] = useState<Pane>("mine");
  // A member has only their own; a role change mid-visit falls back to it.
  const activePane: Pane = canManage ? pane : "mine";

  const refetchBlockouts = blockouts.refetch;
  const refetchTeam = team.refetch;
  const refetchUserEvents = userEvents.refetch;
  const pullToRefresh = usePullToRefresh(() =>
    Promise.all([refetchBlockouts(), refetchUserEvents(), canManage ? refetchTeam() : null]),
  );

  // The church's today, which outlines a day and dims the ones before it.
  const { today } = useChurchClock([]);
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);

  const rows = blockouts.data ?? [];
  const blocked = new Set(rows.flatMap((b) => blockoutDays(b.startDate, b.endDate)));
  // Days you said yes to. Pending invites aren't on your schedule yet.
  const scheduled = new Set(
    (userEvents.data ?? [])
      .filter((event) => event.assignments.some((a) => a.status === "ACCEPTED"))
      .flatMap((event) => event.dates.flatMap((d) => eventBlockDays(d.startTime, d.endTime))),
  );

  // The Team pane's count is what needs attention there, not how many are away.
  const gapCount = (team.data ?? []).reduce((total, group) => total + group.gaps.length, 0);
  const panes: Segment<Pane>[] = [
    { value: "mine", label: "Mine" },
    {
      value: "team",
      label: "Team",
      count: gapCount > 0 ? gapCount : undefined,
      dot: gapCount > 0 ? theme.warning : undefined,
      accessibilityLabel:
        gapCount > 0 ? `Team, ${gapCount} ${gapCount === 1 ? "event" : "events"} short` : "Team",
    },
  ];

  const confirmDelete = (blockout: Blockout) =>
    Alert.alert("Remove blockout", `${describe(blockout).label} will be open for scheduling again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(blockout.id, {
            onError: (error) => Alert.alert("Couldn't remove", failureMessage(error)),
          }),
      },
    ]);

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Blockouts", headerBackTitle: "Settings" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + nowPlayingInset,
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
        <VStack className="gap-4">
          {canManage ? <SegmentedControl segments={panes} value={activePane} onChange={setPane} /> : null}

          {activePane === "team" ? (
            <VStack className="gap-2">
              <SectionHeading>Next 60 days</SectionHeading>
              <TeamSection team={team.data} isPending={team.isPending} isError={team.isError} />
            </VStack>
          ) : (
            <>
              {/* First thing on the pane, so adding one is in the same place
                  whether the list below is empty or long. */}
              <Button
                variant="outline"
                onPress={() => setAdding(true)}
                className="h-auto rounded-2xl border-dashed border-border py-3.5"
              >
                <AppIcon icon={Plus} size={20} color={brand.orange} />
                <ButtonText className="text-base font-semibold text-brand">Add blockout</ButtonText>
              </Button>

              <BlockoutCalendar
                month={month}
                onMonthChange={setMonth}
                firstMonth={thisMonth}
                lastMonth={shiftMonth(thisMonth, MONTHS_AHEAD - 1)}
                blocked={blocked}
                scheduled={scheduled}
                today={today}
              />

              <VStack className="gap-2">
                <SectionHeading>Your blockouts</SectionHeading>

                {blockouts.isError ? (
                  <EventsEmptyState
                    icon={CircleAlert}
                    title="Couldn't load blockouts"
                    body="Pull down to try again."
                    tone="error"
                  />
                ) : blockouts.isPending ? (
                  <VStack className="items-center py-6">
                    <Spinner color={theme.textMuted} />
                  </VStack>
                ) : rows.length === 0 ? (
                  <InsetCard elevated>
                    <Pressable
                      onPress={() => setAdding(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Add blockout"
                      className="px-3.5 py-3.5 data-[active=true]:opacity-60"
                    >
                      <Text className="text-[14px] text-muted-foreground">
                        {"None yet. Add the days you can't serve and scheduling will work around them."}
                      </Text>
                    </Pressable>
                  </InsetCard>
                ) : (
                  <InsetCard elevated separatorInset={14}>
                    {rows.map((blockout) => {
                      const { label, value } = describe(blockout);
                      return (
                        <InsetRow
                          key={blockout.id}
                          label={label}
                          value={value}
                          trailing={Trash2}
                          onPress={() => confirmDelete(blockout)}
                        />
                      );
                    })}
                  </InsetCard>
                )}
              </VStack>
            </>
          )}
        </VStack>
      </ScrollView>

      <AddBlockoutDialog
        key={String(adding)}
        visible={adding}
        onClose={() => setAdding(false)}
        organizationId={organizationId}
      />
    </VStack>
  );
}

/**
 * Who's away, one row per stretch of days with everybody away for exactly
 * that stretch — the dashboard's Team blockouts card. A row's pills are
 * events it leaves with an open spot nobody free can take; each opens it.
 */
function TeamSection({
  team,
  isPending,
  isError,
}: {
  team: TeamBlockout[] | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  const router = useRouter();

  if (isError) {
    return (
      <InsetCard elevated>
        <Text className="px-3.5 py-3.5 text-[14px] text-muted-foreground">
          {"Couldn't load the team's blockouts. Pull down to try again."}
        </Text>
      </InsetCard>
    );
  }

  if (isPending || !team) {
    return (
      <InsetCard elevated separatorInset={14}>
        {[0, 1].map((row) => (
          <VStack key={row} className="gap-2.5 px-3.5 py-3.5">
            <Skeleton startColor="bg-border" className="rounded-md" style={{ width: 180, height: 15 }} />
            <Skeleton startColor="bg-border" className="rounded-md" style={{ width: 130, height: 22 }} />
          </VStack>
        ))}
      </InsetCard>
    );
  }

  if (team.length === 0) {
    return (
      <InsetCard elevated>
        <Text className="px-3.5 py-3.5 text-[14px] text-muted-foreground">
          {"Nobody's away in the next 60 days."}
        </Text>
      </InsetCard>
    );
  }

  return (
    <InsetCard elevated separatorInset={14}>
      {team.map((group) => {
        const { label, value } = describe(group);
        // You first, as "You"; everybody else as they appear.
        const people = [...group.people].sort((a, b) => Number(b.isYou) - Number(a.isYou));
        const names = people
          .map((person) =>
            person.isYou ? "You" : capitalizeName(`${person.firstName} ${person.lastName}`.trim()),
          )
          .join(", ");

        return (
          <VStack key={`${group.startDate}-${group.endDate}`} className="gap-2 px-3.5 py-3">
            <HStack className="items-baseline justify-between gap-3">
              <Text className="flex-1 text-[15px] font-semibold text-foreground">{label}</Text>
              <Text className="text-[12px] text-muted-foreground">{value}</Text>
            </HStack>

            <HStack className="items-center gap-2">
              <AvatarStack people={people} size={22} />
              <Text className="flex-1 text-[13px] text-muted-foreground" numberOfLines={2}>
                {names}
              </Text>
            </HStack>

            {group.gaps.length > 0 ? (
              <HStack className="flex-wrap gap-1.5 pt-0.5">
                {group.gaps.map((gap) => (
                  <Pressable
                    key={gap.text}
                    onPress={() => router.push(`/events/${gap.eventId}`)}
                    accessibilityRole="link"
                    accessibilityLabel={`${gap.text}. Opens the event.`}
                    className="data-[active=true]:opacity-60"
                  >
                    <Pill label={gap.text} tone="warning" icon={TriangleAlert} />
                  </Pressable>
                ))}
              </HStack>
            ) : null}
          </VStack>
        );
      })}
    </InsetCard>
  );
}

function AddBlockoutDialog({
  visible,
  onClose,
  organizationId,
}: {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const add = useAddBlockout(organizationId);
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [error, setError] = useState<string | null>(null);

  const start = range.start;
  const end = range.end ?? range.start;

  const submit = () => {
    if (!start || !end) return;
    setError(null);
    add.mutate(
      { startDate: start, endDate: end },
      { onSuccess: onClose, onError: (failure) => setError(failureMessage(failure)) },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={CalendarOff}
      title="Add blockout"
      description="Days you can't serve. Scheduling will work around them."
      action={{ label: "Add", onPress: submit, disabled: !start }}
      submitting={add.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <Field
        label="Dates"
        hint={
          !start
            ? "Tap a day, or tap a start and an end for a span."
            : start === end
              ? `${formatShortDate(`${start}T00:00:00Z`)} — tap another day to make it a span.`
              : `${formatShortDate(`${start}T00:00:00Z`)} – ${formatShortDate(`${end}T00:00:00Z`)}`
        }
      >
        <DateRangePicker value={range} onChange={setRange} />
      </Field>
    </Dialog>
  );
}
