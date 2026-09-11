import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Calendar from "lucide-react-native/icons/calendar";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Clock from "lucide-react-native/icons/clock";
import Hourglass from "lucide-react-native/icons/hourglass";
import Info from "lucide-react-native/icons/info";
import LayoutTemplate from "lucide-react-native/icons/layout-template";
import Lock from "lucide-react-native/icons/lock";
import MapPin from "lucide-react-native/icons/map-pin";
import NotepadText from "lucide-react-native/icons/notepad-text";
import Plus from "lucide-react-native/icons/plus";
import Send from "lucide-react-native/icons/send";
import Sparkles from "lucide-react-native/icons/sparkles";
import Tags from "lucide-react-native/icons/tags";
import Type from "lucide-react-native/icons/type";
import Users from "lucide-react-native/icons/users";
import Zap from "lucide-react-native/icons/zap";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { DateRangePicker } from "@/components/date-range-picker";
import { AiEventPanel } from "@/components/events/ai-event-panel";
import { AiEventUpgradeCard } from "@/components/events/ai-plan-cards";
import { SegmentedControl, type Segment } from "@/components/events/segmented-control";
import { TimeField } from "@/components/events/time-field";
import {
  Choice,
  ErrorBanner,
  FormBlock,
  FormCount,
  FormGroup,
  FormRow,
  FormTextArea,
} from "@/components/form-fields";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { ServiceTypeDialog } from "@/components/service-type-dialog";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { brand } from "@/constants/branding";
import { useBillingStatus } from "@/hooks/use-billing";
import { useCheckAvailability, useCreateEvent } from "@/hooks/use-events";
import { useMembersList } from "@/hooks/use-members-list";
import { useServiceTypes } from "@/hooks/use-service-types";
import { useTemplates } from "@/hooks/use-templates";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getServiceColors } from "@/lib/config/service-types";
import { getVolunteerRoleConfig, ROLE_ORDER } from "@/lib/config/volunteer-roles";
import {
  dayKey,
  daysInRange,
  formatShortDate,
  formatTime,
  keyToDate,
  todayKey,
} from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type {
  EventTemplate,
  MemberAvailability,
  NewEventDay,
  ServiceType,
  VolunteerRole,
} from "@/types/event";
import type { EventDraft } from "@/types/event-ai";
import type { OrganizationMember } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/** What a newly added day starts out as, so a one-tap date is already valid. */
const DEFAULT_TIMES = { startTime: "10:00", endTime: "12:00" };

/** The three deadlines the dashboard offers an invitee. */
const EXPIRY_OPTIONS = [3, 5, 7] as const;

/** Step one, either filled in by hand or dictated to the agent. */
type Pane = "form" | "ai";

type DayTimes = { startTime: string; endTime: string };

/** The day key `count` days after `key`. */
const addDays = (key: string, count: number) =>
  dayKey(new Date(keyToDate(key).getTime() + count * 86_400_000));

/**
 * What the form starts out holding. A template fills it, an approved AI draft
 * fills it, and blank leaves it empty.
 */
type CreateSeed = {
  serviceTypeId: string | null;
  name: string;
  description: string;
  location: string;
  range: { start: string | null; end: string | null };
  times: Record<string, DayTimes>;
  rolesNeeded: VolunteerRole[];
  expiresAt: number;
  smartScheduling: boolean;
  /** Who to invite, per role. Only a draft ever arrives with anybody in it. */
  assignments: Record<string, string[]>;
};

const BLANK_SEED: CreateSeed = {
  serviceTypeId: null,
  name: "",
  description: "",
  location: "",
  range: { start: null, end: null },
  times: {},
  rolesNeeded: [],
  expiresAt: 3,
  smartScheduling: false,
  assignments: {},
};

/**
 * A template as the form's starting values, dated to its next occurrence.
 *
 * Never today: a Sunday template opened on a Sunday means *next* Sunday, which
 * is the `|| 7` the dashboard's own date maths turns on. The weekday is read
 * off the device's calendar day, the same clock `todayKey` reads.
 *
 * A template never carries a roster, so nobody is seeded from one.
 */
