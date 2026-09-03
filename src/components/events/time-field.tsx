import Clock from "lucide-react-native/icons/clock";
import { useState } from "react";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Choice } from "@/components/form-fields";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";

/**
 * A time, picked as an hour, a quarter and a meridiem.
 *
 * A wheel would need a native picker, which is split across two toolkits and a
 * rebuild; a scrolling list of every quarter hour means hunting through
 * ninety-six rows to reach a Sunday morning. Eighteen chips fit on one screen
 * with nothing to scroll, and land on the answer in three taps.
 *
 * The value is 24-hour `"HH:mm"`, which is what the wire wants. Nobody reads
 * that, so the field shows `"10:00 AM"`.
 */

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "15", "30", "45"];

type Meridiem = "AM" | "PM";

type Parts = { hour: number; minute: string; meridiem: Meridiem };

/** `"13:30"` -> `{ hour: 1, minute: "30", meridiem: "PM" }`. */
export function parseClock(value: string): Parts {
  const [rawHour, rawMinute] = value.split(":");
  const hour24 = Number(rawHour);
  const meridiem: Meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  // Snapped to the quarter the chips offer, so an odd stored value still
  // shows one of them as selected rather than none.
  const minute = MINUTES.includes(rawMinute)
    ? rawMinute
    : MINUTES[Math.min(3, Math.floor(Number(rawMinute) / 15))];

  return { hour, minute, meridiem };
}

/** `{ hour: 1, minute: "30", meridiem: "PM" }` -> `"13:30"`. */
function toClock({ hour, minute, meridiem }: Parts): string {
  const base = hour % 12;
  const hour24 = meridiem === "PM" ? base + 12 : base;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

/** `"13:30"` -> `"1:30 PM"`. */
export function formatClock(value: string): string {
  const { hour, minute, meridiem } = parseClock(value);
  return `${hour}:${minute} ${meridiem}`;
}

type TimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Names the dialog, e.g. "Start time". */
  label: string;
  /** The day this time belongs to, shown under the dialog title. */
  context?: string;
};

export function TimeField({ value, onChange, label, context }: TimeFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const parts = parseClock(value);

  const set = (patch: Partial<Parts>) => onChange(toClock({ ...parts, ...patch }));

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatClock(value)}`}
        className="flex-1 rounded-xl border px-3 py-2.5 data-[active=true]:opacity-70"
        style={{ borderColor: theme.border, backgroundColor: theme.surface }}
      >
        <HStack className="items-center gap-1.5">
          <AppIcon icon={Clock} size={13} color={theme.textMuted} />
          <Text
            className="text-[14px] font-medium text-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatClock(value)}
          </Text>
        </HStack>
      </Pressable>

      <Dialog
        visible={open}
        icon={Clock}
        title={label}
        description={context}
        onClose={() => setOpen(false)}
      >
        <VStack className="gap-1.5">
          <Text className="ml-1 text-[13px] font-semibold text-foreground">Hour</Text>
          <HStack className="flex-wrap gap-1.5">
            {HOURS.map((hour) => (
              <Choice
                key={hour}
                label={String(hour)}
                selected={parts.hour === hour}
                onPress={() => set({ hour })}
              />
            ))}
          </HStack>
        </VStack>

        <VStack className="gap-1.5">
          <Text className="ml-1 text-[13px] font-semibold text-foreground">Minutes</Text>
          <HStack className="flex-wrap gap-1.5">
            {MINUTES.map((minute) => (
              <Choice
                key={minute}
                label={`:${minute}`}
                selected={parts.minute === minute}
                onPress={() => set({ minute })}
              />
            ))}
          </HStack>
        </VStack>

        <VStack className="gap-1.5">
          <Text className="ml-1 text-[13px] font-semibold text-foreground">Morning or afternoon</Text>
          <HStack className="gap-1.5">
            {(["AM", "PM"] as Meridiem[]).map((meridiem) => (
              <Choice
                key={meridiem}
                label={meridiem}
                selected={parts.meridiem === meridiem}
                onPress={() => set({ meridiem })}
              />
            ))}
          </HStack>
        </VStack>
      </Dialog>
    </>
  );
}
