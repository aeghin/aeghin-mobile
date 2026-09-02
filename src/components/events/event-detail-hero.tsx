import { ServiceBadge, ServiceRail } from "@/components/events/chips";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { earliestDate, formatDateTile } from "@/lib/events/format";
import { tintedGlow, tintedSheen } from "@/lib/gradients";
import type { EventDetails } from "@/types/event";

/** Matches the web's 64px tile, which is also a comfortable thumb-sized block. */
const TILE = 64;

/**
 * The top of the event screen: what this is, when it starts, and what kind of
 * service it belongs to.
 *
 * Washed in the service type's own colour rather than the brand's — the
 * dashboard's hero does the same, and it is what makes two events on one
 * calendar tell themselves apart before either name is read.
 */
export function EventDetailHero({ event }: { event: EventDetails }) {
  const theme = useTheme();
  const colors = getServiceColors(event.serviceType.color, theme);

  const first = earliestDate(event.dates);
  const tile = first ? formatDateTile(first.startTime) : null;

  return (
    <VStack
      className="mx-4 overflow-hidden rounded-2xl border border-border bg-card"
      style={tintedSheen(theme.card, colors.base, colors.sheenAlpha)}
    >
      <ServiceRail service={event.serviceType} />

      <Box
        pointerEvents="none"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full"
        style={tintedGlow(colors.base, "lead", colors.glowSoftAlpha)}
      />
      <Box
        pointerEvents="none"
        className="absolute -bottom-14 -left-14 h-32 w-32 rounded-full"
        style={tintedGlow(colors.base, "trail", colors.glowStrongAlpha)}
      />

      <HStack className="items-start gap-3.5 py-4 pl-[17px] pr-4">
        {tile ? (
          <VStack
            className="items-center justify-center rounded-2xl border border-border bg-surface"
            style={{
              width: TILE,
              height: TILE,
              // `shadow-lg shadow-<c>-500/10`: the tile is lit by its own
              // service rather than by a neutral grey.
              boxShadow: `0px 8px 15px ${withAlpha(colors.base, colors.shadowAlpha)}`,
            }}
          >
            <Text className="text-[10px] font-bold tracking-[1.1px] text-muted-foreground">
              {tile.month}
            </Text>
            <Text className="text-[26px] font-bold leading-[30px] tracking-[-0.6px] text-foreground">
              {tile.day}
            </Text>
            <Text className="text-[10px] tracking-[0.5px] text-muted-foreground">
              {tile.weekday}
            </Text>
          </VStack>
        ) : null}

        <VStack className="flex-1 gap-2 pt-0.5">
          <HStack>
            <ServiceBadge service={event.serviceType} />
          </HStack>

          <Text className="text-[22px] font-bold leading-[27px] tracking-[-0.5px] text-foreground">
            {event.name}
          </Text>

          {event.description ? (
            <Text className="text-[13.5px] leading-[19px] text-muted-foreground">
              {event.description}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </VStack>
  );
}

/** Holds the hero's shape while the event loads. */
export function EventDetailHeroSkeleton() {
  return (
    <VStack className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
      <HStack className="items-start gap-3.5 py-4 pl-[17px] pr-4">
        <Skeleton
          startColor="bg-border"
          className="rounded-2xl"
          style={{ width: TILE, height: TILE }}
        />

        <VStack className="flex-1 gap-2 pt-0.5">
          <Skeleton startColor="bg-border" style={{ width: 92, height: 18 }} />
          <Skeleton startColor="bg-border" style={{ width: 210, height: 20 }} />
          <Skeleton startColor="bg-border" style={{ width: 170, height: 13 }} />
        </VStack>
      </HStack>
    </VStack>
  );
}
