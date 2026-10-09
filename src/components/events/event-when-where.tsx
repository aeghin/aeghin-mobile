import CalendarClock from "lucide-react-native/icons/calendar-clock";
import Clock from "lucide-react-native/icons/clock";
import MapPin from "lucide-react-native/icons/map-pin";
import { useRef } from "react";
import { ScrollView, type LayoutChangeEvent } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors, type ServiceColors } from "@/lib/config/service-types";
import {
  dayKey,
  formatRehearsal,
  formatShortDate,
  formatTime,
  isMultiDay,
  sortDates,
  todayKey,
} from "@/lib/events/format";
import type { EventDate, ServiceType } from "@/types/event";

/** The hero's padding, which the row of days scrolls out under. */
const BLEED = 16;

/** Keeps the days in a scrolling row much the same width, whatever their hours. */
const DAY_MIN_WIDTH = 140;

type Tile = {
  key: string;
  icon: AppIconName;
  label: string;
  value: string;
  /** Where a block sits against today, once the event is under way. */
  when?: "done" | "today";
};

/**
 * When the event runs and where, as the Upcoming card's boxes.
 *
 * One tile per block rather than a single start and end: an event is a list
 * of `EventDate`s, which is what lets a conference or a weekend of rehearsals
 * be one event, and collapsing them to "Saturday to Sunday" would lose the
 * times somebody actually has to turn up at. Past one block they get a row of
 * their own, so a week is no taller than a weekend, and the place and the
 * rehearsal share one box beneath it.
 */
export function EventWhenWhere({
  dates,
  location,
  service,
  rehearsalStart = null,
  rehearsalEnd = null,
}: {
  dates: EventDate[];
  location: string;
  service: ServiceType;
  rehearsalStart?: string | null;
  rehearsalEnd?: string | null;
}) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);

  const sorted = sortDates(dates);
  const rehearsal = formatRehearsal(rehearsalStart, rehearsalEnd);
  // Only a genuine change of calendar day earns a date on every time tile —
  // two blocks on one morning would otherwise print the same date twice.
  const spansDays = isMultiDay(dates);

  // Only an event under way marks its blocks: a finished one would fade every
  // tile, and an upcoming one has nothing behind it yet.
  const today = todayKey();
  const keys = sorted.map((date) => dayKey(date.startTime));
  const underWay = keys.some((key) => key < today) && keys.some((key) => key >= today);
  const stateOf = (key: string): Tile["when"] =>
    key === today ? "today" : underWay && key < today ? "done" : undefined;

  const blocks: Tile[] = sorted.map((date, index) => ({
    key: date.id,
    icon: Clock,
    label: spansDays
      ? `${keys[index] === today ? "Today · " : ""}${formatShortDate(date.startTime)}`
      : keys[index] === today
        ? "Today"
        : "Time",
    value: `${formatTime(date.startTime)} – ${formatTime(date.endTime)}`,
    when: stateOf(keys[index]),
  }));

  const where: Tile = { key: "where", icon: MapPin, label: "Location", value: location };

  // One block keeps its time beside the place, and the rehearsal under both.
  if (blocks.length <= 1) {
    return (
      <VStack className="gap-2">
        <HStack className="gap-2">
          {[...blocks, where].map((tile) => (
            <BlockTile key={tile.key} tile={tile} colors={colors} />
          ))}
        </HStack>

        {/* Dated on its own line: it rarely falls on the service day. */}
        {rehearsal ? (
          <HStack>
            <InfoTile icon={CalendarClock} label="Rehearsal" value={rehearsal} />
          </HStack>
        ) : null}
      </VStack>
    );
  }

  // One box for the place and the rehearsal, each label against its value:
  // beside a row of days, a short place like "Sanctuary" left most of a box
  // of its own empty.
  return (
    <VStack className="gap-2">
      <DayRow tiles={blocks} colors={colors} />

      <VStack className="rounded-xl border border-border bg-surface/60">
        <DetailRow icon={MapPin} label="Location" value={location} />
        {/* Date over time, so the value breaks where it reads. */}
        {rehearsal ? (
          <>
            <Divider style={{ marginHorizontal: 10 }} />
            <DetailRow
              icon={CalendarClock}
              label="Rehearsal"
              value={rehearsal.replace(" · ", "\n")}
            />
          </>
        ) : null}
      </VStack>
    </VStack>
  );
}

