import { Stack, useRouter } from "expo-router";
import CalendarPlus from "lucide-react-native/icons/calendar-plus";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import LayoutTemplate from "lucide-react-native/icons/layout-template";
import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { TemplateFormDialog } from "@/components/events/template-form-dialog";
import { InsetCard } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useServiceTypes } from "@/hooks/use-service-types";
import {
  useAddTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "@/hooks/use-templates";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getServiceColors } from "@/lib/config/service-types";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { WEEKDAY_LABELS } from "@/lib/config/weekdays";
import { formatClock } from "@/components/events/time-field";
import { failureMessage } from "@/lib/failure";
import type { EventTemplate, EventTemplateInput } from "@/types/event";

const TAB_BAR_CLEARANCE = 64;

/**
 * The dashboard's Templates tab.
 *
 * A template is a recurring event saved without its date — "Sunday Service,
 * Main Hall, 9 to 11, these five roles" — so next week's takes a tap instead
 * of a form. Owners and admins only, as on the web: only they can create the
 * events a template seeds.
 */
export default function TemplatesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const templates = useTemplates(organizationId, canManage);
  const serviceTypes = useServiceTypes(organizationId);
  const remove = useDeleteTemplate(organizationId);

  const add = useAddTemplate(organizationId);
  const update = useUpdateTemplate(organizationId);

  // `undefined` while closed, `null` for a new one, a template when editing.
  const [editing, setEditing] = useState<EventTemplate | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const rows = templates.data ?? [];

  const close = () => {
    setEditing(undefined);
    setError(null);
  };

  const save = (input: EventTemplateInput) => {
    setError(null);
    const options = {
      onSuccess: close,
      onError: (failure: unknown) => setError(failureMessage(failure)),
    };

    if (editing) update.mutate({ id: editing.id, ...input }, options);
    else add.mutate(input, options);
  };

  const confirmDelete = (template: EventTemplate) =>
    Alert.alert(
      "Delete template",
      `${template.name} will no longer be offered when creating an event. Events already built from it are untouched.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            remove.mutate(template.id, {
              onError: (failure) => Alert.alert("Couldn't delete", failureMessage(failure)),
            }),
        },
      ],
    );

  const openActions = (template: EventTemplate) =>
    Alert.alert(template.name, undefined, [
      {
        text: "Create event from this",
        onPress: () => router.push(`/events/create?templateId=${template.id}`),
      },
      { text: "Edit", onPress: () => setEditing(template) },
      { text: "Delete", style: "destructive", onPress: () => confirmDelete(template) },
      { text: "Cancel", style: "cancel" },
    ]);

  if (!canManage) {
    return (
      <VStack className="flex-1 items-center justify-center gap-2 bg-grouped px-8">
        <Stack.Screen options={{ title: "Templates", headerBackTitle: "Settings" }} />
        <AppIcon icon={CircleAlert} size={30} color={theme.textMuted} />
        <Text className="text-[15px] font-semibold text-foreground">Not available</Text>
        <Text className="text-center text-[13px] text-muted-foreground">
          Only an owner or admin can manage templates.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Templates", headerBackTitle: "Settings" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={templates.isRefetching}
            onRefresh={templates.refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        <VStack className="gap-4">
          <Text className="ml-1 text-[13px] text-muted-foreground">
            A recurring event without its date. Creating one from a template fills the form
            in and dates it to the next matching day.
          </Text>

          {templates.isError ? (
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load templates"
              body="Pull down to try again."
              tone="error"
            />
          ) : templates.isPending ? (
            <VStack className="items-center py-10">
              <Spinner color={theme.textMuted} />
            </VStack>
          ) : rows.length === 0 ? (
            <EventsEmptyState
              icon={LayoutTemplate}
              title="No templates yet"
              body="Save a recurring event as a template and spin up next week's in seconds."
            />
          ) : (
            <InsetCard elevated separatorInset={16}>
              {rows.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  onPress={() => openActions(template)}
                />
              ))}
            </InsetCard>
          )}

          {!templates.isPending && !templates.isError ? (
            <Button
              variant="outline"
              onPress={() => setEditing(null)}
              className="h-auto rounded-2xl border-dashed border-border py-3.5"
            >
              <AppIcon icon={Plus} size={20} color={brand.orange} />
              <ButtonText className="text-base font-semibold text-brand">Add template</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </ScrollView>

      <TemplateFormDialog
        key={editing === undefined ? "closed" : (editing?.id ?? "new")}
        visible={editing !== undefined}
        template={editing ?? undefined}
        serviceTypes={serviceTypes.data ?? []}
        submitting={add.isPending || update.isPending}
        submitError={error}
        onSubmit={save}
        onClose={close}
      />
    </VStack>
  );
}

/** One saved template: what it is, when it runs, and what it asks for. */
function TemplateRow({
  template,
  onPress,
}: {
  template: EventTemplate;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = getServiceColors(template.serviceType.color, theme);

  const first = template.days[0];
  const span =
    template.days.length > 1
      ? `${WEEKDAY_LABELS[template.dayOfWeek]} + ${template.days.length - 1} more`
      : WEEKDAY_LABELS[template.dayOfWeek];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="data-[active=true]:bg-border/60"
    >
      <VStack className="gap-1.5 px-3.5 py-3">
        <HStack className="items-center gap-2">
          <Box className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.base }} />
          <Text className="flex-1 text-base font-medium text-foreground" numberOfLines={1}>
            {template.name}
          </Text>
          <Text className="text-[12px]" style={{ color: colors.text }}>
            {template.serviceType.name}
          </Text>
        </HStack>

        <HStack className="items-center gap-1.5">
          <AppIcon icon={CalendarPlus} size={13} color={theme.textMuted} />
          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {first
              ? `${span} · ${formatClock(first.startTime)}–${formatClock(first.endTime)} · ${template.location}`
              : `${span} · ${template.location}`}
          </Text>
        </HStack>

        {template.rolesNeeded.length > 0 ? (
          <HStack className="flex-wrap gap-1">
            {template.rolesNeeded.map((role) => {
              const { emoji, label } = getVolunteerRoleConfig(role);
              return (
                <HStack
                  key={role}
                  className="items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5"
                >
                  <Text style={{ fontSize: 11, lineHeight: 15 }}>{emoji}</Text>
                  <Text className="text-[11px] text-muted-foreground">{label}</Text>
                </HStack>
              );
            })}
          </HStack>
        ) : null}
      </VStack>
    </Pressable>
  );
}
