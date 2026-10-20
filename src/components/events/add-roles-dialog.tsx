import Check from "lucide-react-native/icons/check";
import Plus from "lucide-react-native/icons/plus";
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
import { useAddEventRoles } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { VolunteerRole } from "@/types/event";

type AddRolesDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** The roles on the roster now, so not on offer. */
  roster: VolunteerRole[];
};

/**
 * The web's Add roles dialog: every role the event doesn't have yet, by team,
 * to tick and add. Taking one off is a swipe left on its open spot on the Team card.
 *
 * It only picks roles. Who can fill one is the invite dialog's question, asked
 * with the availability check at the moment somebody is being picked.
 */
export function AddRolesDialog(props: AddRolesDialogProps) {
  return <AddRolesBody key={String(props.visible)} {...props} />;
}

function AddRolesBody({ visible, onClose, organizationId, eventId, roster }: AddRolesDialogProps) {
  const catalog = useRoles();
  const add =useAddEventRoles(organizationId, eventId);

  const [selected, setSelected] = useState<VolunteerRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  const offered = catalog.order.filter((role) => !roster.includes(role));

  const submit = () => {
    setError(null);
    add.mutate(selected, {
      onSuccess: onClose,
      onError: (failure) => setError(failureMessage(failure)),
    });
  };

  return (
    <Dialog
      visible={visible}
      icon={Plus}
      title="Add roles"
      description={
        offered.length > 0
          ? "Roles show up on the Team card as open spots. Swipe left on an empty one to remove it."
          : "Every role is already on this event. Swipe left on an empty role on the Team card to remove it."
      }
      action={{ label: "Add", onPress: submit, disabled: selected.length === 0 }}
      submitting={add.isPending}
      onClose={onClose}
    >
      {offered.length > 0 ? (
        <>
          <ErrorBanner message={error} />

          {catalog.teamsOf(offered).map((team) => (
            <Field key={team} label={catalog.teamLabel(team)}>
              <FormCard>
                {offered
                  .filter((role) => catalog.teamOf(role) === team)
                  .map((role, index) => (
                    <VStack key={role}>
                      {index > 0 ? <Divider style={{ marginLeft: 48 }} /> : null}
                      <RoleRow
                        role={role}
                        checked={selected.includes(role)}
                        onPress={() => setSelected((current) => toggleRole(current, role))}
                      />
                    </VStack>
                  ))}
              </FormCard>
            </Field>
          ))}
        </>
      ) : null}
    </Dialog>
  );
}

function RoleRow({
  role,
  checked,
  onPress,
}: {
  role: VolunteerRole;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { label, emoji } = useRoles().get(role);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      className="data-[active=true]:bg-border/40"
    >
      <HStack className="items-center gap-3 px-3 py-2.5">
        <Text style={{ width: 24, fontSize: 20, lineHeight: 26, textAlign: "center" }}>
          {emoji}
        </Text>

        <Text className="flex-1 text-[15px] font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>

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
