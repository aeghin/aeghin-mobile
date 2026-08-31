import type { ReactNode } from "react";

import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { brand, withAlpha, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import type { ServiceType, VolunteerRole } from "@/types/event";

/**
 * The small parts every event card is assembled from.
 *
 * All of them colour through resolved values rather than utility classes: a
 * service type's colour is chosen by whoever created it, so the class NativeWind
 * would need was never in the source at build time.
 */

export type PillTone = "neutral" | "success" | "warning" | "danger" | "brand";

function toneColor(tone: PillTone, theme: Palette): string {
  switch (tone) {
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "danger":
      return theme.destructive;
    case "brand":
      return brand.orange;
    default:
      return theme.textMuted;
  }
}

type PillProps = {
  label: string;
  tone?: PillTone;
  symbol?: AppSymbolName;
};

/** A tinted capsule. Status, countdowns, "Past" — anything one word wide. */
export function Pill({ label, tone = "neutral", symbol }: PillProps) {
  const theme = useTheme();
  const color = toneColor(tone, theme);
  const neutral = tone === "neutral";

  return (
    <HStack
      className="items-center gap-1 rounded-full px-2 py-[3px]"
      style={{
        backgroundColor: neutral ? theme.surface : withAlpha(color, 0.14),
      }}
    >
      {symbol ? <AppSymbol name={symbol} size={10} tint={color} /> : null}
      <Text
        className="text-[11px] font-semibold tracking-[0.1px]"
        style={{ color }}
      >
        {label}
      </Text>
    </HStack>
  );
}

/** The service type an event belongs to, in that service's own colour. */
export function ServiceBadge({ service }: { service: ServiceType | undefined }) {
  const theme = useTheme();
  const colors = getServiceColors(service?.color ?? "indigo", theme);

  return (
    <Box
      className="rounded-md px-2 py-[3px]"
      style={{ backgroundColor: colors.surface }}
    >
      <Text
        className="text-[11px] font-semibold"
        style={{ color: colors.text }}
        numberOfLines={1}
      >
        {service?.name ?? "Event"}
      </Text>
    </Box>
  );
}

/**
 * What the user was asked to play or do.
 *
 * The surface stays unbranded — every row already carries one colour and a
 * second competes with it — so the emoji is the only colour in the chip, which
 * is what lets a guitarist find their own rows without reading a word.
 *
 * One accessibility element, labelled by the role: left to itself VoiceOver
 * announces the glyph and then the word, and "guitar, Guitarist" is a stutter.
 */
export function RoleChip({ role }: { role: VolunteerRole }) {
  const { label, emoji } = getVolunteerRoleConfig(role);

  return (
    <HStack
      className="items-center gap-1 rounded-md bg-surface px-2 py-[3px]"
      accessible
      accessibilityLabel={label}
    >
      {/* Emoji ignore `color` and clip against a tight line box, so this one
          carries its own metrics rather than inheriting the label's. */}
      <Text style={{ fontSize: 12, lineHeight: 16 }}>{emoji}</Text>
      <Text className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </Text>
    </HStack>
  );
}

type MetaLineProps = {
  symbol: AppSymbolName;
  children: ReactNode;
};

/** One icon-led line of secondary detail: a date, a time, a place. */
export function MetaLine({ symbol, children }: MetaLineProps) {
  const theme = useTheme();

  return (
    <HStack className="items-center gap-1.5">
      <AppSymbol name={symbol} size={12} tint={theme.textMuted} />
      <Text
        className="flex-1 text-[12.5px] text-muted-foreground"
        numberOfLines={1}
      >
        {children}
      </Text>
    </HStack>
  );
}

/** The colour bar down a card's leading edge, naming its service at a glance. */
export function ServiceRail({ service }: { service: ServiceType | undefined }) {
  const theme = useTheme();
  const colors = getServiceColors(service?.color ?? "indigo", theme);

  return (
    <Box
      className="absolute bottom-0 left-0 top-0 w-[3px]"
      style={{ backgroundColor: colors.base }}
    />
  );
}

type StaffingMeterProps = {
  filled: number;
  needed: number;
};

/**
 * How close an event is to being fully staffed.
 *
 * Only the All Events tab shows it: it answers a question owners and admins
 * have and volunteers do not.
 */
export function StaffingMeter({ filled, needed }: StaffingMeterProps) {
  const theme = useTheme();

  const full = filled >= needed;
  const empty = filled === 0;
  const color = full ? theme.success : empty ? theme.destructive : theme.warning;
  const label = full
    ? "Fully staffed"
    : empty
      ? "Needs volunteers"
      : `${filled} of ${needed} filled`;

  return (
    <HStack className="items-center gap-2">
      <HStack className="gap-[3px]">
        {Array.from({ length: needed }, (_, index) => (
          <Box
            key={index}
            className="h-[5px] w-[9px] rounded-full"
            style={{
              backgroundColor: index < filled ? color : theme.border,
            }}
          />
        ))}
      </HStack>

      <Text className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </HStack>
  );
}
