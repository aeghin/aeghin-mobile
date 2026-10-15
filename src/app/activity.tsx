import { Stack } from "expo-router";
import Activity from "lucide-react-native/icons/activity";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import ListFilter from "lucide-react-native/icons/list-filter";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityRow } from "@/components/activity-row";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useActivity } from "@/hooks/use-activity";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import {
  ACTIVITY_FILTERS,
  activityDaysAgo,
  activityGroupLabel,
  formatActivityStamp,
} from "@/lib/activity";
import { canManageOrg } from "@/lib/config/roles";
import type { ActivityFilter, ActivityItem } from "@/types/activity";

/** The list's side padding, which the chip row bleeds past to scroll edge to edge. */
const GUTTER = 16;

type Row = { item: ActivityItem; stamp: string };

/** Consecutive rows under one heading: Today, Yesterday, Earlier this week, Earlier. */
type DaySection = { title: string; data: Row[] };

// The feed is already newest first, so a heading only ever opens once.
function groupByDay(items: ActivityItem[], now: Date): DaySection[] {
  const sections: DaySection[] = [];

  for (const item of items) {
    const daysAgo = activityDaysAgo(item.createdAt, now);
    const title = activityGroupLabel(daysAgo);
    const row = { item, stamp: formatActivityStamp(item.createdAt, daysAgo, now) };
    const last = sections.at(-1);

    if (last?.title === title) last.data.push(row);
    else sections.push({ title, data: [row] });
  }

  return sections;
}

/** The dashboard's Activity tab: what has happened in the organization, newest first. */
export default function ActivityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const [filter, setFilter] = useState<ActivityFilter>("all");
  const activity = useActivity(organizationId, canManage, filter);
  const pullToRefresh = usePullToRefresh(activity.refetch);
  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];

  // What "today" is for the headings: when these rows landed, so it moves on
  // with every refetch and a screen left open overnight doesn't keep calling
  // yesterday Today. Read from the data rather than the clock — the compiler
  // keeps a memo only on what its body uses, and a bare `new Date()` would be
  // made once for the screen's whole life. It is 0 only before any rows have
  // landed, when there is nothing to file under a day.
  const now = useMemo(() => new Date(activity.dataUpdatedAt), [activity.dataUpdatedAt]);
  const sections = groupByDay(items, now);
  const filterInfo = ACTIVITY_FILTERS.find((option) => option.value === filter);

  // The last chip's rows, held while this one's load: dimmed, and not paged.
  const stale = activity.isPlaceholderData;

  // Chips are for narrowing a feed, so a feed with nothing in it at all
  // shows its empty state alone.
  const showChips = !(filter === "all" && !activity.isPending && items.length === 0);

  const loadMore = () => {
    if (!stale && activity.hasNextPage && !activity.isFetchingNextPage) {
      activity.fetchNextPage();
    }
  };

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Activity" }} />

      <SectionList<Row, DaySection>
        sections={sections}
        keyExtractor={(row) => row.item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: 14,
          paddingBottom: insets.bottom + 24,
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
        ListHeaderComponent={
          showChips ? <ActivityFilterChips value={filter} onChange={setFilter} /> : null
        }
        renderSectionHeader={({ section }) => (
          <Text
            className="px-1 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.7px] text-muted-foreground"
            style={{ opacity: stale ? 0.5 : 1 }}
          >
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={() => <Divider style={{ marginLeft: 62 }} />}
        renderItem={({ item: row, index, section }) => (
          // Each day is its own card: its first and last rows carry the rounding.
          <Box
            className={`border-x border-border bg-card ${
              index === 0 ? "rounded-t-2xl border-t" : ""
            } ${index === section.data.length - 1 ? "rounded-b-2xl border-b" : ""}`}
            style={{ opacity: stale ? 0.5 : 1 }}
          >
            <ActivityRow item={row.item} stamp={row.stamp} />
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
          ) : filter !== "all" ? (
            <EventsEmptyState
              icon={ListFilter}
              title="Nothing here"
              body={filterInfo?.empty ?? ""}
              action={{ label: "Show all activity", onPress: () => setFilter("all") }}
            />
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

type ActivityFilterChipsProps = {
  value: ActivityFilter;
  onChange: (filter: ActivityFilter) => void;
};

/**
 * The dashboard's filter chips, in the Events screen's "All" pill: solid when
 * chosen, outlined otherwise. One chip is always on.
 */
function ActivityFilterChips({ value, onChange }: ActivityFilterChipsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -GUTTER }}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
    >
      {ACTIVITY_FILTERS.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="rounded-full border px-3 py-1.5 data-[active=true]:opacity-60"
            style={{
              borderColor: active ? theme.text : theme.border,
              backgroundColor: active ? theme.text : "transparent",
            }}
          >
            <Text
              className="text-[12.5px] font-semibold"
              style={{ color: active ? theme.background : theme.textMuted }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
