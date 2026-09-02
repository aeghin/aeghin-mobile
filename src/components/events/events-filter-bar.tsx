import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { ScrollView } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { formatMonth } from "@/lib/events/format";
import { TIME_SCOPES, type TimeScope } from "@/lib/events/schedule";
import type { ServiceType } from "@/types/event";

/** Horizontal padding the rows below bleed past, so they scroll edge to edge. */
const GUTTER = 16;

type ScopeFilterProps = {
  value: TimeScope;
  onChange: (scope: TimeScope) => void;
};

/**
 * Which stretch of the calendar the list covers.
 *
 * Text that tints rather than a second segmented control: the control above it
 * already owns that shape, and two of them stacked read as one broken widget.
 */
export function ScopeFilter({ value, onChange }: ScopeFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 4 }}
    >
      {TIME_SCOPES.map((scope) => {
        const active = scope.value === value;

        return (
          <Pressable
            key={scope.value}
            onPress={() => onChange(scope.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="rounded-lg px-2.5 py-1.5 data-[active=true]:opacity-60"
            style={{
              backgroundColor: active
                ? withAlpha(brand.orange, 0.13)
                : "transparent",
            }}
          >
            <Text
              className={`text-[13px] font-semibold ${
                active ? "text-brand" : "text-muted-foreground"
              }`}
            >
              {scope.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type MonthStepperProps = {
  /** A `"2026-08"` month key. */
  value: string;
  onChange: (monthKey: string) => void;
};

/** Steps the month the two month-bound scopes read from. */
export function MonthStepper({ value, onChange }: MonthStepperProps) {
  const theme = useTheme();

  return (
    <HStack
      className="mx-4 items-center justify-between rounded-xl border border-border bg-surface px-1"
      style={{ height: 36 }}
    >
      <StepperButton
        icon={ChevronLeft}
        label="Previous month"
        onPress={() => onChange(shift(value, -1))}
        tint={theme.textMuted}
      />

      <Text className="text-[13px] font-semibold text-foreground">
        {formatMonth(value)}
      </Text>

      <StepperButton
        icon={ChevronRight}
        label="Next month"
        onPress={() => onChange(shift(value, 1))}
        tint={theme.textMuted}
      />
    </HStack>
  );
}

function shift(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function StepperButton({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-8 w-10 items-center justify-center rounded-lg data-[active=true]:bg-border/60"
    >
      <AppIcon icon={icon} size={13} color={tint} />
    </Pressable>
  );
}

type ServiceFilterProps = {
  services: ServiceType[];
  /** Null means "All". */
  value: string | null;
  onChange: (serviceTypeId: string | null) => void;
};

/**
 * Narrows the list to one kind of service.
 *
 * A selected chip wears the service's own colour rather than a shared accent —
 * it is the same colour as the rail on every card the filter leaves behind, so
 * the connection is visible without reading either label.
 */
export function ServiceFilter({ services, value, onChange }: ServiceFilterProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
    >
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
        className="rounded-full border px-3 py-1.5 data-[active=true]:opacity-60"
        style={{
          borderColor: value === null ? theme.text : theme.border,
          backgroundColor: value === null ? theme.text : "transparent",
        }}
      >
        <Text
          className="text-[12.5px] font-semibold"
          style={{ color: value === null ? theme.background : theme.textMuted }}
        >
          All
        </Text>
      </Pressable>

      {services.map((service) => {
        const active = service.id === value;
        const colors = getServiceColors(service.color, theme);

        return (
          <Pressable
            key={service.id}
            onPress={() => onChange(active ? null : service.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="rounded-full border data-[active=true]:opacity-60"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderColor: active ? colors.hairline : theme.border,
              backgroundColor: active ? colors.surface : "transparent",
            }}
          >
            <HStack className="items-center gap-1.5">
              <Box
                className="h-[7px] w-[7px] rounded-full"
                style={{ backgroundColor: colors.base }}
              />
              <Text
                className="text-[12.5px] font-semibold"
                style={{ color: active ? colors.text : theme.textMuted }}
              >
                {service.name}
              </Text>
            </HStack>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
