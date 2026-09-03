import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { DateRangePicker } from "@/components/date-range-picker";
import { TimeField } from "@/components/events/time-field";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useCheckAvailability, useEditEvent, useEventDetails } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import {
  dayKey,
  daysInRange,
  formatShortDate,
  formatTime,
  keyToDate,
} from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { EventDate, EventDetails, EventDetailsAssignment, NewEventDay } from "@/types/event";

const TAB_BAR_CLEARANCE = 64;

/** A day added by widening the range starts on the event's own first hours. */
type DayTimes = { startTime: string; endTime: string };

/** Somebody on the event who can't make the hours now being picked. */
type Clash = { userId: string; name: string; reason: string };

/** What the date picker reads and writes — a start, and an end once there is one. */
type DayRange = { start: string | null; end: string | null };

/** `"09:00"` — the clock face of an instant, read in UTC like everything else. */
const clockOf = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/** The event's stored dates, as the form's range and per-day hours. */
function seedFrom(dates: EventDate[]) {
  const sorted = [...dates].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const times: Record<string, DayTimes> = {};

  for (const date of sorted) {
    times[dayKey(date.startTime)] = {
      startTime: clockOf(date.startTime),
      endTime: clockOf(date.endTime),
    };
  }

  const keys = Object.keys(times);

  const range: DayRange = {
    start: keys[0] ?? null,
    end: keys.length > 1 ? keys[keys.length - 1] : null,
  };

  return { times, range };
}

/**
 * The dashboard's "edit event details" dialog, as a screen.
 *
 * A screen rather than a centred dialog because of what it holds: a month
 * grid and a row of time fields per day is more than a modal can show above
 * the keyboard. It is the create form's first step with the parts that are
 * not this dialog's business removed — the service type, the roles and the
 * roster each have their own control on the detail screen, and the web's
 * dialog leaves all three alone too.
 */
export default function EditEventScreen() {
  const theme = useTheme();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const details = useEventDetails(organizationId, eventId ?? "");

  if (details.isPending || !details.data) {
    return (
      <Box className="flex-1 items-center justify-center bg-grouped">
        <Stack.Screen options={{ title: "Edit event", headerBackTitle: "Event" }} />
        <Spinner color={theme.textMuted} />
      </Box>
    );
  }

  if (!details.data.viewer.canManage) {
    return (
      <VStack className="flex-1 items-center justify-center gap-2 bg-grouped px-8">
        <Stack.Screen options={{ title: "Edit event", headerBackTitle: "Event" }} />
        <AppIcon icon={CircleAlert} size={30} color={theme.textMuted} />
        <Text className="text-[15px] font-semibold text-foreground">Not available</Text>
        <Text className="text-center text-[13px] text-muted-foreground">
          Only an owner or admin can change an event&apos;s details.
        </Text>
      </VStack>
    );
  }

  return <EditForm key={details.data.id} organizationId={organizationId} event={details.data} />;
}

/**
 * Keyed on the event above, so every field takes its value from props once, on
 * mount — the same reason the setlist editor splits in two.
 */