/** A label on the left and its value on the right, in the box under a row of days. */
function DetailRow({ icon, label, value }: { icon: AppIconName; label: string; value: string }) {
  const theme = useTheme();

  return (
    <HStack className="items-center gap-3 p-2.5">
      <HStack className="items-center gap-1.5">
        <AppIcon icon={icon} size={11} color={theme.textMuted} />
        <Text className="text-[10px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
          {label}
        </Text>
      </HStack>
      <Text
        className="flex-1 text-right text-[13px] font-semibold leading-[18px] text-foreground"
        numberOfLines={3}
      >
        {value}
      </Text>
    </HStack>
  );
}

/**
 * Every block on one line. Two share it evenly; past that the row scrolls
 * sideways and runs out under the hero's padding, so the next day peeks in
 * at the edge.
 */
function DayRow({ tiles, colors }: { tiles: Tile[]; colors: ServiceColors }) {
  const scrollRef = useRef<ScrollView>(null);
  const placed = useRef(false);

  if (tiles.length <= 2) {
    return (
      <HStack className="gap-2">
        {tiles.map((tile) => (
          <BlockTile key={tile.key} tile={tile} colors={colors} />
        ))}
      </HStack>
    );
  }

  // While the event is under way the row opens on today, not its first day.
  const showToday = (event: LayoutChangeEvent) => {
    if (placed.current) return;
    placed.current = true;
    scrollRef.current?.scrollTo({
      x: Math.max(0, event.nativeEvent.layout.x - BLEED),
      animated: false,
    });
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -BLEED }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: BLEED }}
    >
      {tiles.map((tile) => (
        <BlockTile
          key={tile.key}
          tile={tile}
          colors={colors}
          fill={false}
          onLayout={tile.when === "today" ? showToday : undefined}
        />
      ))}
    </ScrollView>
  );
}

/** A tile for one block or the place, with today's block in the service's colours. */
function BlockTile({
  tile,
  colors,
  fill,
  onLayout,
}: {
  tile: Tile;
  colors: ServiceColors;
  fill?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <InfoTile
      icon={tile.icon}
      label={tile.label}
      value={tile.value}
      tint={tile.when === "today" ? colors : undefined}
      faded={tile.when === "done"}
      lines={3}
      fill={fill}
      onLayout={onLayout}
    />
  );
}

/**
 * An icon-led label over its value, drawn like the Upcoming card's boxes so the
 * page opens on the card that led to it. Today's block wears the service's
 * colours; a finished one recedes.
 */
function InfoTile({
  icon,
  label,
  value,
  tint,
  faded,
  lines = 2,
  fill = true,
  onLayout,
}: {
  icon: AppIconName;
  label: string;
  value: string;
  tint?: ServiceColors;
  faded?: boolean;
  lines?: number;
  /** Share the line with its neighbours, or size to its own words in a scrolling row. */
  fill?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();

  return (
    <VStack
      className={`gap-1 rounded-xl border p-2.5 ${fill ? "flex-1" : ""} ${
        tint ? "" : "border-border bg-surface/60"
      }`}
      style={{
        opacity: faded ? 0.5 : 1,
        ...(fill ? null : { minWidth: DAY_MIN_WIDTH }),
        ...(tint
          ? { borderColor: withAlpha(tint.base, 0.45), backgroundColor: tint.surface }
          : null),
      }}
      onLayout={onLayout}
    >
      <HStack className="items-center gap-1.5">
        <AppIcon icon={icon} size={11} color={tint ? tint.text : theme.textMuted} />
        <Text
          className={`shrink text-[10px] font-semibold uppercase tracking-[0.3px] ${
            tint ? "" : "text-muted-foreground"
          }`}
          style={tint ? { color: tint.text } : undefined}
          numberOfLines={1}
        >
          {label}
        </Text>
      </HStack>
      <Text
        className="text-[13px] font-semibold leading-[18px] text-foreground"
        numberOfLines={lines}
      >
        {value}
      </Text>
    </VStack>
  );
}

/** Holds the tiles' shape while the event loads. Two: the usual shape. */
export function EventWhenWhereSkeleton() {
  return (
    <HStack className="gap-2">
      {[110, 90].map((width) => (
        <VStack key={width} className="flex-1 gap-1.5 rounded-xl border border-border p-2.5">
          <Skeleton startColor="bg-border" style={{ width: 44, height: 9 }} />
          <Skeleton startColor="bg-border" style={{ width, height: 13 }} />
        </VStack>
      ))}
    </HStack>
  );
}
