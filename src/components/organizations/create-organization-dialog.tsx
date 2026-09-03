import Building2 from "lucide-react-native/icons/building-2";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { useCreateOrganization } from "@/hooks/use-organizations";
import { failureMessage } from "@/lib/failure";
import type { OrganizationInput } from "@/types/organization";

/** The dashboard's `organizationSchema`, re-checked here before the round trip. */
function validate(draft: OrganizationInput) {
  const errors: Partial<Record<keyof OrganizationInput, string>> = {};
  const name = draft.name.trim();

  if (name.length < 3) errors.name = "Organization name must be at least 3 characters long";
  else if (name.length > 20) errors.name = "Organization name must be at most 20 characters long";

  if (draft.description.trim().length > 100) {
    errors.description = "Description must be at most 100 characters long";
  }

  return errors;
}

type CreateOrganizationDialogProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (orgId: string) => void;
};

/** The web's Create Organization dialog. */
export function CreateOrganizationDialog({
  visible,
  onClose,
  onCreated,
}: CreateOrganizationDialogProps) {
  return (
    <CreateOrganizationBody
      key={String(visible)}
      visible={visible}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function CreateOrganizationBody({ visible, onClose, onCreated }: CreateOrganizationDialogProps) {
  const create = useCreateOrganization();

  const [draft, setDraft] = useState<OrganizationInput>({ name: "", description: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationInput, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof OrganizationInput>(key: K, value: OrganizationInput[K]) => {
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
    create.mutate(
      { name: draft.name.trim(), description: draft.description.trim() },
      {
        onSuccess: ({ orgId }) => onCreated(orgId),
        onError: (error) => setSubmitError(failureMessage(error)),
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={Building2}
      title="Create organization"
      description="Set up your organization to start managing volunteers and events."
      action={{ label: "Create", onPress: submit }}
      submitting={create.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={submitError} />

      <Field label="Organization name" error={errors.name}>
        <FormInput
          value={draft.name}
          onChangeText={(value) => set("name", value)}
          placeholder="e.g., Grace Community Church"
          autoCapitalize="words"
          maxLength={20}
          autoFocus
        />
      </Field>

      <Field label="Description" error={errors.description} hint="Up to 100 characters.">
        <FormInput
          value={draft.description}
          onChangeText={(value) => set("description", value)}
          placeholder="Tell us about your organization…"
          multiline
          maxLength={100}
        />
      </Field>
    </Dialog>
  );
}
