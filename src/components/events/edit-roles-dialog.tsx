import Pencil from "lucide-react-native/icons/pencil";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field } from "@/components/form-fields";
import { Text } from "@/components/ui/text";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { useAddEventRoles, useRemoveEventRole } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
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
 * The roster's roles as chips: pick one to open it on the Team card, unpick
 * one to take it off.
 *
 * The web adds roles from a dialog and removes each with an X on its row; the
 * phone does both here, so the Team card shows only people and open spots. A
 * role with somebody accepted or still deciding can't come off — the server
 * refuses it — so its chip stays picked and greyed.
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
  const theme = useTheme();
  const catalog = useRoles();
  const add = useAddEventRoles(organizationId, eventId);
  const remove = useRemoveEventRole(organizationId, eventId);

  const [selected, setSelected] = useState<VolunteerRole[]>(roster);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const locked = roster.filter((role) =>
    assignments.some(
      (assignment) =>
        assignment.role === role &&
        (assignment.status === "ACCEPTED" ||
          (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now)),
    ),
  );

  const added = selected.filter((role) => !roster.includes(role));
  const removed = roster.filter((role) => !selected.includes(role));

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

      <Field
        label="Roles needed"
        hint={
          locked.length > 0
            ? "Greyed-out roles have someone on them, so they stay."
            : undefined
        }
      >
        <VolunteerRolePicker
          // Every role, plus any on the roster this build's list doesn't know,
          // so one unpicked here can still be picked again.
          roles={catalog.inOrder([...catalog.order, ...roster])}
          selected={selected}
          disabled={locked}
          onToggle={(role) => setSelected((current) => toggleRole(current, role))}
        />
      </Field>

      {removed.length > 0 ? (
        <Text className="ml-1 text-[13px]" style={{ color: theme.destructive }}>
          {`Comes off this event: ${removed.map((role) => catalog.get(role).label).join(", ")}`}
        </Text>
      ) : null}
    </Dialog>
  );
}
