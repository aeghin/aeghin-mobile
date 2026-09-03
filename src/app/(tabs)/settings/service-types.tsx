import { Stack } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Palette from "lucide-react-native/icons/palette";
import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
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
import {
  useAddServiceType,
  useDeleteServiceType,
  useServiceTypes,
  useUpdateServiceType,
  type ServiceTypeInput,
} from "@/hooks/use-service-types";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { ServiceType, ServiceTypeColor } from "@/types/event";

const TAB_BAR_CLEARANCE = 64;

const COLORS: ServiceTypeColor[] = [
  "indigo",
  "amber",
  "emerald",
  "pink",
  "violet",
  "red",
  "blue",
  "cyan",
];

/** The dashboard's service-type settings: what kinds of service the organization runs. */
export default function ServiceTypesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const serviceTypes = useServiceTypes(organizationId);
  const remove = useDeleteServiceType(organizationId);

  // `undefined` while closed, `null` for a new one, a service type when editing.
  const [editing, setEditing] = useState<ServiceType | null | undefined>(undefined);

  const rows = serviceTypes.data ?? [];

  const openActions = (serviceType: ServiceType) =>
    Alert.alert(serviceType.name, undefined, [
      { text: "Edit", onPress: () => setEditing(serviceType) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Delete service type",
            `${serviceType.name} will no longer be offered for new events. Existing events keep it.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () =>
                  remove.mutate(serviceType.id, {
                    onError: (error) => Alert.alert("Couldn't delete", failureMessage(error)),
                  }),
              },
            ],
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Service types", headerBackTitle: "Settings" }} />

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
            refreshing={serviceTypes.isRefetching}
            onRefresh={serviceTypes.refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        <VStack className="gap-4">
          <Text className="ml-1 text-[13px] text-muted-foreground">
            Every event belongs to one. The colour is what tells them apart on the schedule.
          </Text>

          {serviceTypes.isError ? (
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load service types"
              body="Pull down to try again."
              tone="error"
            />
          ) : serviceTypes.isPending ? (
            <VStack className="items-center py-10">
              <Spinner color={theme.textMuted} />
            </VStack>
          ) : rows.length === 0 ? (
            <EventsEmptyState
              icon={Palette}
              title="No service types yet"
              body="Add one before creating an event."
            />
          ) : (
            <InsetCard elevated separatorInset={44}>
              {rows.map((serviceType) => {
                const colors = getServiceColors(serviceType.color, theme);
                return (
                  <Pressable
                    key={serviceType.id}
                    onPress={canManage ? () => openActions(serviceType) : undefined}
                    disabled={!canManage}
                    accessibilityRole={canManage ? "button" : undefined}
                    className="data-[active=true]:bg-border/60"
                  >
                    <HStack className="min-h-[52px] items-center gap-3 px-3.5">
                      <Box className="h-4 w-4 rounded-full" style={{ backgroundColor: colors.base }} />
                      <Text className="flex-1 text-base text-foreground">{serviceType.name}</Text>
                      <Text className="text-[13px] capitalize text-muted-foreground">
                        {serviceType.color}
                      </Text>
                    </HStack>
                  </Pressable>
                );
              })}
            </InsetCard>
          )}

          {canManage && !serviceTypes.isPending && !serviceTypes.isError ? (
            <Button
              variant="outline"
              onPress={() => setEditing(null)}
              className="h-auto rounded-2xl border-dashed border-border py-3.5"
            >
              <AppIcon icon={Plus} size={20} color={brand.orange} />
              <ButtonText className="text-base font-semibold text-brand">Add service type</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </ScrollView>

      <ServiceTypeDialog
        key={editing === undefined ? "closed" : (editing?.id ?? "new")}
        visible={editing !== undefined}
        serviceType={editing ?? undefined}
        onClose={() => setEditing(undefined)}
        organizationId={organizationId}
      />
    </VStack>
  );
}

function ServiceTypeDialog({
  visible,
  serviceType,
  onClose,
  organizationId,
}: {
  visible: boolean;
  serviceType?: ServiceType;
  onClose: () => void;
  organizationId: string;
}) {
  const theme = useTheme();
  const add = useAddServiceType(organizationId);
  const update = useUpdateServiceType(organizationId);

  const [draft, setDraft] = useState<ServiceTypeInput>({
    name: serviceType?.name ?? "",
    color: serviceType?.color ?? "indigo",
  });
  const [error, setError] = useState<string | null>(null);

  const name = draft.name.trim();
  const ready = name.length > 0 && name.length <= 25;

  const submit = () => {
    setError(null);
    const options = { onSuccess: onClose, onError: (failure: unknown) => setError(failureMessage(failure)) };
    if (serviceType) {
      update.mutate({ id: serviceType.id, name, color: draft.color }, options);
    } else {
      add.mutate({ name, color: draft.color }, options);
    }
  };

  return (
    <Dialog
      visible={visible}
      icon={Palette}
      title={serviceType ? "Edit service type" : "New service type"}
      description="Every event belongs to one. The colour is what tells them apart."
      action={{ label: "Save", onPress: submit, disabled: !ready }}
      submitting={add.isPending || update.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <Field label="Name" hint="Up to 25 characters.">
        <FormInput
          value={draft.name}
          onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
          placeholder="Sunday Service"
          autoCapitalize="words"
          maxLength={25}
          autoFocus
        />
      </Field>

      <Field label="Colour">
        <HStack className="flex-wrap gap-2">
          {COLORS.map((color) => {
            const colors = getServiceColors(color, theme);
            const selected = draft.color === color;
            return (
              <Pressable
                key={color}
                onPress={() => setDraft((current) => ({ ...current, color }))}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={color}
                className="items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: colors.surface,
                  borderWidth: 2,
                  borderColor: selected ? colors.base : "transparent",
                }}
              >
                <Box className="h-5 w-5 rounded-full" style={{ backgroundColor: colors.base }} />
              </Pressable>
            );
          })}
        </HStack>
      </Field>
    </Dialog>
  );
}
