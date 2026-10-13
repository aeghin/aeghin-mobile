import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useMemo } from "react";
import { PanResponder } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { monthWeeks } from "@/lib/blockouts";
import { formatMonth, formatShortDate, keyToDate, shiftMonth } from "@/lib/events/format";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** A day's row height: a 32pt circle for today, with room under it for the dot. */
const CELL = 42;

/** How far a sideways drag must travel to turn the month. */
const SWIPE = 40;

type BlockoutCalendarProps = {
  /** The `"2026-10"` month on screen. */
  month: string;
  onMonthChange: (month: string) => void;
  /** The months the arrows and swipes stay inside. */
  firstMonth: string;
  lastMonth: string;
  blocked: Set<string>;
  scheduled: Set<string>;
  /** The church's today, as a day key. */
  today: string;
};

/**
 * One month at a time — the dashboard shows two side by side, which a phone
 * hasn't the width for. Blocked days join into one band per run, rounded at
 * its ends, the way the phone's own calendars mark a span; a dot under a day
 * is something you said yes to. Swipe sideways or use the arrows to move.
 */
export function BlockoutCalendar({
  month,
  onMonthChange,
  firstMonth,
  lastMonth,
  blocked,
  scheduled,
  today,
}: BlockoutCalendarProps) {
  const theme = useTheme();
  const band = withAlpha(theme.destructive, 0.13);
  const canGoBack = month > firstMonth;
  const canGoOn = month < lastMonth;

  // Claims only a drag that is plainly sideways, so the page still scrolls.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx <= -SWIPE && canGoOn) onMonthChange(shiftMonth(month, 1));
          if (gesture.dx >= SWIPE && canGoBack) onMonthChange(shiftMonth(month, -1));
        },
      }),
    [month, canGoBack, canGoOn, onMonthChange],
  );

  const runsInto = (day: string | null) => day !== null && blocked.has(day);

  return (
    <VStack className="rounded-2xl border border-border bg-card px-2 pb-3 pt-3">
      <HStack className="items-center justify-between pb-2 pl-2.5">
        <Text className="text-[17px] font-semibold text-foreground">{formatMonth(month)}</Text>
        <HStack className="gap-1.5">
          <StepButton
            icon={ChevronLeft}
            label="Previous month"
            disabled={!canGoBack}
            onPress={() => onMonthChange(shiftMonth(month, -1))}
          />
          <StepButton
            icon={ChevronRight}
            label="Next month"
            disabled={!canGoOn}
            onPress={() => onMonthChange(shiftMonth(month, 1))}
          />
        </HStack>
      </HStack>

      <VStack {...swipe.panHandlers}>
        <HStack className="pb-1">
          {WEEKDAYS.map((weekday, index) => (
            <Text
              key={index}
              className="flex-1 text-center text-[11px] font-semibold text-muted-foreground"
            >
              {weekday}
            </Text>
          ))}
        </HStack>

        {monthWeeks(month).map((week, row) => (
          <HStack key={row}>
            {week.map((day, column) => {
              if (day === null) return <Box key={column} style={{ flex: 1, height: CELL }} />;

              const isBlocked = blocked.has(day);
              const joinsLeft = isBlocked && runsInto(week[column - 1] ?? null);
              const joinsRight = isBlocked && runsInto(week[column + 1] ?? null);
              const isScheduled = scheduled.has(day);
              const isToday = day === today;
              const isPast = day < today;

              return (
                <Box
                  key={day}
                  accessible
                  accessibilityLabel={[
                    formatShortDate(keyToDate(day)),
                    isToday && "today",
                    isBlocked && "blocked out",
                    isScheduled && "you're scheduled",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  style={{ flex: 1, height: CELL, justifyContent: "center" }}
                >
                  {isBlocked ? (
                    <Box
                      style={{
                        position: "absolute",
                        top: 4,
                        bottom: 4,
                        left: joinsLeft ? 0 : 3,
                        right: joinsRight ? 0 : 3,
                        backgroundColor: band,
                        borderTopLeftRadius: joinsLeft ? 0 : 12,
                        borderBottomLeftRadius: joinsLeft ? 0 : 12,
                        borderTopRightRadius: joinsRight ? 0 : 12,
                        borderBottomRightRadius: joinsRight ? 0 : 12,
                      }}
                    />
                  ) : null}

                  <Center
                    style={{
                      alignSelf: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: isToday ? 1.5 : 0,
                      borderColor: theme.text,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontVariant: ["tabular-nums"],
                        fontWeight: isBlocked || isToday ? "700" : "500",
                        color: isBlocked ? theme.destructive : isPast ? theme.textMuted : theme.text,
                        opacity: isPast ? 0.5 : 1,
                      }}
                    >
                      {Number(day.slice(8))}
                    </Text>
                  </Center>

                  {isScheduled ? (
                    <Box
                      style={{
                        position: "absolute",
                        bottom: 1,
                        alignSelf: "center",
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: brand.orange,
                        opacity: isPast ? 0.5 : 1,
                      }}
                    />
                  ) : null}
                </Box>
              );
            })}
          </HStack>
        ))}
      </VStack>

      <HStack className="gap-4 px-2.5 pt-2">
        <HStack className="items-center gap-1.5">
          <Box style={{ width: 14, height: 10, borderRadius: 5, backgroundColor: band }} />
          <Text className="text-[12px] text-muted-foreground">Blocked out</Text>
        </HStack>
        <HStack className="items-center gap-1.5">
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: brand.orange }} />
          <Text className="text-[12px] text-muted-foreground">{"You're scheduled"}</Text>
        </HStack>
      </HStack>
    </VStack>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="h-8 w-8 items-center justify-center rounded-full bg-surface data-[active=true]:opacity-60"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <AppIcon icon={icon} size={15} color={theme.text} />
    </Pressable>
  );
}
