import Calendar from "lucide-react-native/icons/calendar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock from "lucide-react-native/icons/clock";
import MapPin from "lucide-react-native/icons/map-pin";
import Sparkles from "lucide-react-native/icons/sparkles";

import { AppIcon } from "@/components/app-icon";
import {
  MetaLine,
  Pill,
  RoleChip,
  ServiceBadge,
  StaffingMeter,
} from "@/components/events/chips";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { blendOver, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import {
  formatDateRange,
  formatDateTile,
  formatDayHeading,
  formatTimeOn,
  isMultiDay,
  keyToDate,
} from "@/lib/events/format";
import {
  assignmentFor,
  describeStaffing,
  staffingFor,
} from "@/lib/events/schedule";
import type { OrganizationEvent, ServiceType } from "@/types/event";

/**
 * The date tile's size at the default text size, shared with the skeleton so
 * nothing shifts. A minimum: at a larger text size the tile grows with its text.
 */
const TILE = { width: 48, height: 60 };

/** The Upcoming card's tile: the same tile, a size up. */
const LARGE_TILE = { width: 60, height: 76 };

const TILE_RADIUS = 12;

/** How far the tile's text follows the system text size before it stops growing. */
const MAX_TILE_SCALE = 1.3;

/** The card's own surface, worn by the tappable and the static row alike. */
const CARD_CLASS = "overflow-hidden rounded-2xl border border-border bg-card";

type EventCardProps = {
  event: OrganizationEvent;
  service: ServiceType | undefined;
  /** The `"2026-08-30"` day the card files under, which its date tile shows. */
  dayKey: string;
  today: string;
  /** The first day still to come, whose tile goes solid in the service's colour. */
  highlight?: boolean;
  /**
   * Adds the staffing meter and the smart-scheduling mark — the two things
   * only someone managing the roster needs to see.
   */
  showStaffing?: boolean;
  /** Whether the plan includes auto-fill. Without it the mark stays off. */
  autoFillAvailable?: boolean;
  onPress?: () => void;
};

/**
 * One event in the schedule.
 *
 * The leading date tile is what makes a stack of these read as a calendar:
 * the days line up down the left edge, each in its service's colour, so
 * scanning "when" costs one glance and never involves reading a name.
 */
export function EventCard({
  event,
  service,
  dayKey,
  today,
  highlight,
  showStaffing,
  autoFillAvailable = true,
  onPress,
}: EventCardProps) {
  const theme = useTheme();

  const time = formatTimeOn(event.dates, dayKey);
  // An accepted role outranks a pending one; a declined one never shows.
  const assignment =
    assignmentFor(event, "ACCEPTED") ?? assignmentFor(event, "PENDING");
  const staffing = showStaffing ? staffingFor(event) : null;
  const spansDays = isMultiDay(event.dates);
  const serviceColor = getServiceColors(service?.color ?? "indigo", theme).base;

  const content = (
    <HStack className="items-start gap-3 p-3">
      <DateTile
        dayKey={dayKey}
        today={today}
        service={service}
        solid={highlight}
      />

      {/* The service's stripe splits the "when" from the "what". */}
      <Box
        className="w-[3px] self-stretch rounded-full"
        style={{ backgroundColor: serviceColor }}
      />

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
          {showStaffing && autoFillAvailable && event.smartSchedulingEnabled ? (
            <Pill label="Auto-fill" tone="brand" icon={Sparkles} />
          ) : null}
        </HStack>

        {time ? <MetaLine icon={Clock}>{time}</MetaLine> : null}

        {spansDays ? (
          <MetaLine icon={Calendar}>{formatDateRange(event.dates)}</MetaLine>
        ) : null}

        <MetaLine icon={MapPin}>{event.location}</MetaLine>

        {staffing ? (
          <HStack className="pt-0.5">
            <StaffingMeter {...staffing} />
          </HStack>
        ) : null}
      </VStack>

      {/* The chevron is a promise. It appears once there is somewhere to go. */}
      {onPress ? (
        <AppIcon icon={ChevronRight} size={13} color={theme.textMuted} />
      ) : null}
    </HStack>
  );

  // An event with nowhere to go keeps the card's normal weight: a `disabled`
  // Pressable would render the whole thing at 40%.
  if (!onPress) return <VStack className={CARD_CLASS}>{content}</VStack>;

  // The label replaces everything inside the card for VoiceOver, so the day
  // and time the tile and clock line show have to be in it too.
  const label = [
    event.name,
    formatDayHeading(dayKey, today),
    time,
    staffing ? describeStaffing(staffing) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`${CARD_CLASS} data-[active=true]:opacity-80`}
    >
      {content}
    </Pressable>
  );
}

type DateTileProps = {
  dayKey: string;
  today: string;
  service: ServiceType | undefined;
  solid?: boolean;
  large?: boolean;
};

/**
 * `OCT`, `18`, `SUN` — the event detail tile's order — tinted in the service's
 * colour, or solid for the day that comes next, so the column of tiles down
 * the list reads as a column of services.
 */
export function DateTile({ dayKey, today, service, solid, large }: DateTileProps) {
  const theme = useTheme();
  const tint = getServiceColors(service?.color ?? "indigo", theme);
  const dark = theme.scheme === "dark";
  const tile = formatDateTile(keyToDate(dayKey));
  const size = large ? LARGE_TILE : TILE;
  const label = large
    ? "text-[12px] leading-[15px] tracking-[0.7px]"
    : "text-[10px] leading-[13px] tracking-[0.6px]";

  const colors = solid
    ? {
        bg: tint.base,
        border: tint.base,
        label: withAlpha("#FFFFFF", 0.85),
        day: "#FFFFFF",
      }
    : {
        bg: blendOver(theme.card, tint.base, dark ? 0.16 : 0.08),
        border: blendOver(theme.card, tint.base, dark ? 0.4 : 0.28),
        label: tint.text,
        day: theme.text,
      };

  return (
    <VStack
      className="items-center justify-center self-center border px-1 py-1.5"
      style={{
        minWidth: size.width,
        minHeight: size.height,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderRadius: TILE_RADIUS,
        borderCurve: "continuous",
        boxShadow: "0px 1px 0px rgba(0, 0, 0, 0.05)",
      }}
    >
      <Text
        className={`font-bold ${label}`}
        style={{ color: colors.label }}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_TILE_SCALE}
      >
        {tile.month}
      </Text>
      <Text
        className={`font-bold tracking-[-0.3px] ${
          large ? "text-[24px] leading-[28px]" : "text-[18px] leading-[21px]"
        }`}
        style={{ color: colors.day }}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_TILE_SCALE}
      >
        {tile.day}
      </Text>
      <Text
        className={`font-bold uppercase ${label}`}
        style={{ color: colors.label }}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_TILE_SCALE}
      >
        {dayKey === today ? "Today" : tile.weekday}
      </Text>
    </VStack>
  );
}

/** Widths cycle so a stack of placeholders reads as events, not as a grid. */
const SKELETON_WIDTHS = [190, 150, 215];

/** A placeholder shaped like {@link EventCard}, for the first load. */
export function EventCardSkeleton({ index = 0 }: { index?: number }) {
  const width = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];

  return (
    <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
      <HStack className="items-start gap-3 p-3">
        <Skeleton
          startColor="bg-border"
          className="self-center rounded-xl"
          style={TILE}
        />
        <Skeleton
          startColor="bg-border"
          className="w-[3px] self-stretch rounded-full"
        />

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
