import { Pill } from "@/components/events/chips";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { formatDayHeading } from "@/lib/events/format";

type DayHeadingProps = {
  /** A `"2026-08-30"` day key. */
  dayKey: string;
  /** Today, in the same form — the heading goes relative for the nearest days. */
  today: string;
  /** The first still-to-come day in the list, which gets the accent. */
  isNext?: boolean;
};

/**
 * The rule above one day's events.
 *
 * The trailing hairline does the separating so the date itself can stay small:
 * a full-width heavy heading between every two or three cards would out-shout
 * the cards it introduces.
 */
export function DayHeading({ dayKey, today, isNext }: DayHeadingProps) {
  return (
    <HStack className="items-center gap-2.5">
      <Text className="text-[14px] font-bold tracking-[-0.2px] text-foreground">
        {formatDayHeading(dayKey, today)}
      </Text>

      {isNext ? <Pill label="Next up" tone="success" /> : null}

      <Box className="h-px flex-1 bg-border" />
    </HStack>
  );
}
