import Calendar from "lucide-react-native/icons/calendar";
import Clock from "lucide-react-native/icons/clock";
import MapPin from "lucide-react-native/icons/map-pin";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { DetailCard } from "@/components/events/event-detail-parts";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import {
  formatDateSpan,
  formatShortDate,
  formatTime,
  isMultiDay,
  sortDates,
} from "@/lib/events/format";
import { tintedGlow, tintedSheen } from "@/lib/gradients";
import type { EventDate, ServiceType } from "@/types/event";

const ICON_TILE = 34;
/** Where the hairlines start, so they line up with the labels not the glyphs. */
const SEPARATOR_INSET = 14 + ICON_TILE + 12;

type Row = {
  key: string;
  icon: AppIconName;
  label: string;
  value: string;
};

/**
 * When the event runs and where.
 *
 * One row per block rather than a single start and end: an event is a list of
 * `EventDate`s, which is what lets a conference or a weekend of rehearsals be
 * one event, and collapsing them to "Saturday to Sunday" would lose the times
 * somebody actually has to turn up at.
 */
export function EventWhenWhereCard({
  dates,
  location,
  service,
}: {
  dates: EventDate[];
  location: string;
  service: ServiceType;
}) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);

  const sorted = sortDates(dates);
  // Only a genuine change of calendar day earns a date on every time row —
  // two blocks on one morning would otherwise print the same date twice.
  const spansDays = isMultiDay(dates);

  const rows: Row[] = [
    ...(sorted.length > 0
      ? [
          {
            key: "date",
            icon: Calendar,
            label: "Date",
            value: formatDateSpan(dates),
          },
        ]
      : []),

    ...sorted.map((date) => ({
      key: date.id,
      icon: Clock,
      label: spansDays ? formatShortDate(date.startTime) : "Time",
      value: `${formatTime(date.startTime)} – ${formatTime(date.endTime)}`,
    })),

    { key: "where", icon: MapPin, label: "Where", value: location },
  ];

  return (
    <DetailCard style={tintedSheen(theme.card, colors.base, colors.sheenAlpha)}>
      {/* The web washes this card exactly like the hero, but with the quieter
          bloom on both corners rather than one of each. */}
      <Box
        pointerEvents="none"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full"
        style={tintedGlow(colors.base, "lead", colors.glowSoftAlpha)}
      />
      <Box
        pointerEvents="none"
        className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full"
        style={tintedGlow(colors.base, "trail", colors.glowSoftAlpha)}
      />

      {rows.map((row, index) => (
        <VStack key={row.key}>
          {index > 0 ? <Divider style={{ marginLeft: SEPARATOR_INSET }} /> : null}

          <HStack className="items-center gap-3 px-3.5 py-2.5">
            <Center
              className="shrink-0 rounded-xl bg-surface"
              style={{ width: ICON_TILE, height: ICON_TILE }}
            >
              <AppIcon icon={row.icon} size={15} color={theme.textMuted} />
            </Center>

            <VStack className="min-w-0 flex-1 gap-px">
              <Text className="text-[10px] font-bold uppercase tracking-[0.9px] text-muted-foreground">
                {row.label}
              </Text>
              <Text
                className="text-[14px] font-medium text-foreground"
                numberOfLines={2}
              >
                {row.value}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      ))}
    </DetailCard>
  );
}

/** Holds the card's shape while the event loads. Three rows: the usual shape. */
export function EventWhenWhereCardSkeleton() {
  return (
    <DetailCard>
      {[0, 1, 2].map((row) => (
        <VStack key={row}>
          {row > 0 ? <Divider style={{ marginLeft: SEPARATOR_INSET }} /> : null}

          <HStack className="items-center gap-3 px-3.5 py-2.5">
            <Skeleton
              startColor="bg-border"
              className="rounded-xl"
              style={{ width: ICON_TILE, height: ICON_TILE }}
            />
            <VStack className="flex-1 gap-1.5">
              <Skeleton startColor="bg-border" style={{ width: 44, height: 9 }} />
              <Skeleton
                startColor="bg-border"
                style={{ width: [190, 130, 155][row], height: 13 }}
              />
            </VStack>
          </HStack>
        </VStack>
      ))}
    </DetailCard>
  );
}
