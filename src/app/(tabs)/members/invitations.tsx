import { Stack } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CircleCheckBig from "lucide-react-native/icons/circle-check-big";
import CircleX from "lucide-react-native/icons/circle-x";
import Clock from "lucide-react-native/icons/clock";
import Mail from "lucide-react-native/icons/mail";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AppIconName } from "@/components/app-icon";
import { Pill, type PillTone } from "@/components/events/chips";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { InsetCard } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useCancelInvitation,
  useInvitations,
  useResendInvitation,
} from "@/hooks/use-invitations";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { formatActivityTime, formatExpiry, todayKey } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { InvitationStatus } from "@/types/event";
import type { OrganizationInvitation } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/**
 * The glyphs are the dashboard's own — `invitations-tab-content.tsx` draws a
 * different set here than the corner badge on an event assignment does, so this
 * is deliberately not `lib/config/status.ts`.
 */
const STATUS_TONE: Record<
  InvitationStatus,
  { label: string; tone: PillTone; icon: AppIconName }
> = {
  PENDING: { label: "Pending", tone: "warning", icon: Clock },
  ACCEPTED: { label: "Accepted", tone: "success", icon: CircleCheckBig },
  DECLINED: { label: "Declined", tone: "danger", icon: CircleX },
  CANCELED: { label: "Canceled", tone: "neutral", icon: Clock },
};

/** The dashboard's Invitations tab: everyone asked to join, and whether they have. */
export default function InvitationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const invitations = useInvitations(organizationId, canManage);
  const pullToRefresh = usePullToRefresh(invitations.refetch);
  const cancel = useCancelInvitation(organizationId);
  const resend = useResendInvitation(organizationId);

  const rows = invitations.data ?? [];
  const pending = rows.filter((row) => row.status === "PENDING").length;
  const today = todayKey();

  /** Which row is mid-flight, so only its own link says so. */
  const resending = resend.isPending ? resend.variables : undefined;

  const confirmCancel = (invitation: OrganizationInvitation) =>
    Alert.alert("Cancel invitation", `${invitation.email} will no longer be able to join with this link.`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel invitation",
        style: "destructive",
        onPress: () =>
          cancel.mutate(invitation.id, {
            onError: (error) => Alert.alert("Couldn't cancel", failureMessage(error)),
          }),
      },
    ]);

  /**
   * Resending a pending invitation only moves its expiry, which is a quiet
   * change on a row you are already looking at — so the send is confirmed out
   * loud. A canceled one visibly flips back to Pending, and gets the same
   * sentence for consistency.
   */
  const confirmResend = (invitation: OrganizationInvitation) =>
    resend.mutate(invitation.id, {
      onSuccess: () =>
        Alert.alert(
          "Invitation sent",
          `${invitation.email} has a fresh link, good for 7 days.`,
        ),
      onError: (error) => Alert.alert("Couldn't send", failureMessage(error)),
    });

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Invitations", headerBackTitle: "Members" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {invitations.isError ? (
          <EventsEmptyState
            icon={CircleAlert}
            title="Couldn't load invitations"
            body="Pull down to try again."
            tone="error"
          />
        ) : invitations.isPending ? (
          <InsetCard elevated separatorInset={14}>
            {[0, 1, 2].map((index) => (
              <VStack key={index} className="gap-2 px-3.5 py-3">
                <Skeleton startColor="bg-border" style={{ width: 180, height: 13 }} />
                <Skeleton startColor="bg-border" style={{ width: 120, height: 11 }} />
              </VStack>
            ))}
          </InsetCard>
        ) : rows.length === 0 ? (
          <EventsEmptyState
            icon={Mail}
            title="No invitations yet"
            body="Invite someone from the Members tab and they'll show up here."
          />
        ) : (
          <VStack className="gap-2">
            <Text className="ml-1 text-[13px] text-muted-foreground">
              {`${pending} pending`}
            </Text>
            <InsetCard elevated separatorInset={14}>
              {rows.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  today={today}
                  // The dashboard's own rule: a pending invitation can be
                  // resent or called off, a canceled one can be sent afresh,
                  // and an answered one is done with.
                  onResend={
                    invitation.status === "PENDING" || invitation.status === "CANCELED"
                      ? () => confirmResend(invitation)
                      : undefined
                  }
                  resending={resending === invitation.id}
                  onCancel={
                    invitation.status === "PENDING" ? () => confirmCancel(invitation) : undefined
                  }
                />
              ))}
            </InsetCard>
          </VStack>
        )}
      </ScrollView>
    </VStack>
  );
}

function InvitationRow({
  invitation,
  today,
  onResend,
  resending,
  onCancel,
}: {
  invitation: OrganizationInvitation;
  today: string;
  /** Send the link again. Absent once the invitation has been answered. */
  onResend?: () => void;
  resending?: boolean;
  onCancel?: () => void;
}) {
  const status = STATUS_TONE[invitation.status];
  const expiry = invitation.status === "PENDING" ? formatExpiry(invitation.expiresAt, today) : null;

  // The web words these apart, and so does this: reviving a canceled
  // invitation is a new one going out, not the same one going out again.
  const resendLabel = invitation.status === "CANCELED" ? "Send again" : "Resend";

  return (
    <VStack className="gap-1.5 px-3.5 py-3">
      <HStack className="items-center gap-2">
        <Text className="flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {invitation.email}
        </Text>
        <Pill label={status.label} tone={status.tone} icon={status.icon} />
      </HStack>

      <HStack className="flex-wrap items-center gap-1">
        {invitation.volunteerRoles.map((role) => {
          const { emoji, label } = getVolunteerRoleConfig(role);
          return (
            <Text key={role} className="text-[12px] text-muted-foreground">
              {`${emoji} ${label}`}
            </Text>
          );
        })}
      </HStack>

      <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
        {`Sent by ${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName} · ${formatActivityTime(invitation.createdAt)}`}
        {expiry ? ` · ${expiry.label}` : ""}
      </Text>

      {/* On their own line rather than beside the byline: a pending invitation
          carries two of them, and sharing that row squeezed the names into an
          ellipsis and the targets down to something hard to hit. */}
      {/* `-mr-2` cancels the trailing link's own padding, so its text lands on
          the same right edge as the email and the byline above it. */}
      {onResend || onCancel ? (
        <HStack className="-mr-2 items-center justify-end gap-1">
          {onResend ? (
            <ActionLink
              label={resending ? "Sending…" : resendLabel}
              accessibilityLabel={`${resendLabel} the invitation to ${invitation.email}`}
              onPress={onResend}
              disabled={resending}
            />
          ) : null}

          {onCancel ? (
            <ActionLink
              label="Cancel"
              accessibilityLabel={`Cancel the invitation to ${invitation.email}`}
              onPress={onCancel}
              destructive
            />
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
}

/**
 * One of the row's inline actions.
 *
 * Padded and generously hit-slopped rather than bare text: at 12px the words
 * alone are well under a comfortable target, and these sit close together.
 */
function ActionLink({
  label,
  accessibilityLabel,
  onPress,
  destructive,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();

  const color = disabled
    ? theme.textMuted
    : destructive
      ? theme.destructive
      : brand.orange;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={12}
      className="px-2 py-1 data-[active=true]:opacity-60"
    >
      <Text className="text-[12.5px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
