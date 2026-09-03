import { useUser } from "@clerk/expo";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import AtSign from "lucide-react-native/icons/at-sign";
import CircleSlash from "lucide-react-native/icons/circle-slash";
import Phone from "lucide-react-native/icons/phone";
import { Alert, Linking, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import {
  MemberAcceptanceCard,
  MemberTopSongsCard,
} from "@/components/members/member-stats-cards";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { VolunteerRolePicker } from "@/components/volunteer-role-picker";
import {
  useMemberStats,
  useMembersList,
  useRemoveMember,
  useUpdateMember,
} from "@/hooks/use-members-list";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg, getRoleConfig } from "@/lib/config/roles";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { formatShortDate } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { OrgRole } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/** `"1234567890"` → `"123-456-7890"`, as the dashboard prints it. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^1/, "");
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * One member: who they are, how to reach them, what they can be scheduled
 * for — and, for owners and admins, the dashboard's row menu.
 */
export default function MemberScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();

  const { userId: memberId } = useLocalSearchParams<{ userId: string }>();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const viewerRole = organization?.role;
  const canManage = canManageOrg(viewerRole);

  const members = useMembersList(organizationId);
  const stats = useMemberStats(organizationId, memberId ?? "");
  const update = useUpdateMember(organizationId);
  const remove = useRemoveMember(organizationId);

  const member = members.data?.find((entry) => entry.id === memberId);
  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isYou = member?.email.toLowerCase() === myEmail;

  const fullName = member ? `${member.firstName} ${member.lastName}`.trim() : "";
  const role = member ? getRoleConfig(member.role, theme) : null;

  // The dashboard's rule: an admin may only act on members; an owner on anyone but themselves.
  const canAct =
    canManage && member !== undefined && !isYou &&
    (viewerRole === "OWNER" || member.role === "MEMBER");

  const setRole = (next: OrgRole) =>
    update.mutate(
      { memberId: member!.id, change: { role: next } },
      { onError: (error) => Alert.alert("Couldn't change role", failureMessage(error)) },
    );

  const changeRole = () => {
    if (!member) return;
    const options = [
      ...(member.role !== "ADMIN" ? [{ text: "Make admin", onPress: () => setRole("ADMIN") }] : []),
      ...(member.role !== "MEMBER" ? [{ text: "Make member", onPress: () => setRole("MEMBER") }] : []),
      ...(viewerRole === "OWNER" && member.role !== "OWNER"
        ? [{ text: "Make owner", onPress: () => confirmOwner() }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ];
    Alert.alert("Change role", `${fullName} is currently ${role?.label.toLowerCase()}.`, options);
  };

  const confirmOwner = () =>
    Alert.alert(
      "Make owner",
      `${fullName} will be able to edit and delete the organization. Ownership can't be taken back from here.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Make owner", style: "destructive", onPress: () => setRole("OWNER") },
      ],
    );

  const confirmRemove = () =>
    Alert.alert(
      "Remove member",
      `${fullName} will be removed from ${organization?.name ?? "the organization"} and taken off upcoming events.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            remove.mutate(member!.id, {
              onSuccess: () => router.back(),
              onError: (error) => Alert.alert("Couldn't remove", failureMessage(error)),
            }),
        },
      ],
    );

  const toggleVolunteerRole = (volunteerRole: Parameters<typeof getVolunteerRoleConfig>[0]) =>
    update.mutate(
      { memberId: member!.id, change: { toggleVolunteerRole: volunteerRole } },
      { onError: (error) => Alert.alert("Couldn't update roles", failureMessage(error)) },
    );

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: isYou ? "You" : fullName || "Member", headerBackTitle: "Members" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        {members.isPending ? (
          <Box className="flex-1 items-center justify-center">
            <Spinner color={theme.textMuted} />
          </Box>
        ) : !member ? (
          <EventsEmptyState
            icon={CircleSlash}
            title="Member unavailable"
            body="They may have left the organization."
          />
        ) : (
          <VStack className="gap-5">
            <VStack className="items-center gap-2 pb-1">
              <OrgAvatar name={fullName} logoUrl={member.imageUrl} size={84} shape="circle" />
              <Text className="text-[22px] font-bold tracking-[-0.4px] text-foreground">
                {fullName}
              </Text>
              {role ? (
                <HStack className="items-center gap-1">
                  <AppIcon icon={role.icon} size={13} color={role.tint} />
                  <Text className={`text-[13px] font-semibold ${role.textClass}`}>{role.label}</Text>
                </HStack>
              ) : null}
              <Text className="text-[12px] text-muted-foreground">
                {`Joined ${formatShortDate(member.joinedAt)}`}
              </Text>
            </VStack>

            <VStack>
              <SectionLabel>Contact</SectionLabel>
              <InsetCard elevated>
                <InsetRow
                  icon={AtSign}
                  label={member.email}
                  onPress={() => Linking.openURL(`mailto:${member.email}`)}
                />
                {member.phoneNumber ? (
                  <InsetRow
                    icon={Phone}
                    label={formatPhone(member.phoneNumber)}
                    onPress={() => Linking.openURL(`tel:${member.phoneNumber}`)}
                  />
                ) : null}
              </InsetCard>
            </VStack>

            <VStack>
              <SectionLabel>Serving record</SectionLabel>
              {stats.data ? (
                <VStack className="gap-3">
                  <MemberAcceptanceCard stats={stats.data} />
                  <MemberTopSongsCard songs={stats.data.songs} />
                </VStack>
              ) : stats.isError ? (
                <Text className="ml-1 text-[13px] text-muted-foreground">
                  Couldn&apos;t load their record.
                </Text>
              ) : (
                <VStack className="items-center rounded-2xl border border-border bg-card py-10">
                  <Spinner color={theme.textMuted} />
                </VStack>
              )}
            </VStack>

            <VStack>
              <SectionLabel>Volunteer roles</SectionLabel>
              {canManage && (viewerRole === "OWNER" || member.role !== "OWNER") ? (
                <VStack className="gap-2">
                  <VolunteerRolePicker
                    selected={member.volunteerRoles}
                    onToggle={toggleVolunteerRole}
                  />
                  <Text className="ml-1 text-[12px] text-muted-foreground">
                    Tap a role to add or remove it.
                  </Text>
                </VStack>
              ) : member.volunteerRoles.length > 0 ? (
                <HStack className="flex-wrap gap-1.5">
                  {member.volunteerRoles.map((volunteerRole) => {
                    const { emoji, label } = getVolunteerRoleConfig(volunteerRole);
                    return (
                      <HStack
                        key={volunteerRole}
                        className="items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1"
                      >
                        <Text style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Text>
                        <Text className="text-[12px] font-medium text-foreground">{label}</Text>
                      </HStack>
                    );
                  })}
                </HStack>
              ) : (
                <Text className="ml-1 text-[13px] text-muted-foreground">No volunteer roles yet.</Text>
              )}
            </VStack>

            {canAct ? (
              <VStack>
                <SectionLabel>Manage</SectionLabel>
                <InsetCard elevated>
                  <InsetRow label="Change role" value={role?.label} onPress={changeRole} />
                  <InsetRow label="Remove from organization" onPress={confirmRemove} destructive />
                </InsetCard>
              </VStack>
            ) : null}
          </VStack>
        )}
      </ScrollView>
    </VStack>
  );
}
