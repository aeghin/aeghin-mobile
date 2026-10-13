import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { brand, withAlpha, type Palette } from "@/constants/branding";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { getStatusConfig } from "@/lib/config/status";
import { describeStaffing, type Staffing } from "@/lib/events/schedule";
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
  icon?: AppIconName;
};

/** A tinted capsule. Status, countdowns, "Past" — anything one word wide. */
export function Pill({ label, tone = "neutral", icon }: PillProps) {
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
      {icon ? <AppIcon icon={icon} size={10} color={color} /> : null}
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
  const { label, emoji } = useRoles().get(role);

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
  icon: AppIconName;
  children: ReactNode;
};

/** One icon-led line of secondary detail: a date, a time, a place. */
export function MetaLine({ icon, children }: MetaLineProps) {
  const theme = useTheme();

  return (
    <HStack className="items-center gap-1.5">
      <AppIcon icon={icon} size={12} color={theme.textMuted} />
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

const FILLED = getStatusConfig("ACCEPTED").color;
const PENDING = getStatusConfig("PENDING").color;
const DECLINED = getStatusConfig("DECLINED").color;

/**
 * One role's pill, the size they had when rosters were short. A bigger roster
 * runs the bar longer instead of squeezing every pill into a dot, as on the
 * web: the meter has its own line, and all fifteen catalog roles come to 207pt,
 * inside the card on the narrowest phone.
 */
const SEGMENT_WIDTH = 11;

/**
 * Where each role on an event stands.
 *
 * Only the All Events tab shows it: it answers a question owners and admins
 * have and volunteers do not.
 *
 * One segment per role, however many spots it has, in the roster's own status
 * colours so a segment matches the badges it leads to: green when every spot
 * accepted, amber while somebody's deciding, red when a decline, cancel or
 * expiry left a spot open — whoever else accepted — grey nobody asked. Always
 * in that order, so position still reads where red and green look alike. The
 * event screen keeps the per-person roster. There is no label — the colours are
 * the status — so VoiceOver hears {@link describeStaffing} instead.
 */
export function StaffingMeter(staffing: Staffing) {
  const theme = useTheme();
  const { filled, awaiting, declined, needed } = staffing;

  return (
    <HStack
      className="gap-[3px]"
      accessible
      accessibilityLabel={describeStaffing(staffing)}
    >
      {Array.from({ length: needed }, (_, index) => (
        <Box
          key={index}
          className="h-[6px] rounded-full"
          style={{
            width: SEGMENT_WIDTH,
            backgroundColor:
              index < filled
                ? FILLED
                : index < filled + awaiting
                  ? PENDING
                  : index < filled + awaiting + declined
                    ? DECLINED
                    : theme.border,
          }}
        />
      ))}
    </HStack>
  );
}
