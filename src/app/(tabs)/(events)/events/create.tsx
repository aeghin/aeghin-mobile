import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { DateRangePicker } from "@/components/date-range-picker";
import { TimeField } from "@/components/events/time-field";
import { ErrorBanner, Choice, Field, FormInput } from "@/components/form-fields";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { brand } from "@/constants/branding";
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
import type { OrganizationMember } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/** What a newly added day starts out as, so a one-tap date is already valid. */
const DEFAULT_TIMES = { startTime: "10:00", endTime: "12:00" };

/** The three deadlines the dashboard offers an invitee. */
const EXPIRY_OPTIONS = [3, 5, 7] as const;

type DayTimes = { startTime: string; endTime: string };

/** The day key `count` days after `key`. */
const addDays = (key: string, count: number) =>
  dayKey(new Date(keyToDate(key).getTime() + count * 86_400_000));

/** What the form starts out holding. A template fills it; blank leaves it empty. */
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
};

/**
 * A template as the form's starting values, dated to its next occurrence.
 *
 * Never today: a Sunday template opened on a Sunday means *next* Sunday, which
 * is the `|| 7` the dashboard's own date maths turns on. The weekday is read
 * off the device's calendar day, the same clock `todayKey` reads.
 *
 * People are not seeded from anywhere — a template never carries a roster.
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

  const { templateId: initialTemplateId } = useLocalSearchParams<{ templateId?: string }>();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const serviceTypes = useServiceTypes(organizationId);
  const templates = useTemplates(organizationId, canManage);

  // Which template the form is seeded from. Changing it rebuilds the form
  // below rather than writing nine fields from an effect — the same shape the
  // setlist editor and the event edit screen use.
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null);

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

  const seed = template
    ? seedFromTemplate(template, serviceTypes.data ?? [])
    : BLANK_SEED;

  return (
    <CreateEventForm
      key={template?.id ?? "blank"}
      organizationId={organizationId}
      seed={seed}
      templates={templates.data ?? []}
      templateId={template?.id ?? null}
      onPickTemplate={setTemplateId}
    />
  );
}

/**
 * Keyed on the template above, so every field takes its value from the seed
 * once, on mount. Picking a different template remounts this with new values
 * rather than synchronising nine pieces of state from an effect.
 */
function CreateEventForm({
  organizationId,
  seed,
  templates,
  templateId,
  onPickTemplate,
}: {
  organizationId: string;
  seed: CreateSeed;
  templates: EventTemplate[];
  templateId: string | null;
  onPickTemplate: (id: string | null) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const serviceTypes = useServiceTypes(organizationId);
  const members = useMembersList(organizationId);
  const availability = useCheckAvailability(organizationId);
  const create = useCreateEvent(organizationId);

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const [serviceTypeId, setServiceTypeId] = useState<string | null>(seed.serviceTypeId);
  const [name, setName] = useState(seed.name);
  const [description, setDescription] = useState(seed.description);
  const [location, setLocation] = useState(seed.location);
  const [range, setRange] = useState<{ start: string | null; end: string | null }>(seed.range);
  const [times, setTimes] = useState<Record<string, DayTimes>>(seed.times);
  const [rolesNeeded, setRolesNeeded] = useState<VolunteerRole[]>(seed.rolesNeeded);

  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [expiresAt, setExpiresAt] = useState<number>(seed.expiresAt);
  const [smartScheduling, setSmartScheduling] = useState(seed.smartScheduling);
  const [busy, setBusy] = useState<MemberAvailability | null>(null);

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
          setStep(2);
        },
        onError: () => {
          // A failed check is not a reason to block the event. The server
          // refuses a blockout on its own; only the forewarning is lost.
          setBusy(null);
          setStep(2);
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
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen
        options={{
          title: step === 1 ? "New event" : "Who's serving",
          headerBackTitle: "Events",
          headerRight: () => (
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
        <VStack className="gap-4">
          <ErrorBanner message={error} />

          {step === 1 ? (
            <>
              {templates.length > 0 ? (
                <Field
                  label="Start from template"
                  hint="Fills everything below in, dated to the next matching day."
                >
                  <HStack className="flex-wrap gap-1.5">
                    {templates.map((template) => (
                      <Choice
                        key={template.id}
                        label={template.name}
                        selected={templateId === template.id}
                        onPress={() => onPickTemplate(template.id)}
                      />
                    ))}
                    {templateId ? (
                      <Choice
                        label="Start blank"
                        selected={false}
                        onPress={() => onPickTemplate(null)}
                      />
                    ) : null}
                  </HStack>
                </Field>
              ) : null}

              <Field
                label="Service type"
                hint={
                  serviceTypes.data?.length === 0
                    ? "Add a service type in Settings before creating an event."
                    : undefined
                }
              >
                {serviceTypes.isPending ? (
                  <HStack className="py-2">
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
                  </HStack>
                )}
              </Field>

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
                <DateRangePicker value={range} onChange={setRange} />
              </Field>

              {days.length > 0 ? (
                <Field
                  label="Times"
                  error={
                    badOrder
                      ? "Each day has to end after it starts."
                      : undefined
                  }
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

              <Field
                label="Roles needed"
                hint="Everything this event needs filled, whether or not you invite somebody now."
              >
                <VolunteerRolePicker
                  selected={rolesNeeded}
                  onToggle={(role) =>
                    setRolesNeeded((current) => toggleRole(current, role))
                  }
                />
              </Field>
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

              <Field label="Time to respond">
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
              </Field>

              <HStack className="items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3">
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

              <Pressable
                onPress={() => setStep(1)}
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
        <Text style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Text>
        <Text className="text-[13px] font-semibold text-foreground">{label}</Text>
        {selected.length > 0 ? (
          <Text className="text-[12px] text-muted-foreground">
            {`· ${selected.length} invited`}
          </Text>
        ) : null}
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
