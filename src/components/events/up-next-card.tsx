import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import { MetaLine, Pill, RoleChip, ServiceBadge } from "@/components/events/chips";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { countdownLabel, formatShortDate, formatTime } from "@/lib/events/format";
import { assignmentFor, type UpNext } from "@/lib/events/schedule";
import { brandGlow, brandSheen } from "@/lib/gradients";
import type { ServiceType } from "@/types/event";

const CALENDAR_CLOCK: AppSymbolName = {
  ios: "calendar.badge.clock",
  android: "event",
};
const CLOCK: AppSymbolName = { ios: "clock", android: "schedule" };
const PIN: AppSymbolName = { ios: "mappin.and.ellipse", android: "place" };
const CHEVRON: AppSymbolName = { ios: "chevron.right", android: "chevron_right" };

type UpNextCardProps = {
  upNext: UpNext;
  service: ServiceType | undefined;
  onPress?: () => void;
};

/**
 * The next thing the user has actually committed to.
 *
 * A volunteer opening this tab has one question, and it is almost never "what
 * does the whole month look like" — it is "when am I next up, and doing what".
 * The hero answers that before any filter has been touched, which is why it
 * sits above the controls rather than inside the list.
 */
export function UpNextCard({ upNext, service, onPress }: UpNextCardProps) {
  const theme = useTheme();
  const { event, date, inDays } = upNext;

  const role = assignmentFor(event, "ACCEPTED")?.role ?? null;
  const imminent = inDays <= 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Up next: ${event.name}, ${countdownLabel(inDays)}`}
      className="mx-4 overflow-hidden rounded-3xl border border-border bg-card data-[active=true]:opacity-80"
      style={brandSheen(theme.card)}
    >
      {/* The warm bloom the web dashboard gets from a blurred primary circle. */}
      <Box
        pointerEvents="none"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full"
        style={brandGlow("lead")}
      />

      <VStack className="gap-3 p-4">
        <HStack className="items-center gap-2.5">
          <Center className="h-9 w-9 rounded-xl bg-brand/10">
            <AppSymbol name={CALENDAR_CLOCK} size={18} tint={brand.orange} />
          </Center>

          <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.1px] text-muted-foreground">
            Up next
          </Text>

          <Pill
            label={countdownLabel(inDays)}
            tone={imminent ? "success" : "brand"}
          />
        </HStack>

        <HStack className="items-center gap-2">
          <VStack className="flex-1 gap-2">
            <Text
              className="text-[19px] font-bold leading-6 tracking-[-0.4px] text-foreground"
              numberOfLines={2}
            >
              {event.name}
            </Text>

            <HStack className="flex-wrap items-center gap-1.5">
              <ServiceBadge service={service} />
              {role ? <RoleChip role={role} /> : null}
            </HStack>
          </VStack>

          {onPress ? (
            <AppSymbol name={CHEVRON} size={14} tint={theme.textMuted} />
          ) : null}
        </HStack>

        <Divider />

        <VStack className="gap-1.5">
          <MetaLine symbol={CLOCK}>
            {`${formatShortDate(date.startTime)} · ${formatTime(date.startTime)} – ${formatTime(date.endTime)}`}
          </MetaLine>
          <MetaLine symbol={PIN}>{event.location}</MetaLine>
        </VStack>
      </VStack>
    </Pressable>
  );
}
