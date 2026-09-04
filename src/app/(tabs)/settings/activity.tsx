import { Stack } from "expo-router";
import Activity from "lucide-react-native/icons/activity";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityRow } from "@/components/activity-row";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useActivity } from "@/hooks/use-activity";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import type { ActivityItem } from "@/types/activity";

const TAB_BAR_CLEARANCE = 64;

/** The dashboard's Activity tab: what has happened in the organization, newest first. */
export default function ActivityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const activity = useActivity(organizationId, canManage);
  const pullToRefresh = usePullToRefresh(activity.refetch);
  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];

  const loadMore = () => {
    if (activity.hasNextPage && !activity.isFetchingNextPage) activity.fetchNextPage();
  };

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Activity", headerBackTitle: "Settings" }} />

      <FlatList<ActivityItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
        ItemSeparatorComponent={() => <Divider style={{ marginLeft: 62 }} />}
        renderItem={({ item, index }) => (
          // The rows share one card: the first and last carry its rounding.
          <Box
            className={`border-x border-border bg-card ${
              index === 0 ? "rounded-t-2xl border-t" : ""
            } ${index === items.length - 1 ? "rounded-b-2xl border-b" : ""}`}
          >
            <ActivityRow item={item} />
          </Box>
        )}
        ListFooterComponent={
          activity.isFetchingNextPage ? (
            <Box className="items-center py-4">
              <Spinner size="small" color={theme.textMuted} />
            </Box>
          ) : null
        }
        ListEmptyComponent={
          activity.isError ? (
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load activity"
              body="Pull down to try again."
              tone="error"
            />
          ) : activity.isPending ? (
            <Box className="flex-1 items-center justify-center">
              <Spinner color={theme.textMuted} />
            </Box>
          ) : (
            <EventsEmptyState
              icon={Activity}
              title="Nothing yet"
              body="Invitations, role changes and events will show up here."
            />
          )
        }
      />
    </VStack>
  );
}
