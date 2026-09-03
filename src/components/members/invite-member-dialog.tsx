import Check from "lucide-react-native/icons/check";
import UserPlus from "lucide-react-native/icons/user-plus";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { useInviteMember } from "@/hooks/use-invitations";
import { failureMessage } from "@/lib/failure";
import type { InvitationInput } from "@/types/organization";

type FieldErrors = Partial<Record<keyof InvitationInput, string>>;

/** The dashboard's `orgInvitationSchema`, re-checked before the round trip. */
function validate(draft: InvitationInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = "Invalid email address";
  }
  if (!/^\d{10}$/.test(draft.phoneNumber.trim())) {
    errors.phoneNumber = "Enter a valid 10-digit phone number";
  }
  if (draft.volunteerRoles.length === 0) {
    errors.volunteerRoles = "Select at least one role";
  }

  return errors;
}

type InviteMemberDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
};

/** The web's Invite Person dialog, including its "sent" state. */
export function InviteMemberDialog(props: InviteMemberDialogProps) {
  return <InviteMemberBody key={String(props.visible)} {...props} />;
}

function InviteMemberBody({
  visible,
  onClose,
  organizationId,
  organizationName,
}: InviteMemberDialogProps) {
  const invite = useInviteMember(organizationId);

  const [draft, setDraft] = useState<InvitationInput>({
    email: "",
    phoneNumber: "",
    volunteerRoles: [],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = <K extends keyof InvitationInput>(key: K, value: InvitationInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => {
    const found = validate(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSubmitError(null);
    const email = draft.email.trim().toLowerCase();
    invite.mutate(
      { ...draft, email, phoneNumber: draft.phoneNumber.trim() },
      {
        onSuccess: () => setSentTo(email),
        onError: (error) => setSubmitError(failureMessage(error)),
      },
    );
  };

  if (sentTo) {
    return (
      <Dialog
        visible={visible}
        icon={Check}
        title="Invitation sent"
        description={`An invitation has been sent to ${sentTo} to join ${organizationName}.`}
        onClose={onClose}
      />
    );
  }

  return (
    <Dialog
      visible={visible}
      icon={UserPlus}
      title="Invite member"
      description={`Send an invitation to join ${organizationName}.`}
      action={{ label: "Send", onPress: submit }}
      submitting={invite.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={submitError} />

      <Field label="Email address" error={errors.email}>
        <FormInput
          value={draft.email}
          onChangeText={(value) => set("email", value)}
          placeholder="volunteer@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
        />
      </Field>

      <Field
        label="Phone number"
        error={errors.phoneNumber}
        hint="They'll receive an invitation link to join your organization."
      >
        <FormInput
          value={draft.phoneNumber}
          onChangeText={(value) => set("phoneNumber", value.replace(/[^0-9]/g, ""))}
          placeholder="1234567890"
          keyboardType="number-pad"
          maxLength={10}
        />
      </Field>

      <Field
        label="Volunteer roles"
        error={errors.volunteerRoles}
        hint={
          draft.volunteerRoles.length > 0
            ? `${draft.volunteerRoles.length} selected`
            : "Select one or more volunteer roles for this person."
        }
      >
        <VolunteerRolePicker
          selected={draft.volunteerRoles}
          onToggle={(role) => set("volunteerRoles", toggleRole(draft.volunteerRoles, role))}
        />
      </Field>
    </Dialog>
  );
}
