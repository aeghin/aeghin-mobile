import Megaphone from "lucide-react-native/icons/megaphone";
import { useState } from "react";
import { Alert } from "react-native";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { Text } from "@/components/ui/text";
import { useEmailAllowance } from "@/hooks/use-billing";
import { useEmailOrganization } from "@/hooks/use-organizations";
import { failureMessage } from "@/lib/failure";

type EmailOrganizationDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  /** Everyone in the organization — the recipients, the sender included. */
  recipientCount: number;
};

/**
 * The dashboard's Email Organization dialog: one message to the whole roster.
 *
 * Not the same as the event's Email Team, which writes only to the people who
 * accepted one event. This one reaches everybody, which is why it lives on the
 * members list rather than on an event.
 */
export function EmailOrganizationDialog(props: EmailOrganizationDialogProps) {
  return <EmailOrganizationBody key={String(props.visible)} {...props} />;
}

function EmailOrganizationBody({
  visible,
  onClose,
  organizationId,
  organizationName,
  recipientCount,
}: EmailOrganizationDialogProps) {
  const email = useEmailOrganization(organizationId);
  const allowance = useEmailAllowance(organizationId, visible);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ready = subject.trim().length > 0 && body.trim().length > 0;

  // The same modal either way: swapping one for another while it is open is
  // unreliable on iOS, so the form gives way to the reason in place.
  const usedUp = allowance !== null && allowance.sent >= allowance.limit;

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
      icon={Megaphone}
      title={usedUp ? "Monthly email limit reached" : "Email everyone"}
      description={
        usedUp
          ? `${organizationName} has sent all ${allowance.limit} of this month's group emails.${
              allowance.resetsOn ? ` The count starts over on ${allowance.resetsOn}.` : ""
            }`
          : `Goes to all ${recipientCount} members of ${organizationName}. Replies come back to you.`
      }
      action={usedUp ? undefined : { label: "Send", onPress: submit, disabled: !ready }}
      submitting={email.isPending}
      onClose={onClose}
    >
      {usedUp ? null : (
        <>
          <ErrorBanner message={error} />

          {allowance ? (
            <Text className="text-[12px] text-muted-foreground">
              {`${allowance.sent} of ${allowance.limit} group emails sent this month`}
            </Text>
          ) : null}

          <Field label="Subject">
            <FormInput
              value={subject}
              onChangeText={setSubject}
              placeholder="This weekend's schedule"
              maxLength={120}
              autoFocus
            />
          </Field>

          <Field label="Message">
            <FormInput
              value={body}
              onChangeText={setBody}
              placeholder="What everyone needs to know…"
              multiline
              maxLength={5000}
              style={{ minHeight: 160 }}
            />
          </Field>
        </>
      )}
    </Dialog>
  );
}
