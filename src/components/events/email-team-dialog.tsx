import Mail from "lucide-react-native/icons/mail";
import { useState } from "react";
import { Alert } from "react-native";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { useEmailTeam } from "@/hooks/use-events";
import { failureMessage } from "@/lib/failure";

type EmailTeamDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** How many people have accepted — the recipients. */
  acceptedCount: number;
};

/** The web's Email Team dialog: one message to everyone who has accepted. */
export function EmailTeamDialog(props: EmailTeamDialogProps) {
  return <EmailTeamBody key={String(props.visible)} {...props} />;
}

function EmailTeamBody({
  visible,
  onClose,
  organizationId,
  eventId,
  acceptedCount,
}: EmailTeamDialogProps) {
  const email = useEmailTeam(organizationId, eventId);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ready = subject.trim().length > 0 && body.trim().length > 0;

  const submit = () => {
    setError(null);
    email.mutate(
      { subject: subject.trim(), body: body.trim() },
      {
        onSuccess: ({ sentCount }) => {
          onClose();
          Alert.alert(
            "Sent",
            `Your message went to ${sentCount} ${sentCount === 1 ? "person" : "people"}.`,
          );
        },
        onError: (failure) => setError(failureMessage(failure)),
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={Mail}
      title="Email team"
      description={
        acceptedCount === 0
          ? "Nobody has accepted yet, so there is no one to email."
          : `Goes to the ${acceptedCount} ${acceptedCount === 1 ? "person" : "people"} who have accepted. Replies come back to you.`
      }
      action={{ label: "Send", onPress: submit, disabled: !ready }}
      submitting={email.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <Field label="Subject">
        <FormInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Sunday run-through"
          maxLength={120}
          autoFocus
        />
      </Field>

      <Field label="Message">
        <FormInput
          value={body}
          onChangeText={setBody}
          placeholder="What the team needs to know…"
          multiline
          maxLength={5000}
          style={{ minHeight: 160 }}
        />
      </Field>
    </Dialog>
  );
}
