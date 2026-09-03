import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useState } from "react";

import { AppIcon } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import {
  currentMonthKey,
  dayKey,
  formatMonth,
  shiftMonth,
  todayKey,
} from "@/lib/events/format";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (value: number) => String(value).padStart(2, "0");

/** Every day key in a `"YYYY-MM"` month, plus the blanks before the first. */
function gridFor(month: string): (string | null)[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let day = 1; day <= count; day++) {
    cells.push(`${year}-${pad(monthIndex)}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type DateRange = { start: string | null; end: string | null };

type DateRangePickerProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

/**
 * A month grid that picks a span of calendar days: the first tap sets the
 * start, the second the end, and a tap before the start begins again. Days
 * are `"YYYY-MM-DD"` keys — the form the blockout route takes.
 */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const theme = useTheme();
  const today = todayKey();
  const [month, setMonth] = useState(() => (value.start ? value.start.slice(0, 7) : currentMonthKey()));

  const cells = gridFor(month);

  const pick = (day: string) => {
    if (!value.start || value.end || day < value.start) {
      onChange({ start: day, end: null });
    } else {
      onChange({ start: value.start, end: day });
    }
  };

  const inRange = (day: string) =>
    value.start !== null &&
    ((value.end !== null && day > value.start && day < value.end) ||
      (value.end === null && day === value.start));

  return (
    <VStack className="rounded-2xl border border-border bg-card p-3">
      <HStack className="items-center justify-between pb-2">
        <Pressable
          onPress={() => setMonth(shiftMonth(month, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
        >
          <AppIcon icon={ChevronLeft} size={18} color={theme.textMuted} />
        </Pressable>
        <Text className="text-[15px] font-semibold text-foreground">{formatMonth(month)}</Text>
        <Pressable
          onPress={() => setMonth(shiftMonth(month, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
        >
          <AppIcon icon={ChevronRight} size={18} color={theme.textMuted} />
        </Pressable>
      </HStack>

      <HStack>
        {WEEKDAYS.map((label, index) => (
          <Box key={index} className="flex-1 items-center py-1">
            <Text className="text-[11px] font-semibold text-muted-foreground">{label}</Text>
          </Box>
        ))}
      </HStack>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <HStack key={row}>
          {cells.slice(row * 7, row * 7 + 7).map((day, column) => {
            if (!day) return <Box key={column} className="flex-1" style={{ height: 38 }} />;

            const past = day < today;
            const edge = day === value.start || day === value.end;
            const between = inRange(day);

            return (
              <Pressable
                key={day}
                onPress={() => pick(day)}
                disabled={past}
                accessibilityRole="button"
                accessibilityState={{ selected: edge || between, disabled: past }}
                className="flex-1 items-center justify-center"
                style={{
                  height: 38,
                  backgroundColor: between || edge ? withAlpha(brand.orange, edge ? 1 : 0.14) : undefined,
                  borderTopLeftRadius: day === value.start || !between ? 19 : 0,
                  borderBottomLeftRadius: day === value.start || !between ? 19 : 0,
                  borderTopRightRadius: day === value.end || !between ? 19 : 0,
                  borderBottomRightRadius: day === value.end || !between ? 19 : 0,
                }}
              >
                <Text
                  className="text-[14px]"
                  style={{
                    color: edge ? "#FFFFFF" : past ? theme.textMuted : theme.text,
                    fontWeight: day === today || edge ? "700" : "400",
                    opacity: past ? 0.5 : 1,
                  }}
                >
                  {Number(day.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      ))}
    </VStack>
  );
}

/** The day key for "today", for a caller that wants to default a range. */
export const todayDayKey = () => dayKey(new Date());
