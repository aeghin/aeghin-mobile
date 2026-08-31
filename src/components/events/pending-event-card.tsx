import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import {
  MetaLine,
  Pill,
  RoleChip,
  ServiceBadge,
  ServiceRail,
} from "@/components/events/chips";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateRange,
  formatExpiry,
  formatTimeRange,
} from "@/lib/events/format";
import { assignmentFor } from "@/lib/events/schedule";
import type { OrganizationEvent, ServiceType } from "@/types/event";

const CALENDAR: AppSymbolName = { ios: "calendar", android: "calendar_month" };
const CLOCK: AppSymbolName = { ios: "clock", android: "schedule" };
const PIN: AppSymbolName = { ios: "mappin.and.ellipse", android: "place" };
const CHECK: AppSymbolName = { ios: "checkmark", android: "check" };
const CROSS: AppSymbolName = { ios: "xmark", android: "close" };
const HOURGLASS: AppSymbolName = { ios: "hourglass", android: "hourglass_empty" };
const EXPIRING: AppSymbolName = {
  ios: "clock.badge.exclamationmark",
  android: "pending_actions",
};

export type PendingAction = "accept" | "decline";

type PendingEventCardProps = {
  event: OrganizationEvent;
  service: ServiceType | undefined;
  /** Today, as a `"2026-08-30"` key — what the expiry countdown measures from. */
  today: string;
  /** Which button is mid-flight, if either. Both disable while one is. */
  busy?: PendingAction;
  onAccept?: () => void;
  onDecline?: () => void;
  onPress?: () => void;
};

/**
 * An invitation waiting on an answer.
 *
 * Taller and louder than a schedule row on purpose: this is the only card on
 * the screen that asks for something, and the two buttons at the bottom are
 * the whole reason the tab exists. Everything above them is the detail needed
 * to answer — when, how long, where, and who asked.
 */
export function PendingEventCard({
  event,
  service,
  today,
  busy,
  onAccept,
  onDecline,
  onPress,
}: PendingEventCardProps) {
  const assignment = assignmentFor(event, "PENDING");
  const expiry = assignment ? formatExpiry(assignment.expiresAt, today) : null;
  const assignedBy = assignment?.assignedBy?.firstName ?? null;

  return (
    <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
      <ServiceRail service={service} />

      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={event.name}
        className="data-[active=true]:opacity-80"
      >
        <VStack className="gap-2.5 py-3.5 pl-[15px] pr-3.5">
          <HStack className="items-center gap-2">
            <ServiceBadge service={service} />
            <Box className="flex-1" />
            {assignment ? <RoleChip role={assignment.role} /> : null}
          </HStack>

          <Text
            className="text-[16.5px] font-semibold leading-[21px] tracking-[-0.3px] text-foreground"
            numberOfLines={2}
          >
            {event.name}
          </Text>

          <VStack className="gap-1.5">
            <MetaLine symbol={CALENDAR}>{formatDateRange(event.dates)}</MetaLine>
            <MetaLine symbol={CLOCK}>{formatTimeRange(event.dates)}</MetaLine>
            <MetaLine symbol={PIN}>{event.location}</MetaLine>
          </VStack>

          <HStack className="items-center gap-2 pt-0.5">
            {assignedBy ? (
              <Text
                className="flex-1 text-[12px] text-muted-foreground"
                numberOfLines={1}
              >
                {`Assigned by ${assignedBy}`}
              </Text>
            ) : (
              <Box className="flex-1" />
            )}

            {expiry ? (
              <Pill
                label={expiry.label}
                tone={expiry.urgent ? "danger" : "neutral"}
                symbol={expiry.urgent ? EXPIRING : HOURGLASS}
              />
            ) : null}
          </HStack>
        </VStack>
      </Pressable>

      <Divider />

      <HStack className="gap-2.5 p-3">
        <AnswerButton
          kind="accept"
          label="Accept"
          symbol={CHECK}
          onPress={onAccept}
          loading={busy === "accept"}
          disabled={busy !== undefined}
        />
        <AnswerButton
          kind="decline"
          label="Decline"
          symbol={CROSS}
          onPress={onDecline}
          loading={busy === "decline"}
          disabled={busy !== undefined}
        />
      </HStack>
    </VStack>
  );
}

type AnswerButtonProps = {
  kind: PendingAction;
  label: string;
  symbol: AppSymbolName;
  onPress?: () => void;
  loading: boolean;
  disabled: boolean;
};

/**
 * Accept is filled and Decline is outlined, so the pair has one obvious
 * default without either being hard to reach — they are the same size and
 * both sit inside the thumb's arc at the bottom of the card.
 */
function AnswerButton({
  kind,
  label,
  symbol,
  onPress,
  loading,
  disabled,
}: AnswerButtonProps) {
  const theme = useTheme();
  const accept = kind === "accept";
  const color = accept ? theme.success : theme.destructive;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      className="h-11 flex-1 items-center justify-center rounded-xl border data-[active=true]:opacity-75"
      style={{
        backgroundColor: accept ? color : withAlpha(color, 0.06),
        borderColor: accept ? color : withAlpha(color, 0.45),
        opacity: disabled && !loading ? 0.45 : 1,
      }}
    >
      {loading ? (
        <Spinner size="small" color={accept ? "#FFFFFF" : color} />
      ) : (
        <HStack className="items-center gap-1.5">
          <AppSymbol name={symbol} size={13} tint={accept ? "#FFFFFF" : color} />
          <Text
            className="text-[15px] font-semibold"
            style={{ color: accept ? "#FFFFFF" : color }}
          >
            {label}
          </Text>
        </HStack>
      )}
    </Pressable>
  );
}

/** A placeholder shaped like {@link PendingEventCard}, for the first load. */
export function PendingEventCardSkeleton() {
  return (
    <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
      <VStack className="gap-2.5 py-3.5 pl-[15px] pr-3.5">
        <HStack className="items-center justify-between">
          <Skeleton startColor="bg-border" style={{ width: 96, height: 17 }} />
          <Skeleton startColor="bg-border" style={{ width: 74, height: 17 }} />
        </HStack>

        <Skeleton startColor="bg-border" style={{ width: 205, height: 15 }} />

        <VStack className="gap-2 pt-1">
          <Skeleton startColor="bg-border" style={{ width: 140, height: 10 }} />
          <Skeleton startColor="bg-border" style={{ width: 165, height: 10 }} />
          <Skeleton startColor="bg-border" style={{ width: 110, height: 10 }} />
        </VStack>
      </VStack>

      <Divider />

      <HStack className="gap-2.5 p-3">
        <Skeleton startColor="bg-border" style={{ height: 44 }} className="flex-1 rounded-xl" />
        <Skeleton startColor="bg-border" style={{ height: 44 }} className="flex-1 rounded-xl" />
      </HStack>
    </VStack>
  );
}
