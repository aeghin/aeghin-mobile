import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import {
  MetaLine,
  Pill,
  RoleChip,
  ServiceBadge,
  ServiceRail,
  StaffingMeter,
} from "@/components/events/chips";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateRange,
  formatTime,
  earliestDate,
  isMultiDay,
} from "@/lib/events/format";
import { assignmentFor, staffingFor } from "@/lib/events/schedule";
import type { OrganizationEvent, ServiceType } from "@/types/event";

const PIN: AppSymbolName = { ios: "mappin.and.ellipse", android: "place" };
const SPAN: AppSymbolName = { ios: "calendar", android: "calendar_month" };
const CHEVRON: AppSymbolName = { ios: "chevron.right", android: "chevron_right" };
const AUTO: AppSymbolName = { ios: "wand.and.stars", android: "auto_awesome" };

/** The time column's width, shared with the skeleton so nothing shifts. */
const TIME_COLUMN = 66;

type EventCardProps = {
  event: OrganizationEvent;
  service: ServiceType | undefined;
  /**
   * Adds the staffing meter and the smart-scheduling mark — the two things
   * only someone managing the roster needs to see.
   */
  showStaffing?: boolean;
  onPress?: () => void;
};

/**
 * One event inside a day's group.
 *
 * The leading time column is what makes a stack of these read as a day rather
 * than as a list: the times line up down the left edge, so scanning "when"
 * costs one glance and never involves reading a name.
 */
export function EventCard({
  event,
  service,
  showStaffing,
  onPress,
}: EventCardProps) {
  const theme = useTheme();

  const first = earliestDate(event.dates);
  // An accepted role outranks a pending one; a declined one never shows.
  const assignment =
    assignmentFor(event, "ACCEPTED") ?? assignmentFor(event, "PENDING");
  const staffing = showStaffing ? staffingFor(event) : null;
  const spansDays = isMultiDay(event.dates);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={event.name}
      className="overflow-hidden rounded-2xl border border-border bg-card data-[active=true]:opacity-80"
    >
      <ServiceRail service={service} />

      <HStack className="items-start gap-2.5 py-3 pl-[14px] pr-3">
        <VStack className="gap-px" style={{ width: TIME_COLUMN }}>
          <Text className="text-[13.5px] font-semibold tracking-[-0.2px] text-foreground">
            {first ? formatTime(first.startTime) : "—"}
          </Text>
          <Text className="text-[12px] text-muted-foreground">
            {first ? formatTime(first.endTime) : ""}
          </Text>
        </VStack>

        <VStack className="flex-1 gap-1.5">
          <Text
            className="text-[15px] font-semibold leading-5 tracking-[-0.2px] text-foreground"
            numberOfLines={1}
          >
            {event.name}
          </Text>

          <HStack className="flex-wrap items-center gap-1.5">
            <ServiceBadge service={service} />
            {assignment ? <RoleChip role={assignment.role} /> : null}
            {showStaffing && event.smartSchedulingEnabled ? (
              <Pill label="Auto-fill" tone="brand" symbol={AUTO} />
            ) : null}
          </HStack>

          {spansDays ? (
            <MetaLine symbol={SPAN}>{formatDateRange(event.dates)}</MetaLine>
          ) : null}

          <MetaLine symbol={PIN}>{event.location}</MetaLine>

          {staffing ? (
            <HStack className="pt-0.5">
              <StaffingMeter filled={staffing.filled} needed={staffing.needed} />
            </HStack>
          ) : null}
        </VStack>

        {/* The chevron is a promise. It appears once there is somewhere to go. */}
        {onPress ? (
          <AppSymbol name={CHEVRON} size={13} tint={theme.textMuted} />
        ) : null}
      </HStack>
    </Pressable>
  );
}

/** Widths cycle so a stack of placeholders reads as events, not as a grid. */
const SKELETON_WIDTHS = [190, 150, 215];

/** A placeholder shaped like {@link EventCard}, for the first load. */
export function EventCardSkeleton({ index = 0 }: { index?: number }) {
  const width = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];

  return (
    <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
      <HStack className="items-start gap-2.5 py-3 pl-[14px] pr-3">
        <VStack className="gap-1.5" style={{ width: TIME_COLUMN }}>
          <Skeleton startColor="bg-border" style={{ width: 54, height: 12 }} />
          <Skeleton startColor="bg-border" style={{ width: 46, height: 10 }} />
        </VStack>

        <VStack className="flex-1 gap-2">
          <Skeleton startColor="bg-border" style={{ width, height: 13 }} />
          <HStack className="gap-1.5">
            <Skeleton startColor="bg-border" style={{ width: 84, height: 16 }} />
            <Skeleton startColor="bg-border" style={{ width: 68, height: 16 }} />
          </HStack>
          <Skeleton startColor="bg-border" style={{ width: 120, height: 10 }} />
        </VStack>
      </HStack>
    </VStack>
  );
}
