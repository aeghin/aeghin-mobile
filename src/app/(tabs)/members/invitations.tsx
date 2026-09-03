import { Stack } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Mail from "lucide-react-native/icons/mail";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { useCancelInvitation, useInvitations } from "@/hooks/use-invitations";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { formatActivityTime, formatExpiry, todayKey } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { InvitationStatus } from "@/types/event";
import type { OrganizationInvitation } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

const STATUS_TONE: Record<InvitationStatus, { label: string; tone: PillTone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  CANCELED: { label: "Canceled", tone: "neutral" },
};

/** The dashboard's Invitations tab: everyone asked to join, and whether they have. */
export default function InvitationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const invitations = useInvitations(organizationId, canManage);
  const cancel = useCancelInvitation(organizationId);

  const rows = invitations.data ?? [];
  const pending = rows.filter((row) => row.status === "PENDING").length;
  const today = todayKey();

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
            refreshing={invitations.isRefetching}
            onRefresh={invitations.refetch}
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
  onCancel,
}: {
  invitation: OrganizationInvitation;
  today: string;
  onCancel?: () => void;
}) {
  const theme = useTheme();
  const status = STATUS_TONE[invitation.status];
  const expiry = invitation.status === "PENDING" ? formatExpiry(invitation.expiresAt, today) : null;

  return (
    <VStack className="gap-1.5 px-3.5 py-3">
      <HStack className="items-center gap-2">
        <Text className="flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {invitation.email}
        </Text>
        <Pill label={status.label} tone={status.tone} />
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

      <HStack className="items-center gap-2">
        <Text className="flex-1 text-[12px] text-muted-foreground" numberOfLines={1}>
          {`Sent by ${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName} · ${formatActivityTime(invitation.createdAt)}`}
          {expiry ? ` · ${expiry.label}` : ""}
        </Text>

        {onCancel ? (
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={6}>
            <Text className="text-[12px] font-semibold" style={{ color: theme.destructive }}>
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </HStack>
    </VStack>
  );
}
