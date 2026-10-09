import ArrowRight from "lucide-react-native/icons/arrow-right";
import Calendar from "lucide-react-native/icons/calendar";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import Clock from "lucide-react-native/icons/clock";
import MapPin from "lucide-react-native/icons/map-pin";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import {
  MetaLine,
  RoleChip,
  ServiceBadge,
} from "@/components/events/chips";
import { DateTile, DateTileSkeleton } from "@/components/events/event-card";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import {
  dayKey,
  formatDateRange,
  formatDayHeading,
  formatRehearsal,
  formatTimeOn,
  isMultiDay,
} from "@/lib/events/format";
import { assignmentFor, type UpNext } from "@/lib/events/schedule";
import type { ServiceType } from "@/types/event";

type UpNextCardProps = {
  upNext: UpNext;
  service: ServiceType | undefined;
  today: string;
  onPress?: () => void;
};

/** The event cards' surface, so this reads as the first of them, a size up. */
const CARD_CLASS = "mx-4 overflow-hidden rounded-2xl border border-border bg-card";

/**
 * The next thing the user has actually committed to.
 *
 * A volunteer opening this tab has one question, and it is almost never "what
 * does the whole month look like" — it is "when am I next up, and doing what".
 * Led like the event cards, with the next day's solid tile, and opened up into
 * the design's time and location tiles. The list below starts after it, so
 * this event is never shown twice.
 */
export function UpNextCard({ upNext, service, today, onPress }: UpNextCardProps) {
  const theme = useTheme();
  const serviceColors = getServiceColors(service?.color ?? "indigo", theme);
  const { event, date } = upNext;

  const key = dayKey(date.startTime);
  const time = formatTimeOn(event.dates, key);
  const role = assignmentFor(event, "ACCEPTED")?.role ?? null;
  const rehearsal = formatRehearsal(event.rehearsalStart, event.rehearsalEnd);

  const content = (
    <>
      <VStack className="p-4">
        <HStack className="items-center gap-3.5">
          <DateTile dayKey={key} today={today} service={service} solid large />

          <Box
            className="w-[3px] self-stretch rounded-full"
            style={{ backgroundColor: serviceColors.base }}
          />

          <VStack className="flex-1 gap-2">
            <Text
              className="text-[18px] font-bold leading-[23px] tracking-[-0.3px] text-foreground"
              numberOfLines={2}
            >
              {event.name}
            </Text>
            <HStack>
              <ServiceBadge service={service} />
            </HStack>
            {isMultiDay(event.dates) ? (
              <MetaLine icon={Calendar}>{formatDateRange(event.dates)}</MetaLine>
            ) : null}
          </VStack>
        </HStack>

        <HStack className="mt-3.5 gap-2">
          <InfoTile icon={Clock} label="Time" value={time} />
          <InfoTile icon={MapPin} label="Location" value={event.location} />
        </HStack>

        {/* Optional, and dated on its own: it rarely falls on the service day. */}
        {rehearsal ? (
          <HStack className="mt-2">
            <InfoTile icon={CalendarClock} label="Rehearsal" value={rehearsal} />
          </HStack>
        ) : null}

        {role || onPress ? (
          <HStack className="mt-3.5 items-center justify-between border-t border-border pt-3">
            {role ? <RoleChip role={role} /> : <Box />}
            {onPress ? (
              <HStack className="items-center gap-1">
                <Text
                  className="text-[12.5px] font-semibold"
                  style={{ color: serviceColors.text }}
                >
                  View event
                </Text>
                <AppIcon icon={ArrowRight} size={13} color={serviceColors.text} />
              </HStack>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
    </>
  );

  // Nowhere to go keeps the card at full strength: a `disabled` Pressable
  // would render the whole card at 40%.
  if (!onPress) {
    return <VStack className={CARD_CLASS}>{content}</VStack>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[event.name, formatDayHeading(key, today), time]
        .filter(Boolean)
        .join(", ")}
      className={`${CARD_CLASS} data-[active=true]:opacity-80`}
    >
      {content}
    </Pressable>
  );
}

/** A placeholder shaped like {@link UpNextCard}, for the first load. */
export function UpNextCardSkeleton() {
  return (
    <VStack className={CARD_CLASS}>
      <VStack className="p-4">
        <HStack className="items-center gap-3.5">
          <DateTileSkeleton large />
          <Skeleton
            startColor="bg-border"
            className="w-[3px] self-stretch rounded-full"
          />
          <VStack className="flex-1 gap-2">
            <Skeleton startColor="bg-border" style={{ width: 170, height: 18 }} />
            <Skeleton startColor="bg-border" style={{ width: 84, height: 17 }} />
          </VStack>
        </HStack>

        <HStack className="mt-3.5 gap-2">
          <Skeleton startColor="bg-border" className="flex-1 rounded-xl" style={{ height: 56 }} />
          <Skeleton startColor="bg-border" className="flex-1 rounded-xl" style={{ height: 56 }} />
        </HStack>

        <HStack className="mt-3.5 items-center justify-between border-t border-border pt-3">
          <Skeleton startColor="bg-border" style={{ width: 88, height: 20 }} />
          <Skeleton startColor="bg-border" style={{ width: 72, height: 13 }} />
        </HStack>
      </VStack>
    </VStack>
  );
}

/** An icon-led label over its value, two to a row, as on the event page. */
function InfoTile({
  icon,
  label,
  value,
}: {
  icon: AppIconName;
  label: string;
  value: string;
}) {
  const theme = useTheme();

  return (
    <VStack className="flex-1 gap-1 rounded-xl border border-border bg-surface/60 p-2.5">
      <HStack className="items-center gap-1.5">
        <AppIcon icon={icon} size={11} color={theme.textMuted} />
        <Text className="text-[10px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
          {label}
        </Text>
      </HStack>
      <Text
        className="text-[13px] font-semibold leading-[18px] text-foreground"
        numberOfLines={2}
      >
        {value}
      </Text>
    </VStack>
  );
}
