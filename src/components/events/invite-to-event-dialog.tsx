import Check from "lucide-react-native/icons/check";
import UserPlus from "lucide-react-native/icons/user-plus";
import { useState } from "react";
import { Alert } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Choice, ErrorBanner, Field, FormCard } from "@/components/form-fields";
import { OrgAvatar } from "@/components/org-avatar";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { brand } from "@/constants/branding";
import { useInviteToEvent } from "@/hooks/use-events";
import { useMembersList } from "@/hooks/use-members-list";
import { useTheme } from "@/hooks/use-theme";
import { getVolunteerRoleConfig, ROLE_ORDER } from "@/lib/config/volunteer-roles";
import { failureMessage } from "@/lib/failure";
import type { EventDetailsAssignment, VolunteerRole } from "@/types/event";

const EXPIRY_OPTIONS = [3, 5, 7] as const;

type InviteToEventDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** Roles on the roster, listed first in the picker. */
  rosterRoles: VolunteerRole[];
  assignments: EventDetailsAssignment[];
};

/**
 * The web's Invite to Event dialog: pick a role, pick the members who hold
 * it, pick how long they have to answer.
 */
export function InviteToEventDialog(props: InviteToEventDialogProps) {
  return <InviteToEventBody key={String(props.visible)} {...props} />;
}

function InviteToEventBody({
  visible,
  onClose,
  organizationId,
  eventId,
  rosterRoles,
  assignments,
}: InviteToEventDialogProps) {
  const theme = useTheme();
  const members = useMembersList(organizationId);
  const invite = useInviteToEvent(organizationId, eventId);

  const [role, setRole] = useState<VolunteerRole | null>(rosterRoles[0] ?? null);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<3 | 5 | 7>(3);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // Roster roles first, then the rest — the same order the web's select uses.
  const roles = [...rosterRoles, ...ROLE_ORDER.filter((entry) => !rosterRoles.includes(entry))];

  // Anyone live on the event is skipped by the server; hide them here so the
  // picker only offers people the invite can reach.
  const live = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.status === "ACCEPTED" ||
          (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now),
      )
      .map((assignment) => assignment.userId),
  );

  const candidates = role
    ? (members.data ?? []).filter(
        (member) => member.volunteerRoles.includes(role) && !live.has(member.id),
      )
    : [];

  const toggleUser = (id: string) =>
    setUserIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const submit = () => {
    if (!role) return;
    setError(null);
    invite.mutate(
      { role, userIds, expiresAt },
      {
        onSuccess: ({ invitedCount, skippedNames }) => {
          onClose();
          const skipped =
            skippedNames.length > 0 ? ` Already on the event: ${skippedNames.join(", ")}.` : "";
          Alert.alert(
            "Invitations sent",
            `${invitedCount} ${invitedCount === 1 ? "person" : "people"} invited.${skipped}`,
          );
        },
        onError: (failure) => setError(failureMessage(failure)),
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={UserPlus}
      title="Invite volunteers"
      description="Pick a role, then the members who hold it."
      action={{ label: "Invite", onPress: submit, disabled: !role || userIds.length === 0 }}
      submitting={invite.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <Field label="Role">
        <VolunteerRolePicker
          roles={roles}
          selected={role ? [role] : []}
          single
          onToggle={(next) => {
            setRole(toggleRole(role ? [role] : [], next, true)[0] ?? null);
            setUserIds([]);
          }}
        />
      </Field>

      <Field
        label={role ? `Members who can play ${getVolunteerRoleConfig(role).label}` : "Members"}
        hint={
          role && candidates.length === 0 && !members.isPending
            ? "Nobody available holds this role, or everyone who does is already on the event."
            : undefined
        }
      >
        {members.isPending ? (
          <HStack className="justify-center py-4">
            <Spinner size="small" color={theme.textMuted} />
          </HStack>
        ) : candidates.length > 0 ? (
          <FormCard>
            {candidates.map((member, index) => {
              const selected = userIds.includes(member.id);
              const name = `${member.firstName} ${member.lastName}`.trim();
              return (
                <VStack key={member.id}>
                  {index > 0 ? <Divider style={{ marginLeft: 58 }} /> : null}
                  <Pressable
                    onPress={() => toggleUser(member.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    className="data-[active=true]:bg-border/40"
                  >
                    <HStack className="items-center gap-3 px-3 py-2.5">
                      <OrgAvatar name={name} logoUrl={member.imageUrl} size={34} shape="circle" />
                      <VStack className="flex-1">
                        <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
                          {name}
                        </Text>
                        <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
                          {member.email}
                        </Text>
                      </VStack>
                      {selected ? <AppIcon icon={Check} size={18} color={brand.orange} /> : null}
                    </HStack>
                  </Pressable>
                </VStack>
              );
            })}
          </FormCard>
        ) : null}
      </Field>

      <Field label="Time to respond">
        <HStack className="gap-1.5">
          {EXPIRY_OPTIONS.map((days) => (
            <Choice
              key={days}
              label={`${days} days`}
              selected={expiresAt === days}
              onPress={() => setExpiresAt(days)}
            />
          ))}
        </HStack>
      </Field>
    </Dialog>
  );
}