function seedFromTemplate(template: EventTemplate, serviceTypes: ServiceType[]): CreateSeed {
  const today = todayKey();
  const offset = ((template.dayOfWeek - keyToDate(today).getUTCDay() + 7) % 7) || 7;
  const first = addDays(today, offset);

  const times: Record<string, DayTimes> = {};

  template.days.forEach((day, index) => {
    times[addDays(first, index)] = { startTime: day.startTime, endTime: day.endTime };
  });

  // A template can outlive the service type it names. Leaving it unset is what
  // puts the picker back in front of them, rather than a server refusal.
  const service = serviceTypes.find((candidate) => candidate.id === template.serviceTypeId);

  return {
    serviceTypeId: service?.id ?? null,
    name: template.name,
    description: template.description,
    location: template.location,
    range: {
      start: first,
      end: template.days.length > 1 ? addDays(first, template.days.length - 1) : null,
    },
    times,
    rolesNeeded: template.rolesNeeded,
    expiresAt: template.expiresInDays,
    smartScheduling: template.smartSchedulingEnabled,
    assignments: {},
  };
}

/**
 * An approved AI draft as the form's starting values — the dashboard's "Edit
 * manually first". A draft seeds the form exactly the way a template does, so
 * the fields, the dates and the people it settled on all arrive at once and
 * stay editable. `proposeEvent` rejects non-consecutive days, so the first and
 * the last bound exactly the range `daysInRange` walks back out.
 */
function seedFromDraft(draft: EventDraft): CreateSeed {
  const times: Record<string, DayTimes> = {};

  for (const day of draft.days) {
    times[day.date] = { startTime: day.startTime, endTime: day.endTime };
  }

  const assignments: Record<string, string[]> = {};

  for (const assignment of draft.assignments) {
    assignments[assignment.role] = [
      ...(assignments[assignment.role] ?? []),
      assignment.userId,
    ];
  }

  const last = draft.days[draft.days.length - 1];

  return {
    serviceTypeId: draft.serviceTypeId,
    name: draft.name,
    description: draft.description,
    location: draft.location,
    range: {
      start: draft.days[0].date,
      end: draft.days.length > 1 ? last.date : null,
    },
    times,
    rolesNeeded: draft.rolesNeeded,
    expiresAt: draft.expiresInDays,
    smartScheduling: draft.smartSchedulingEnabled,
    assignments,
  };
}

/**
 * Creating an event, in the dashboard's two steps.
 *
 * Step one is the event: what kind of service, what it is called, when and
 * where it runs, and which roles it needs. Step two is the people: who to
 * invite into each of those roles, how long they have to answer, and whether
 * a decline should refill itself.
 *
 * The split is the web's, and it earns its keep here for the same reason —
 * the second step cannot be drawn until the first has settled on days, since
 * the days are what decide who is already busy.
 */
