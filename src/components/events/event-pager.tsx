import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";

import { AppIcon } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { formatDayMonth, formatShortDate } from "@/lib/events/format";
import type { EventNeighbor } from "@/types/event";

const ARROW = 28;

type EventPagerProps = {
  previous: EventNeighbor | null;
  next: EventNeighbor | null;
  /** The service type being stepped through, named between the arrows. */
  serviceName: string;
  /** Its colours: the dot beside the name, the web pager's mark, and the arrows. */
  service: { base: string; text: string };
  onStep: (target: EventNeighbor) => void;
};

/**
 * Previous and next of the same service type, as the footer of the event's
 * card. Each arrow carries the date it goes to, so a step is a choice rather
 * than a guess.
 *
 * An end with nowhere to go stays, dimmed, rather than leaving: the other
 * arrow then keeps its place under a thumb that's tapping through.
 */
export function EventPager({ previous, next, serviceName, service, onStep }: EventPagerProps) {
  return (
    <HStack className="items-center gap-2 border-t border-border pt-3">
      <Step
        direction="previous"
        target={previous}
        serviceName={serviceName}
        color={service.text}
        onStep={onStep}
      />

      <HStack className="min-w-0 flex-1 items-center justify-center gap-1.5">
        <Box style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: service.base }} />
        <Text className="shrink text-[13px] font-semibold text-muted-foreground" numberOfLines={1}>
          {serviceName}
        </Text>
      </HStack>

      <Step
        direction="next"
        target={next}
        serviceName={serviceName}
        color={service.text}
        onStep={onStep}
      />
    </HStack>
  );
}

function Step({
  direction,
  target,
  serviceName,
  color,
  onStep,
}: {
  direction: "previous" | "next";
  target: EventNeighbor | null;
  serviceName: string;
  color: string;
  onStep: (target: EventNeighbor) => void;
}) {
  const forward = direction === "next";
  const label = forward ? "Next" : "Previous";

  const arrow = (
    <Center
      className="rounded-lg border border-border bg-card"
      style={{ width: ARROW, height: ARROW, borderCurve: "continuous" }}
    >
      <AppIcon icon={forward ? ChevronRight : ChevronLeft} size={14} color={color} />
    </Center>
  );

  const date = (
    <Text
      className="text-[12px] font-semibold text-foreground"
      style={{ fontVariant: ["tabular-nums"] }}
    >
      {target ? formatDayMonth(target.startTime) : forward ? "Latest" : "First"}
    </Text>
  );

  return (
    <Pressable
      onPress={target ? () => onStep(target) : undefined}
      disabled={!target}
      accessibilityRole="button"
      accessibilityLabel={
        target
          ? `${label} ${serviceName}: ${target.name}, ${formatShortDate(target.startTime)}`
          : `No ${label.toLowerCase()} ${serviceName}`
      }
      accessibilityState={{ disabled: !target }}
      hitSlop={8}
      className="data-[active=true]:opacity-60"
      // Only when dimmed: a style opacity would override the pressed one.
      style={target ? undefined : { opacity: 0.4 }}
    >
      <HStack className="items-center gap-2">
        {forward ? date : arrow}
        {forward ? arrow : date}
      </HStack>
    </Pressable>
  );
}
