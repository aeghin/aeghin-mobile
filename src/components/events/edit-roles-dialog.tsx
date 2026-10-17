import Check from "lucide-react-native/icons/check";
import Pencil from "lucide-react-native/icons/pencil";
import { useState } from "react";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormCard } from "@/components/form-fields";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { toggleRole } from "@/components/volunteer-role-picker";
import { brand } from "@/constants/branding";
import { useAddEventRoles, useRemoveEventRole } from "@/hooks/use-events";
import { useMembersList } from "@/hooks/use-members-list";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type { EventDetailsAssignment, VolunteerRole } from "@/types/event";

type EditRolesDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** The roles on the roster now. */
  roster: VolunteerRole[];
  /** Who is on them, which decides the roles that can't come off. */
  assignments: EventDetailsAssignment[];
};

/**
 * The roster's roles in one place: tick one to open it on the Team card,
 * untick one to take it off.
 *
 * The web adds roles from a dialog like this and removes each with an X on
 * its row; the phone does both here, so the Team card shows only people and
 * open spots. The rules are the server's either way: a role with somebody
 * accepted or still deciding can't come off, so it stays ticked and says who.
 */
export function EditRolesDialog(props: EditRolesDialogProps) {
  return <EditRolesBody key={String(props.visible)} {...props} />;
}

function EditRolesBody({
  visible,
  onClose,
  organizationId,
  eventId,
  roster,
  assignments,
}: EditRolesDialogProps) {
  const catalog = useRoles();
  const members = useMembersList(organizationId);
  const add = useAddEventRoles(organizationId, eventId);
  const remove = useRemoveEventRole(organizationId, eventId);

  const [selected, setSelected] = useState<VolunteerRole[]>(roster);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // Every role, plus any on the roster that this build's list doesn't know.
  const offered = catalog.inOrder([...catalog.order, ...roster]);

  const added = selected.filter((role) => !roster.includes(role));
  const removed = roster.filter((role) => !selected.includes(role));

  const liveOn = (role: VolunteerRole) =>
    assignments.filter(
      (assignment) =>
        assignment.role === role &&
        (assignment.status === "ACCEPTED" ||
          (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now)),
    );

  const noteFor = (role: VolunteerRole): { text: string; locked?: boolean; warn?: boolean } => {
    const live = liveOn(role).map((assignment) => personName(assignment.user));

    if (live.length > 0) {
      return {
        locked: true,
        text:
          live.length === 1
            ? `${live[0]} is on it`
            : live.length === 2
              ? `${live[0]} and ${live[1]} are on it`
              : `${live[0]} and ${live.length - 1} others are on it`,
      };
    }

    if (roster.includes(role)) {
      return selected.includes(role)
        ? { text: "On this event" }
        : { text: "Comes off this event", warn: true };
    }

    if (!members.data) return { text: "Not on this event" };

    const holders = members.data.filter((member) => member.volunteerRoles.includes(role));

    return { text: `${holders.length} available` };
  };

  // One request at a time: each rewrites the event's whole list of roles, so
  // two in flight would each put back the role the other took off. Adding goes
  // first, so a failure there has removed nothing.
  const save = async () => {
    setError(null);
    setSaving(true);

    try {
      if (added.length > 0) await add.mutateAsync(added);

      for (const role of removed) {
        await remove.mutateAsync(role);
      }

      onClose();
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      icon={Pencil}
      title="Edit roles"
      description="Roles show up on the Team card as open spots you can invite into."
      action={{ label: "Save", onPress: save, disabled: added.length + removed.length === 0 }}
      submitting={saving}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      {catalog.teamsOf(offered).map((team) => (
        <Field key={team} label={catalog.teamLabel(team)}>
          <FormCard>
            {offered
              .filter((role) => catalog.teamOf(role) === team)
              .map((role, index) => {
                const note = noteFor(role);

                return (
                  <VStack key={role}>
                    {index > 0 ? <Divider style={{ marginLeft: 48 }} /> : null}
                    <RoleRow
                      role={role}
                      checked={selected.includes(role)}
                      note={note.text}
                      locked={note.locked}
                      warn={note.warn}
                      onPress={() => setSelected((current) => toggleRole(current, role))}
                    />
                  </VStack>
                );
              })}
          </FormCard>
        </Field>
      ))}
    </Dialog>
  );
}

type RoleRowProps = {
  role: VolunteerRole;
  checked: boolean;
  /** The line under the name: who can fill it, who is on it, or what Save does to it. */
  note: string;
  /** Somebody is on it, so it can't come off. */
  locked?: boolean;
  /** About to come off the event. */
  warn?: boolean;
  onPress: () => void;
};

function RoleRow({ role, checked, note, locked = false, warn = false, onPress }: RoleRowProps) {
  const theme = useTheme();
  const { label, emoji } = useRoles().get(role);

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="checkbox"
      accessibilityLabel={`${label}, ${note}`}
      accessibilityState={{ checked, disabled: locked }}
      className="data-[active=true]:bg-border/40"
      // The web's locked-in rows are faded too. Inline, because the shared
      // Pressable's own disabled fade goes further and reads as unavailable.
      style={{ opacity: locked ? 0.55 : 1 }}
    >
      <HStack className="items-center gap-3 px-3 py-2.5">
        <Text style={{ width: 24, fontSize: 20, lineHeight: 26, textAlign: "center" }}>
          {emoji}
        </Text>

        <VStack className="flex-1">
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {label}
          </Text>
          <Text
            className="text-[12px]"
            style={{ color: warn ? theme.destructive : theme.textMuted }}
            numberOfLines={1}
          >
            {note}
          </Text>
        </VStack>

        <Box
          className="h-5 w-5 items-center justify-center rounded-full border"
          style={{
            borderColor: checked ? brand.orange : theme.border,
            backgroundColor: checked ? brand.orange : "transparent",
          }}
        >
          {checked ? <AppIcon icon={Check} size={12} color="#FFFFFF" /> : null}
        </Box>
      </HStack>
    </Pressable>
  );
}
