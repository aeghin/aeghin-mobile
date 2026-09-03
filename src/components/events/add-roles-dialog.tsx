import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field } from "@/components/form-fields";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { useAddEventRoles } from "@/hooks/use-events";
import { failureMessage } from "@/lib/failure";
import type { VolunteerRole } from "@/types/event";

type AddRolesDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** Already on the roster, so not on offer. */
  existing: VolunteerRole[];
};

/** The web's Add Roles dialog: open slots the team card can invite into. */
export function AddRolesDialog(props: AddRolesDialogProps) {
  return <AddRolesBody key={String(props.visible)} {...props} />;
}

function AddRolesBody({ visible, onClose, organizationId, eventId, existing }: AddRolesDialogProps) {
  const add = useAddEventRoles(organizationId, eventId);
  const [roles, setRoles] = useState<VolunteerRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    add.mutate(roles, {
      onSuccess: onClose,
      onError: (failure) => setError(failureMessage(failure)),
    });
  };

  return (
    <Dialog
      visible={visible}
      icon={Plus}
      title="Add roles"
      description="Open a slot on this event's roster that you can invite people into."
      action={{ label: "Add", onPress: submit, disabled: roles.length === 0 }}
      submitting={add.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <Field
        label="Roles needed"
        hint="Roles already on this event are greyed out. Invite people into a role from the Manage card once it is on the roster."
      >
        <VolunteerRolePicker
          selected={roles}
          disabled={existing}
          onToggle={(role) => setRoles((current) => toggleRole(current, role))}
        />
      </Field>
    </Dialog>
  );
}
