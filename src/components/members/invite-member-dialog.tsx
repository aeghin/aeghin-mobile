import Check from "lucide-react-native/icons/check";
import UserPlus from "lucide-react-native/icons/user-plus";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { VoiceTypePicker } from "@/components/voice-type-picker";
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { useInviteMember } from "@/hooks/use-invitations";
import { useRoles } from "@/hooks/use-roles";
import { failureMessage } from "@/lib/failure";
import type { InvitationInput } from "@/types/organization";

type FieldErrors = Partial<Record<keyof InvitationInput, string>>;

/** The dashboard's `orgInvitationSchema`, re-checked before the round trip. */
function validate(draft: InvitationInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.email = "Invalid email address";
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
  const roles = useRoles();

  const [draft, setDraft] = useState<InvitationInput>({
    email: "",
    volunteerRoles: [],
    voiceType: null,
  });
  const sings = roles.sings(draft.volunteerRoles);
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
      { ...draft, email },
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

      <Field
        label="Email address"
        error={errors.email}
        hint="They'll receive an invitation link to join your organization."
      >
        <FormInput
          value={draft.email}
          onChangeText={(value) => set("email", value)}
          placeholder="volunteer@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          autoFocus
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
          onToggle={(role) => {
            const next = toggleRole(draft.volunteerRoles, role);
            set("volunteerRoles", next);
            // Nothing left that sings, so there's no voice type to send.
            if (!roles.sings(next)) set("voiceType", null);
          }}
        />
      </Field>

      {sings ? (
        <Field label="Voice type" hint="Optional. You can change it later from Members.">
          <VoiceTypePicker
            selected={draft.voiceType}
            onChange={(voiceType) => set("voiceType", voiceType)}
          />
        </Field>
      ) : null}
    </Dialog>
  );
}