function EditForm({
  organizationId,
  event,
}: {
  organizationId: string;
  event: EventDetails;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const seed = useMemo(() => seedFrom(event.dates), [event.dates]);

  const availability = useCheckAvailability(organizationId);
  const edit = useEditEvent(organizationId, event.id);

  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description);
  const [location, setLocation] = useState(event.location);
  const [range, setRange] = useState(seed.range);
  const [times, setTimes] = useState(seed.times);

  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<Clash[]>([]);

  // The hours a day keeps when the range grows past what the event stored.
  const fallback = seed.times[seed.range.start ?? ""] ?? { startTime: "10:00", endTime: "12:00" };

  const days = useMemo(
    () => (range.start ? daysInRange(range.start, range.end ?? range.start) : []),
    [range],
  );

  const timesFor = (day: string): DayTimes => times[day] ?? fallback;

  const setDayTime = (day: string, patch: Partial<DayTimes>) => {
    setClashes([]);
    setTimes((current) => ({ ...current, [day]: { ...timesFor(day), ...patch } }));
  };

  const changeRange = (next: DayRange) => {
    setClashes([]);
    setRange(next);
  };

  const payloadDays: NewEventDay[] = days.map((date) => ({ date, ...timesFor(date) }));

  const badOrder = payloadDays.find((day) => day.endTime <= day.startTime);

  const ready =
    name.trim().length > 0 && location.trim().length > 0 && days.length > 0 && !badOrder;

  // Who the change has to work for. Declined invitations are nobody's problem
  // any more, which is the same line the action draws server-side.
  const active: EventDetailsAssignment[] = event.assignments.filter(
    (assignment) => assignment.status !== "DECLINED",
  );

  const save = () =>
    edit.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim(),
        days: payloadDays,
      },
      {
        onSuccess: () => router.back(),
        onError: (failure) => setError(failureMessage(failure)),
      },
    );

  /**
   * Warn before saving, the way the dashboard does.
   *
   * The server refuses these dates anyway, naming the people — this only
   * gets the reason in front of the manager first, since "already serving at
   * Youth Night" is what tells them which way to move the event. A check that
   * itself fails is not a reason to block: the refusal still stands behind it.
   */
  const submit = () => {
    setError(null);
    setClashes([]);

    if (active.length === 0) {
      save();
      return;
    }

    availability.mutate(
      { days: payloadDays, excludeEventId: event.id },
      {
        onSuccess: (result) => {
          const found: Clash[] = [];

          for (const assignment of active) {
            const blockout = result.blockouts[assignment.userId];
            const conflict = result.conflicts[assignment.userId];

            if (!blockout && !conflict) continue;

            found.push({
              userId: assignment.userId,
              name: `${assignment.user.firstName} ${assignment.user.lastName}`.trim(),
              reason: blockout
                ? `Unavailable ${formatShortDate(blockout.startDate)} – ${formatShortDate(blockout.endDate)}`
                : `Already serving at ${conflict.eventName}, ${formatTime(conflict.startTime)}`,
            });
          }

          if (found.length > 0) {
            setClashes(found);
            return;
          }

          save();
        },
        onError: save,
      },
    );
  };

  const working = availability.isPending || edit.isPending;

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen
        options={{
          title: "Edit event",
          headerBackTitle: "Event",
          headerRight: () => (
            <Pressable
              onPress={submit}
              disabled={!ready || working}
              accessibilityRole="button"
              hitSlop={8}
            >
              {working ? (
                <Spinner size="small" color={brand.orange} />
              ) : (
                <Text
                  className="text-[16px] font-semibold"
                  style={{ color: ready ? brand.orange : theme.textMuted }}
                >
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <VStack className="gap-4">
          <ErrorBanner message={error} />

          {clashes.length > 0 ? <ClashBanner clashes={clashes} /> : null}

          <Text className="ml-1 text-[13px] text-muted-foreground">
            Changes apply to everyone already on this event. Its roster, setlist and chat
            stay as they are.
          </Text>

          <Field label="Name" hint="Up to 25 characters.">
            <FormInput
              value={name}
              onChangeText={setName}
              placeholder="Sunday Morning"
              autoCapitalize="words"
              maxLength={25}
            />
          </Field>

          <Field label="Description" hint="Optional.">
            <FormInput
              value={description}
              onChangeText={setDescription}
              placeholder="What the team should know…"
              multiline
            />
          </Field>

          <Field label="Location" hint="Up to 20 characters.">
            <FormInput
              value={location}
              onChangeText={setLocation}
              placeholder="Main Sanctuary"
              autoCapitalize="words"
              maxLength={20}
            />
          </Field>

          <Field
            label="Dates"
            hint={
              days.length === 0
                ? "Tap a day, or a start and an end for something running across days."
                : days.length === 1
                  ? formatShortDate(keyToDate(days[0]))
                  : `${days.length} days, ${formatShortDate(keyToDate(days[0]))} to ${formatShortDate(keyToDate(days[days.length - 1]))}`
            }
          >
            <DateRangePicker value={range} onChange={changeRange} />
          </Field>

          {days.length > 0 ? (
            <Field
              label="Times"
              error={badOrder ? "Each day has to end after it starts." : undefined}
              hint={days.length > 1 ? "Each day runs on its own hours." : undefined}
            >
              <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
                {days.map((day, index) => (
                  <VStack key={day}>
                    {index > 0 ? <Divider /> : null}
                    <VStack className="gap-2 px-3 py-2.5">
                      <Text className="text-[13px] font-semibold text-foreground">
                        {formatShortDate(keyToDate(day))}
                      </Text>
                      <HStack className="items-center gap-2">
                        <TimeField
                          value={timesFor(day).startTime}
                          onChange={(value) => setDayTime(day, { startTime: value })}
                          label="Start time"
                          context={formatShortDate(keyToDate(day))}
                        />
                        <Text className="text-[13px] text-muted-foreground">to</Text>
                        <TimeField
                          value={timesFor(day).endTime}
                          onChange={(value) => setDayTime(day, { endTime: value })}
                          label="End time"
                          context={formatShortDate(keyToDate(day))}
                        />
                      </HStack>
                    </VStack>
                  </VStack>
                ))}
              </VStack>
            </Field>
          ) : null}
        </VStack>
      </ScrollView>
    </VStack>
  );
}

/** Who the new dates don't work for, and why — the dashboard's amber warning. */
function ClashBanner({ clashes }: { clashes: Clash[] }) {
  const theme = useTheme();

  return (
    <VStack
      className="gap-1.5 rounded-2xl border p-3"
      style={{
        borderColor: withAlpha(theme.warning, 0.4),
        backgroundColor: withAlpha(theme.warning, 0.1),
      }}
    >
      <HStack className="items-start gap-2">
        <Box style={{ paddingTop: 1 }}>
          <AppIcon icon={TriangleAlert} size={15} color={theme.warning} />
        </Box>
        <Text className="flex-1 text-[13px] font-semibold" style={{ color: theme.warning }}>
          These dates don&apos;t work for everyone on the event
        </Text>
      </HStack>
      {clashes.map((clash) => (
        <Text key={clash.userId} className="ml-6 text-[12px] text-muted-foreground">
          <Text className="text-[12px] font-medium text-foreground">{clash.name}</Text>
          {` — ${clash.reason}`}
        </Text>
      ))}
      <Text className="ml-6 text-[12px] text-muted-foreground">
        Take them off the event, or pick different dates.
      </Text>
    </VStack>
  );
}
