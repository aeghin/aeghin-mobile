import { Stack } from "expo-router";
import CalendarOff from "lucide-react-native/icons/calendar-off";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { DateRangePicker } from "@/components/date-range-picker";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field } from "@/components/form-fields";
import { InsetCard, InsetRow } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useAddBlockout, useBlockouts, useDeleteBlockout } from "@/hooks/use-blockouts";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { dayKey, daysBetween, formatShortDate } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { Blockout } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/** `"Aug 30"` or `"Aug 30 – Sep 2"`, plus how long that is. */
function describe(blockout: Blockout): { label: string; value: string } {
  const start = dayKey(blockout.startDate);
  const end = dayKey(blockout.endDate);
  const days = daysBetween(start, end) + 1;
  const label =
    start === end
      ? formatShortDate(blockout.startDate)
      : `${formatShortDate(blockout.startDate)} – ${formatShortDate(blockout.endDate)}`;
  return { label, value: `${days} ${days === 1 ? "day" : "days"}` };
}

/**
 * The dashboard's Blockouts tab: days you cannot be scheduled. Smart
 * scheduling and the invite picker both refuse to book across one.
 */
export default function BlockoutsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const blockouts = useBlockouts(organizationId);
  const pullToRefresh = usePullToRefresh(blockouts.refetch);
  const remove = useDeleteBlockout(organizationId);
  const [adding, setAdding] = useState(false);

  const rows = blockouts.data ?? [];

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
            {"Days you're unavailable. You won't be invited to events that fall on them."}
          </Text>

          {blockouts.isError ? (
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load blockouts"
              body="Pull down to try again."
              tone="error"
            />
          ) : blockouts.isPending ? (
            <VStack className="items-center py-10">
              <Spinner color={theme.textMuted} />
            </VStack>
          ) : rows.length === 0 ? (
            <EventsEmptyState
              icon={CalendarOff}
              title="No blockouts"
              body="Add the days you can't serve and scheduling will work around them."
            />
          ) : (
            <InsetCard elevated separatorInset={14}>
              {rows.map((blockout) => {
                const { label, value } = describe(blockout);
                return (
                  <InsetRow
                    key={blockout.id}
                    label={label}
                    value={value}
                    onPress={() => confirmDelete(blockout)}
                  />
                );
              })}
            </InsetCard>
          )}

          {blockouts.isPending || blockouts.isError ? null : (
            <Button
              variant="outline"
              onPress={() => setAdding(true)}
              className="h-auto rounded-2xl border-dashed border-border py-3.5"
            >
              <AppIcon icon={Plus} size={20} color={brand.orange} />
              <ButtonText className="text-base font-semibold text-brand">Add blockout</ButtonText>
            </Button>
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
