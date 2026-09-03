import LayoutTemplate from "lucide-react-native/icons/layout-template";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { Switch } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { TimeField } from "@/components/events/time-field";
import { Choice, ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { WEEKDAY_SHORT, weekdayAfter } from "@/lib/config/weekdays";
import { toggleRole, VolunteerRolePicker } from "@/components/volunteer-role-picker";
import type {
  EventTemplate,
  EventTemplateDay,
  EventTemplateInput,
  ServiceType,
  VolunteerRole,
} from "@/types/event";

/**
 * The dashboard's template modal.
 *
 * A template is an event with the date taken out: a weekday, one to seven
 * consecutive days of hours, and everything the create form would otherwise
 * ask for. The day rows are labelled off the first day — row two of a Saturday
 * template is Sunday — which is how the web names them too.
 */

/** A template can span at most a week; the schema caps it at seven. */
const MAX_DAYS = 7;

/** The three deadlines the dashboard offers an invitee. */
const EXPIRY_OPTIONS = [3, 5, 7] as const;

/**
 * What a fresh day row starts at.
 *
 * The web starts blank and validates; here it cannot, because the time field
 * shows a picked value rather than an empty input, and `""` has no clock face.
 */
const DEFAULT_TIMES: EventTemplateDay = { startTime: "10:00", endTime: "12:00" };

const EMPTY: EventTemplateInput = {
  serviceTypeId: "",
  name: "",
  description: "",
  location: "",
  dayOfWeek: 0,
  days: [DEFAULT_TIMES],
  rolesNeeded: [],
  expiresInDays: 3,
  smartSchedulingEnabled: false,
};

const draftFrom = (template: EventTemplate | undefined): EventTemplateInput =>
  template
    ? {
        serviceTypeId: template.serviceTypeId,
        name: template.name,
        description: template.description,
        location: template.location,
        dayOfWeek: template.dayOfWeek,
        days: template.days.length > 0 ? template.days : [DEFAULT_TIMES],
        rolesNeeded: template.rolesNeeded,
        expiresInDays: template.expiresInDays,
        smartSchedulingEnabled: template.smartSchedulingEnabled,
      }
    : EMPTY;

type TemplateFormDialogProps = {
  visible: boolean;
  /** The template being edited, or undefined when this is a new one. */
  template?: EventTemplate;
  serviceTypes: ServiceType[];
  submitting: boolean;
  /** Whatever the server said, when it refused the save. */
  submitError: string | null;
  onSubmit: (template: EventTemplateInput) => void;
  onClose: () => void;
};

/**
 * Keyed on the template, so the form below takes its values from props once,
 * on mount — opening a different template builds a new form rather than
 * reusing the last one's state. The song form does the same.
 */
export function TemplateFormDialog(props: TemplateFormDialogProps) {
  return <TemplateForm key={props.template?.id ?? "new"} {...props} />;
}

function TemplateForm({
  visible,
  template,
  serviceTypes,
  submitting,
  submitError,
  onSubmit,
  onClose,
}: TemplateFormDialogProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<EventTemplateInput>(() => draftFrom(template));

  const set = <K extends keyof EventTemplateInput>(key: K, value: EventTemplateInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setDay = (index: number, patch: Partial<EventTemplateDay>) =>
    set(
      "days",
      draft.days.map((day, at) => (at === index ? { ...day, ...patch } : day)),
    );

  const addDay = () => set("days", [...draft.days, DEFAULT_TIMES]);

  const removeDay = (index: number) =>
    set("days", draft.days.filter((_, at) => at !== index));

  const badOrder = draft.days.some((day) => day.endTime <= day.startTime);

  const ready =
    draft.serviceTypeId.length > 0 &&
    draft.name.trim().length > 0 &&
    draft.location.trim().length > 0 &&
    draft.days.length > 0 &&
    draft.rolesNeeded.length > 0 &&
    !badOrder;

  const submit = () =>
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      location: draft.location.trim(),
    });

  return (
    <Dialog
      visible={visible}
      icon={LayoutTemplate}
      title={template ? "Edit template" : "New template"}
      description="Everything an event needs except its date."
      action={{ label: "Save", onPress: submit, disabled: !ready }}
      submitting={submitting}
      onClose={onClose}
    >
      <ErrorBanner message={submitError} />

      <Field label="Name" hint="Up to 25 characters.">
        <FormInput
          value={draft.name}
          onChangeText={(value) => set("name", value)}
          placeholder="Sunday Service"
          autoCapitalize="words"
          maxLength={25}
        />
      </Field>

      <Field label="Location" hint="Up to 20 characters.">
        <FormInput
          value={draft.location}
          onChangeText={(value) => set("location", value)}
          placeholder="Main Hall"
          autoCapitalize="words"
          maxLength={20}
        />
      </Field>

      <Field label="Description" hint="Optional.">
        <FormInput
          value={draft.description ?? ""}
          onChangeText={(value) => set("description", value)}
          placeholder="What the team should know…"
          multiline
        />
      </Field>

      <Field
        label="Service type"
        hint={serviceTypes.length === 0 ? "Add one in Settings first." : undefined}
      >
        <HStack className="flex-wrap gap-1.5">
          {serviceTypes.map((service) => {
            const colors = getServiceColors(service.color, theme);
            const selected = draft.serviceTypeId === service.id;
            return (
              <Pressable
                key={service.id}
                onPress={() => set("serviceTypeId", service.id)}
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
      </Field>

      <Field label="First day" hint="Events start on the next one of these.">
        <HStack className="flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((label, index) => (
            <Choice
              key={label}
              label={label}
              selected={draft.dayOfWeek === index}
              onPress={() => set("dayOfWeek", index)}
            />
          ))}
        </HStack>
      </Field>

      <Field
        label="Schedule"
        error={badOrder ? "Each day has to end after it starts." : undefined}
        hint={draft.days.length > 1 ? "Consecutive days from the first." : undefined}
      >
        <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
          {draft.days.map((day, index) => (
            <VStack key={index}>
              {index > 0 ? <Divider /> : null}
              <VStack className="gap-2 px-3 py-2.5">
                <HStack className="items-center justify-between">
                  <Text className="text-[13px] font-semibold text-foreground">
                    {weekdayAfter(draft.dayOfWeek, index)}
                  </Text>
                  {draft.days.length > 1 ? (
                    <Pressable
                      onPress={() => removeDay(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${weekdayAfter(draft.dayOfWeek, index)}`}
                      hitSlop={8}
                    >
                      <AppIcon icon={X} size={15} color={theme.textMuted} />
                    </Pressable>
                  ) : null}
                </HStack>
                <HStack className="items-center gap-2">
                  <TimeField
                    value={day.startTime}
                    onChange={(value) => setDay(index, { startTime: value })}
                    label="Start time"
                    context={weekdayAfter(draft.dayOfWeek, index)}
                  />
                  <Text className="text-[13px] text-muted-foreground">to</Text>
                  <TimeField
                    value={day.endTime}
                    onChange={(value) => setDay(index, { endTime: value })}
                    label="End time"
                    context={weekdayAfter(draft.dayOfWeek, index)}
                  />
                </HStack>
              </VStack>
            </VStack>
          ))}

          {draft.days.length < MAX_DAYS ? (
            <>
              <Divider />
              <Pressable
                onPress={addDay}
                accessibilityRole="button"
                className="px-3 py-2.5"
              >
                <HStack className="items-center gap-1.5">
                  <AppIcon icon={Plus} size={15} color={brand.orange} />
                  <Text className="text-[14px] font-medium" style={{ color: brand.orange }}>
                    {`Add ${weekdayAfter(draft.dayOfWeek, draft.days.length)}`}
                  </Text>
                </HStack>
              </Pressable>
            </>
          ) : null}
        </VStack>
      </Field>

      <Field label="Roles needed" hint="What an event from this template asks for.">
        <VolunteerRolePicker
          selected={draft.rolesNeeded}
          onToggle={(role: VolunteerRole) =>
            set("rolesNeeded", toggleRole(draft.rolesNeeded, role))
          }
        />
      </Field>

      <Field label="Time to respond">
        <HStack className="flex-wrap gap-1.5">
          {EXPIRY_OPTIONS.map((days) => (
            <Choice
              key={days}
              label={`${days} days`}
              selected={draft.expiresInDays === days}
              onPress={() => set("expiresInDays", days)}
            />
          ))}
        </HStack>
      </Field>

      <HStack className="items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5">
        <VStack className="flex-1">
          <Text className="text-[15px] text-foreground">Auto-fill declines</Text>
          <Text className="text-[12px] text-muted-foreground">
            Events from this template start with it on.
          </Text>
        </VStack>
        <Switch
          value={draft.smartSchedulingEnabled}
          onValueChange={(value) => set("smartSchedulingEnabled", value)}
          trackColor={{ true: brand.orange }}
        />
      </HStack>
    </Dialog>
  );
}
