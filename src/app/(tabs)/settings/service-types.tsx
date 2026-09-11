import { Stack } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Plus from "lucide-react-native/icons/plus";
import Tags from "lucide-react-native/icons/tags";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { InsetCard } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { ServiceTypeDialog } from "@/components/service-type-dialog";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useDeleteServiceType, useServiceTypes } from "@/hooks/use-service-types";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { ServiceType } from "@/types/event";

const TAB_BAR_CLEARANCE = 64;


/** The dashboard's service-type settings: what kinds of service the organization runs. */
export default function ServiceTypesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const serviceTypes = useServiceTypes(organizationId);
  const pullToRefresh = usePullToRefresh(serviceTypes.refetch);
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
            {...pullToRefresh}
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
              icon={Tags}
              title="No service types yet"
              body="Add one before creating an event."
            />
          ) : (
            <InsetCard elevated separatorInset={44}>
              {rows.map((serviceType) => {
                const colors = getServiceColors(serviceType.color, theme);
                const row = (
                  <HStack className="min-h-[52px] items-center gap-3 px-3.5">
                    <Box className="h-4 w-4 rounded-full" style={{ backgroundColor: colors.base }} />
                    <Text className="flex-1 text-base text-foreground">{serviceType.name}</Text>
                    <Text className="text-[13px] capitalize text-muted-foreground">
                      {serviceType.color}
                    </Text>
                  </HStack>
                );

                // Somebody who cannot edit service types still reads the list
                // at full strength — a `disabled` Pressable would grey it out.
                return canManage ? (
                  <Pressable
                    key={serviceType.id}
                    onPress={() => openActions(serviceType)}
                    accessibilityRole="button"
                    className="data-[active=true]:bg-border/60"
                  >
                    {row}
                  </Pressable>
                ) : (
                  <VStack key={serviceType.id}>{row}</VStack>
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
