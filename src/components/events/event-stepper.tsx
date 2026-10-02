import { Stack } from "expo-router";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";

import { AppIcon } from "@/components/app-icon";
import { HeaderCapsule } from "@/components/header-capsule";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { useTheme } from "@/hooks/use-theme";
import { formatShortDate } from "@/lib/events/format";
import type { EventNeighbor } from "@/types/event";

type EventStepperProps = {
  previous: EventNeighbor | null;
  next: EventNeighbor | null;
  /** The service type being stepped through, so VoiceOver can say which. */
  serviceName: string;
  /** Its colour, for the dot between the arrows — the web pager's mark. */
  dotColor: string;
  /** A step is still loading: both arrows hold their place, disabled. */
  busy?: boolean;
  onStep: (target: EventNeighbor) => void;
};

/**
 * Previous and next in the header, the phone's half of the web pager: the same
 * ‹ › either side of the service type's dot, so the two read alike. One capsule
 * for both, as the bell and the switcher share one — as separate toolbar items
 * UIKit would set them 16pt apart.
 *
 * An end with nowhere to go stays, dimmed, rather than leaving: the other arrow
 * then keeps its place under a thumb that's tapping through.
 */
export function EventStepper({
  previous,
  next,
  serviceName,
  dotColor,
  busy = false,
  onStep,
}: EventStepperProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View hidesSharedBackground>
        <HeaderCapsule>
          <HStack className="items-center px-1">
            <Step
              direction="previous"
              target={previous}
              serviceName={serviceName}
              busy={busy}
              onStep={onStep}
            />
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
            <Step
              direction="next"
              target={next}
              serviceName={serviceName}
              busy={busy}
              onStep={onStep}
            />
          </HStack>
        </HeaderCapsule>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}

function Step({
  direction,
  target,
  serviceName,
  busy,
  onStep,
}: {
  direction: "previous" | "next";
  target: EventNeighbor | null;
  serviceName: string;
  busy: boolean;
  onStep: (target: EventNeighbor) => void;
}) {
  const theme = useTheme();
  const label = direction === "next" ? "Next" : "Previous";
  const enabled = target !== null && !busy;

  return (
    <Pressable
      onPress={target ? () => onStep(target) : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={
        target
          ? `${label} ${serviceName}: ${target.name}, ${formatShortDate(target.startTime)}`
          : busy
            ? `${label} ${serviceName}`
            : `No ${label.toLowerCase()} ${serviceName}`
      }
      accessibilityState={{ disabled: !enabled, busy }}
      className="h-11 w-10 items-center justify-center data-[active=true]:opacity-60"
      // Only when dimmed: a style opacity would override the pressed one.
      style={enabled ? undefined : { opacity: 0.35 }}
    >
      <AppIcon
        icon={direction === "next" ? ChevronRight : ChevronLeft}
        size={20}
        color={theme.text}
      />
    </Pressable>
  );
}