export default function CreateEventScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { templateId: initialTemplateId } = useLocalSearchParams<{ templateId?: string }>();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const serviceTypes = useServiceTypes(organizationId);
  const templates = useTemplates(organizationId, canManage);
  const billing = useBillingStatus(organizationId);

  // Which template the form is seeded from. Changing it rebuilds the form
  // below rather than writing nine fields from an effect — the same shape the
  // setlist editor and the event edit screen use.
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null);

  // An approved draft seeds the form the same way, and takes precedence over a
  // template while it stands. The counter is what makes a second draft a
  // different key, so approving two in a row re-seeds rather than doing nothing.
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [draftSeq, setDraftSeq] = useState(0);

  // Both live up here rather than in the form, because the form is remounted
  // on every re-seed and neither may be thrown away when it is.
  const [pane, setPane] = useState<Pane>("form");
  const [step, setStep] = useState<1 | 2>(1);

  if (!canManage) {
    return (
      <VStack className="flex-1 items-center justify-center gap-2 bg-grouped px-8">
        <Stack.Screen options={{ title: "New event", headerBackTitle: "Events" }} />
        <AppIcon icon={CircleAlert} size={30} color={theme.textMuted} />
        <Text className="text-[15px] font-semibold text-foreground">Not available</Text>
        <Text className="text-center text-[13px] text-muted-foreground">
          Only an owner or admin can create events.
        </Text>
      </VStack>
    );
  }

  // A template's values are its starting state, so the form cannot be built
  // until both it and the service types it names have landed.
  const waiting = templateId !== null && (!templates.data || !serviceTypes.data);

  if (waiting) {
    return (
      <Box className="flex-1 items-center justify-center bg-grouped">
        <Stack.Screen options={{ title: "New event", headerBackTitle: "Events" }} />
        <Spinner color={theme.textMuted} />
      </Box>
    );
  }

  const template = templateId
    ? (templates.data ?? []).find((entry) => entry.id === templateId)
    : undefined;

  const seed = draft
    ? seedFromDraft(draft)
    : template
      ? seedFromTemplate(template, serviceTypes.data ?? [])
      : BLANK_SEED;

  const hasAiPro = Boolean(billing.data?.hasPro);
  // Unknown counts as "yes": the query settles in a moment, and refusing to
  // take a prompt while it is in flight reads as a dead panel.
  const hasServiceTypes = serviceTypes.data === undefined || serviceTypes.data.length > 0;
  const onAiPane = step === 1 && pane === "ai";

  const paneSegments: Segment<Pane>[] = [
    { value: "form", label: "Details" },
    {
      value: "ai",
      label: "AI",
      icon: Sparkles,
      trailingIcon: hasAiPro ? undefined : Lock,
      accessibilityLabel: hasAiPro ? "AI" : "AI, locked",
    },
  ];

  // Picking a template drops any standing draft, so the two can never both
  // claim the fields — and so tapping the chip a draft just un-highlighted
  // still re-seeds, which a bare `setTemplateId` would not.
  const pickTemplate = (id: string | null) => {
    setDraft(null);
    setTemplateId(id);
  };

  return (
    <VStack className="flex-1 bg-grouped">
      {step === 1 ? (
        <Box className="px-4 pt-3">
          <SegmentedControl segments={paneSegments} value={pane} onChange={setPane} />
        </Box>
      ) : null}

      {/* Hidden rather than unmounted: the conversation sits above the keyed
          form precisely so re-seeding that form — from a draft or from a
          template — cannot throw it away. */}
      {step === 1 ? (
        <KeyboardAvoidingView
          style={{ flex: 1, display: onAiPane ? "flex" : "none" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Box
            className="flex-1 px-4 pt-3"
            style={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
          >
            {billing.isPending ? (
              <Box className="items-center py-10">
                <Spinner color={theme.textMuted} />
              </Box>
            ) : hasAiPro ? (
              <AiEventPanel
                organizationId={organizationId}
                hasServiceTypes={hasServiceTypes}
                onRefine={(approved) => {
                  setDraft(approved);
                  setDraftSeq((current) => current + 1);
                  setStep(1);
                  setPane("form");
                }}
                onCreated={() => router.back()}
              />
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                <AiEventUpgradeCard
                  organizationId={organizationId}
                  canSubscribe={billing.data?.canSubscribe ?? false}
                />
              </ScrollView>
            )}
          </Box>
        </KeyboardAvoidingView>
      ) : null}

      <CreateEventForm
        key={draft ? `draft-${draftSeq}` : (template?.id ?? "blank")}
        organizationId={organizationId}
        seed={seed}
        templates={templates.data ?? []}
        templateId={template?.id ?? null}
        fromDraft={draft !== null}
        onPickTemplate={pickTemplate}
        step={step}
        onStep={setStep}
        hidden={onAiPane}
      />
    </VStack>
  );
}

/**
 * Keyed on the seed above, so every field takes its value from it once, on
 * mount. Re-seeding — a different template, or an approved AI draft — remounts
 * this with new values rather than synchronising ten pieces of state from an
 * effect, and throws away the roster and the availability read taken against
 * the old dates along with them.
 */
function CreateEventForm({
  organizationId,
  seed,
  templates,
  templateId,
  fromDraft,
  onPickTemplate,
  step,
  onStep,
  hidden,
}: {
  organizationId: string;
  seed: CreateSeed;
  templates: EventTemplate[];
  templateId: string | null;
  /** Seeded from a draft, so no template chip speaks for what is in the form. */
  fromDraft: boolean;
  onPickTemplate: (id: string | null) => void;
  step: 1 | 2;
  onStep: (step: 1 | 2) => void;
  /** The AI pane is up. The fields stay mounted underneath it. */
  hidden: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const serviceTypes = useServiceTypes(organizationId);
  const members = useMembersList(organizationId);
  const availability = useCheckAvailability(organizationId);
  const create = useCreateEvent(organizationId);

  const [error, setError] = useState<string | null>(null);

  const [serviceTypeId, setServiceTypeId] = useState<string | null>(seed.serviceTypeId);
  const [name, setName] = useState(seed.name);
  const [description, setDescription] = useState(seed.description);
  const [location, setLocation] = useState(seed.location);
  const [range, setRange] = useState<{ start: string | null; end: string | null }>(seed.range);
  const [times, setTimes] = useState<Record<string, DayTimes>>(seed.times);
  const [rolesNeeded, setRolesNeeded] = useState<VolunteerRole[]>(seed.rolesNeeded);

  const [assignments, setAssignments] = useState<Record<string, string[]>>(seed.assignments);
  const [expiresAt, setExpiresAt] = useState<number>(seed.expiresAt);
  const [smartScheduling, setSmartScheduling] = useState(seed.smartScheduling);
  const [busy, setBusy] = useState<MemberAvailability | null>(null);
  const [addingService, setAddingService] = useState(false);

  // Derived rather than synced: a range change would otherwise have to write
  // `times` from an effect, and every day already falls back to a default.
  const days = useMemo(
    () => (range.start ? daysInRange(range.start, range.end ?? range.start) : []),
    [range],
  );

  const timesFor = (day: string): DayTimes => times[day] ?? DEFAULT_TIMES;

  const setDayTime = (day: string, patch: Partial<DayTimes>) =>
    setTimes((current) => ({ ...current, [day]: { ...timesFor(day), ...patch } }));

  const payloadDays: NewEventDay[] = days.map((date) => ({ date, ...timesFor(date) }));

  const badOrder = payloadDays.find((day) => day.endTime <= day.startTime);

  // The form takes the hue of the event it is making, the way that event's own
  // screen will. Brand orange until a service type says otherwise.
  const chosenService = (serviceTypes.data ?? []).find((entry) => entry.id === serviceTypeId);
  const accent = chosenService
    ? getServiceColors(chosenService.color, theme).text
    : brand.orange;

  const readyForPeople =
    Boolean(serviceTypeId) &&
    name.trim().length > 0 &&
    location.trim().length > 0 &&
    days.length > 0 &&
    rolesNeeded.length > 0 &&
    !badOrder;

  const roster = members.data ?? [];

  const goToPeople = () => {
    setError(null);

    // Who is busy depends entirely on the days, which is why this is asked
    // here rather than when the screen opened.
    availability.mutate(
      { days: payloadDays },
      {
        onSuccess: (result) => {
          setBusy(result);
          onStep(2);
        },
        onError: () => {
          // A failed check is not a reason to block the event. The server
          // refuses a blockout on its own; only the forewarning is lost.
          setBusy(null);
          onStep(2);
        },
      },
    );
  };

  const toggleAssignment = (role: VolunteerRole, member: (typeof roster)[number]) => {
    const current = assignments[role] ?? [];

    if (current.includes(member.id)) {
      setAssignments((all) => ({
        ...all,
        [role]: current.filter((id) => id !== member.id),
      }));
      return;
    }

    const conflict = busy?.conflicts[member.id];
    const add = () => setAssignments((all) => ({ ...all, [role]: [...current, member.id] }));

    // A blockout is the server's to refuse; a conflict is the manager's call,
    // so it is put to them rather than decided for them.
    if (conflict) {
      Alert.alert(
        "Already booked",
        `${member.firstName} is on ${conflict.eventName}, ${formatTime(conflict.startTime)} to ${formatTime(conflict.endTime)}. Invite them anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Invite anyway", onPress: add },
        ],
      );
      return;
    }

    add();
  };

  const submit = () => {
    if (!serviceTypeId) return;

    setError(null);

    create.mutate(
      {
        serviceTypeId,
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim(),
        days: payloadDays,
        rolesNeeded,
        expiresAt,
        smartSchedulingEnabled: smartScheduling,
        // Roles nobody was picked for go up empty, which is what leaves an
        // open slot on the roster for the team card to invite into later.
        roleAssignments: Object.fromEntries(
          rolesNeeded.map((role) => [role, assignments[role] ?? []]),
        ),
      },
      {
        onSuccess: () => router.back(),
        onError: (failure) => setError(failureMessage(failure)),
      },
    );
  };

  const action = step === 1 ? goToPeople : submit;
  const actionLabel = step === 1 ? "Next" : "Create";
  const actionReady = step === 1 ? readyForPeople : true;
  const working = step === 1 ? availability.isPending : create.isPending;

  return (
    <VStack className="flex-1" style={{ display: hidden ? "none" : "flex" }}>
      <Stack.Screen
        options={{
          title: step === 1 ? "New event" : "Who's serving",
          headerBackTitle: "Events",
          // The AI pane has nothing for this to act on.
          headerRight: () =>
            hidden ? null : (
              <Pressable
                onPress={action}
                disabled={!actionReady || working}
                accessibilityRole="button"
                hitSlop={8}
              >
                {working ? (
                  <Spinner size="small" color={brand.orange} />
                ) : (
                  <Text
                    className="text-[16px] font-semibold"
                    style={{ color: actionReady ? brand.orange : theme.textMuted }}
                  >
                    {actionLabel}
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
        <VStack className="gap-5">
          <ErrorBanner message={error} />

          {step === 1 ? (
            <>
              {templates.length > 0 ? (
                <FormGroup
                  label="Start from a template"
                  icon={LayoutTemplate}
                  tint={accent}
                  footnote="Fills everything below in, dated to the next matching day."
                >
                  <FormBlock>
                    <HStack className="flex-wrap gap-1.5">
                      {templates.map((template) => (
                        <Choice
                          key={template.id}
                          label={template.name}
                          selected={!fromDraft && templateId === template.id}
                          onPress={() => onPickTemplate(template.id)}
                        />
                      ))}
                      {templateId || fromDraft ? (
                        <Choice
                          label="Start blank"
                          selected={false}
                          onPress={() => onPickTemplate(null)}
                        />
                      ) : null}
                    </HStack>
                  </FormBlock>
                </FormGroup>
              ) : null}

              <FormGroup
                label="Details"
                icon={Info}
                tint={accent}
                trailing={
                  chosenService ? <FormCount>{chosenService.name}</FormCount> : undefined
                }
                footnote={
                  serviceTypes.data?.length === 0
                    ? "Every event needs a service type. Tap New to make the first one."
                    : undefined
                }
              >
                <FormBlock label="Service type" icon={Tags}>
                  {serviceTypes.isPending ? (
                    <HStack className="py-1">
                      <Spinner size="small" color={theme.textMuted} />
                    </HStack>
                  ) : (
                    <HStack className="flex-wrap gap-1.5">
                      {(serviceTypes.data ?? []).map((service) => {
                        const colors = getServiceColors(service.color, theme);
                        const selected = serviceTypeId === service.id;
                        return (
                          <Pressable
                            key={service.id}
                            onPress={() => setServiceTypeId(service.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            className="rounded-full border px-3 py-1.5"
                            style={{
                              borderColor: selected ? colors.base : theme.border,
                              backgroundColor: selected ? colors.surface : theme.card,
                            }}
                          >
                            <HStack className="items-center gap-1.5">
                              <Box
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: colors.base }}
                              />
                              <Text
                                className="text-[13px] font-medium"
                                style={{ color: selected ? colors.text : theme.text }}
                              >
                                {service.name}
                              </Text>
                            </HStack>
                          </Pressable>
                        );
                      })}

                      {/* The dashboard puts a `+` beside its service-type
                          select so a first event never dead-ends in Settings.
                          Same idea, as one more chip on the end of the row. */}
                      <Pressable
                        onPress={() => setAddingService(true)}
                        accessibilityRole="button"
                        accessibilityLabel="New service type"
                        className="rounded-full border border-dashed px-3 py-1.5 data-[active=true]:opacity-60"
                        style={{ borderColor: theme.border, backgroundColor: theme.card }}
                      >
                        <HStack className="items-center gap-1">
                          <AppIcon icon={Plus} size={13} color={brand.orange} />
                          <Text className="text-[13px] font-semibold text-brand">New</Text>
                        </HStack>
                      </Pressable>
                    </HStack>
                  )}
                </FormBlock>

                <FormRow
                  label="Name"
                  icon={Type}
                  value={name}
                  onChangeText={setName}
                  placeholder="Sunday Morning"
                  autoCapitalize="words"
                  maxLength={25}
                />

                <FormRow
                  label="Location"
                  icon={MapPin}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Main Sanctuary"
                  autoCapitalize="words"
                  maxLength={20}
                />

                <FormBlock
                  label="Description"
                  icon={NotepadText}
                  trailing={<FormCount>Optional</FormCount>}
                >
                  <FormTextArea
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What the team should know…"
                  />
                </FormBlock>
              </FormGroup>

              <FormGroup
                label="When"
                icon={Calendar}
                tint={accent}
                trailing={
                  days.length > 0 ? (
                    <FormCount>{`${days.length} ${days.length === 1 ? "day" : "days"}`}</FormCount>
                  ) : undefined
                }
                error={badOrder ? "Each day has to end after it starts." : undefined}
                footnote={
                  days.length === 0
                    ? "Tap a day, or a start and an end for something running across days."
                    : days.length === 1
                      ? formatShortDate(keyToDate(days[0]))
                      : `${days.length} days, ${formatShortDate(keyToDate(days[0]))} to ${formatShortDate(keyToDate(days[days.length - 1]))}. Each day runs on its own hours.`
                }
              >
                <FormBlock>
                  <DateRangePicker value={range} onChange={setRange} bare accent={accent} />
                </FormBlock>

                {days.map((day) => (
                  <FormBlock key={day} label={formatShortDate(keyToDate(day))} icon={Clock}>
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
                  </FormBlock>
                ))}
              </FormGroup>

              <FormGroup
                label="Roles needed"
                icon={Users}
                tint={accent}
                trailing={
                  rolesNeeded.length > 0 ? (
                    <FormCount>{`${rolesNeeded.length} picked`}</FormCount>
                  ) : undefined
                }
                footnote="Everything this event needs filled, whether or not you invite somebody now."
              >
                <FormBlock>
                  <VolunteerRolePicker
                    selected={rolesNeeded}
                    onToggle={(role) =>
                      setRolesNeeded((current) => toggleRole(current, role))
                    }
                  />
                </FormBlock>
              </FormGroup>
            </>
          ) : (
            <>
              <Text className="text-[13px] text-muted-foreground">
                Pick who to invite for each role. Anything you leave empty stays an open
                slot you can fill later.
              </Text>

              {ROLE_ORDER.filter((role) => rolesNeeded.includes(role)).map((role) => (
                <RoleSection
                  key={role}
                  role={role}
                  members={roster.filter((member) => member.volunteerRoles.includes(role))}
                  loading={members.isPending}
                  selected={assignments[role] ?? []}
                  availability={busy}
                  onToggle={(member) => toggleAssignment(role, member)}
                />
              ))}

              <FormGroup label="Invites" icon={Send} tint={accent}>
                <FormBlock label="Time to respond" icon={Hourglass}>
                  <HStack className="gap-1.5">
                    {EXPIRY_OPTIONS.map((days) => (
                      <Choice
                        key={days}
                        label={`${days} days`}
                        selected={expiresAt === days}
                        onPress={() => setExpiresAt(days)}
                      />
                    ))}
                  </HStack>
                </FormBlock>

                <HStack
                  className="items-center gap-2.5"
                  style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                >
                  <Box style={{ width: 18, alignItems: "center" }}>
                    <AppIcon icon={Zap} size={17} color={theme.textMuted} />
                  </Box>
                  <VStack className="flex-1">
                    <Text className="text-[15px] text-foreground">Smart scheduling</Text>
                    <Text className="text-[12px] text-muted-foreground">
                      A decline auto-invites the next available member for that role.
                    </Text>
                  </VStack>
                  <Switch
                    value={smartScheduling}
                    onValueChange={setSmartScheduling}
                    trackColor={{ true: brand.orange }}
                  />
                </HStack>
              </FormGroup>

              <Pressable
                onPress={() => onStep(1)}
                accessibilityRole="button"
                className="items-center py-2 data-[active=true]:opacity-60"
              >
                <Text className="text-[14px] font-semibold" style={{ color: brand.orange }}>
                  Back to the details
                </Text>
              </Pressable>
            </>
          )}
        </VStack>
      </ScrollView>

      {/* `key` remounts it, so a cancelled draft is not still in the fields
          next time — the same trick the other dialogs on this screen use. */}
      <ServiceTypeDialog
        key={addingService ? "new-service" : "closed"}
        visible={addingService}
        organizationId={organizationId}
        onClose={() => setAddingService(false)}
        onCreated={(created) => setServiceTypeId(created.id)}
      />
    </VStack>
  );
}

/** One role, and everyone in the organization who can fill it. */
function RoleSection({
  role,
  members,
  loading,
  selected,
  availability,
  onToggle,
}: {
  role: VolunteerRole;
  members: OrganizationMember[];
  loading: boolean;
  selected: string[];
  availability: MemberAvailability | null;
  onToggle: (member: OrganizationMember) => void;
}) {
  const theme = useTheme();
  const { emoji, label } = getVolunteerRoleConfig(role);

  return (
    <VStack className="gap-1.5">
      <HStack className="ml-1 items-center gap-1.5">
        <Text style={{ fontSize: 12, lineHeight: 16 }}>{emoji}</Text>
        <Text className="text-xs font-bold uppercase tracking-[0.7px] text-muted-foreground">
          {selected.length > 0 ? `${label} · ${selected.length} invited` : label}
        </Text>
      </HStack>

      {loading ? (
        <HStack className="justify-center py-3">
          <Spinner size="small" color={theme.textMuted} />
        </HStack>
      ) : members.length === 0 ? (
        <Text className="ml-1 text-[12.5px] text-muted-foreground">
          {`Nobody in this organization plays ${label.toLowerCase()} yet.`}
        </Text>
      ) : (
        <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
          {members.map((member, index) => {
            const isSelected = selected.includes(member.id);
            const blockout = availability?.blockouts[member.id];
            const conflict = availability?.conflicts[member.id];
            const name = `${member.firstName} ${member.lastName}`.trim();

            return (
              <VStack key={member.id}>
                {index > 0 ? <Divider style={{ marginLeft: 58 }} /> : null}
                <Pressable
                  onPress={() => onToggle(member)}
                  disabled={Boolean(blockout)}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: isSelected,
                    disabled: Boolean(blockout),
                  }}
                  className="data-[active=true]:bg-border/40"
                  style={{ opacity: blockout ? 0.5 : 1 }}
                >
                  <HStack className="items-center gap-3 px-3 py-2.5">
                    <OrgAvatar
                      name={name}
                      logoUrl={member.imageUrl}
                      size={34}
                      shape="circle"
                    />
                    <VStack className="flex-1">
                      <Text
                        className="text-[15px] font-medium text-foreground"
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text
                        className="text-[12px]"
                        style={{
                          color: blockout
                            ? theme.destructive
                            : conflict
                              ? theme.warning
                              : theme.textMuted,
                        }}
                        numberOfLines={1}
                      >
                        {blockout
                          ? "Unavailable on these dates"
                          : conflict
                            ? `Already on ${conflict.eventName}`
                            : member.email}
                      </Text>
                    </VStack>
                    <Box
                      className="h-5 w-5 items-center justify-center rounded-full border"
                      style={{
                        borderColor: isSelected ? brand.orange : theme.border,
                        backgroundColor: isSelected ? brand.orange : "transparent",
                      }}
                    >
                      {isSelected ? (
                        <AppIcon icon={Check} size={12} color="#FFFFFF" />
                      ) : null}
                    </Box>
                  </HStack>
                </Pressable>
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}
