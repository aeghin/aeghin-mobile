import type { ReactNode } from "react";

import { ActionMenu, type ActionMenuItem } from "@/components/action-menu";
import { ServiceBadge } from "@/components/events/chips";
import { DateTile } from "@/components/events/event-card";
import { EventWhenWhere, EventWhenWhereSkeleton } from "@/components/events/event-when-where";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { dayKey, earliestDate, todayKey } from "@/lib/events/format";
import type { EventDetails } from "@/types/event";

/** Room the ⋮ needs in the corner it shares with the name. */
const MENU_CLEARANCE = 30;

/** The Upcoming card's tile, so the page opens on the card that led to it. */
const TILE_SKELETON = { width: 60, height: 76 };

type EventDetailHeroProps = {
  event: EventDetails;
  /**
   * Managers only: what the ⋮ in the top corner offers.
   *
   * The dashboard hangs its event menu off this same corner, and for the same
   * reason — editing and deleting act on the *whole* event, so neither belongs
   * beside one section of it the way the roster and setlist actions do.
   */
  actions?: ActionMenuItem[];
  /** The previous/next pager, drawn as the card's footer. */
  pager?: ReactNode;
};

/**
 * The top of the event screen: what this is, when and where, and the way to
 * the one before and after it.
 *
 * Built like the Upcoming card on the Events tab — the solid date tile in the
 * service's colour, its stripe, then the name — so tapping that card opens on
 * the same shape, grown to hold every block and the pager.
 *
 * The tile is the only place the day is written: the blocks below give their
 * own date only when the event runs over more than one.
 */
export function EventDetailHero({ event, actions, pager }: EventDetailHeroProps) {
  const theme = useTheme();
  const colors = getServiceColors(event.serviceType.color, theme);
  const first = earliestDate(event.dates);
  const menu = actions && actions.length > 0;

  return (
    <VStack className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
      {menu ? (
        <Box className="absolute right-2 top-2 z-10">
          <ActionMenu label={`Actions for ${event.name}`} items={actions} />
        </Box>
      ) : null}

      <VStack className="gap-3.5 p-4">
        <HStack className="items-center gap-3.5">
          {first ? (
            <DateTile
              dayKey={dayKey(first.startTime)}
              today={todayKey()}
              service={event.serviceType}
              solid
              large
            />
          ) : null}

          {/* The service's stripe splits the "when" from the "what". */}
          <Box
            className="w-[3px] self-stretch rounded-full"
            style={{ backgroundColor: colors.base }}
          />

          <VStack className="flex-1 gap-2">
            <Text
              className="text-[20px] font-bold leading-[25px] tracking-[-0.4px] text-foreground"
              style={{ paddingRight: menu ? MENU_CLEARANCE : 0 }}
            >
              {event.name}
            </Text>
            <HStack>
              <ServiceBadge service={event.serviceType} />
            </HStack>
          </VStack>
        </HStack>

        {event.description ? (
          <Text className="text-[13.5px] leading-[19px] text-muted-foreground">
            {event.description}
          </Text>
        ) : null}

        <EventWhenWhere
          dates={event.dates}
          location={event.location}
          service={event.serviceType}
          rehearsalStart={event.rehearsalStart}
          rehearsalEnd={event.rehearsalEnd}
        />

        {pager}
      </VStack>
    </VStack>
  );
}

/** Holds the hero's shape while the event loads. */
export function EventDetailHeroSkeleton() {
  return (
    <VStack className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
      <VStack className="gap-3.5 p-4">
        <HStack className="items-center gap-3.5">
          <Skeleton startColor="bg-border" className="rounded-xl" style={TILE_SKELETON} />
          <Skeleton startColor="bg-border" className="w-[3px] self-stretch rounded-full" />

          <VStack className="flex-1 gap-2">
            <Skeleton startColor="bg-border" style={{ width: 190, height: 20 }} />
            <Skeleton startColor="bg-border" style={{ width: 96, height: 18 }} />
          </VStack>
        </HStack>

        <EventWhenWhereSkeleton />
      </VStack>
    </VStack>
  );
}
