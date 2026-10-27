import Check from "lucide-react-native/icons/check";
import Plus from "lucide-react-native/icons/plus";
import { useState } from "react";
import { Switch } from "react-native";

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
import { useAddEventRoles } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import type { ServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type { EventTeamLead, VolunteerRole } from "@/types/event";
import type { Team } from "@/types/team-notifications";

type AddRolesDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** The roles on the roster now, so not on offer. */
  roster: VolunteerRole[];
  /** The event's service colours, which a ticked role is drawn in, as the web's are. */
  colors: ServiceColors;
  /** Who handles each team on this event: whoever covers it here, else the service type's lead. */
  teamLeads: Partial<Record<Team, EventTeamLead>>;
  /** The signed-in manager, who can take a new team on rather than leave it to its lead. */
  viewerId: string;
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

function AddRolesBody({
  visible,
  onClose,
  organizationId,
  eventId,
  roster,
  colors,
  teamLeads,
  viewerId,
}: AddRolesDialogProps) {
  const catalog = useRoles();
  const add =useAddEventRoles(organizationId, eventId);

  const [selected, setSelected] = useState<VolunteerRole[]>([]);
  const [fillMyself, setFillMyself] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);

  const offered = catalog.order.filter((role) => !roster.includes(role));

  // A team the ticked roles bring onto the event that somebody else would be
  // told to staff, by who that is. The create form's "Who handles open spots"
  // never offered it, so the adder can take it on here before that happens.
  const rosterTeams = new Set(roster.map((role) => catalog.teamOf(role)));

  const askedOf = (team: Team) => {
    const handler = teamLeads[team];

    return !rosterTeams.has(team) &&
      selected.some((role) => catalog.teamOf(role) === team) &&
      handler &&
      handler.userId !== viewerId
      ? personName(handler)
      : null;
  };

  const submit = () => {
    setError(null);
    add.mutate(
      {
        roles: selected,
        // Only teams still on offer: one whose roles were unticked again is left out.
        fillMyself: fillMyself.filter((team) => askedOf(team) !== null),
      },
      {
        onSuccess: onClose,
        onError: (failure) => setError(failureMessage(failure)),
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={Plus}
      accent={colors.base}
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

          {catalog.teamsOf(offered).map((team) => {
            const label = catalog.teamLabel(team);
            const asked = askedOf(team);
            const mine = fillMyself.includes(team);

            return (
              <Field key={team} label={label}>
                <FormCard>
                  {offered
                    .filter((role) => catalog.teamOf(role) === team)
                    .map((role, index) => (
                      <VStack key={role}>
                        {index > 0 ? <Divider style={{ marginLeft: 48 }} /> : null}
                        <RoleRow
                          role={role}
                          checked={selected.includes(role)}
                          accent={colors.base}
                          onPress={() => setSelected((current) => toggleRole(current, role))}
                        />
                      </VStack>
                    ))}
                </FormCard>

                {asked ? (
                  <HStack className="mt-2 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5">
                    <VStack className="flex-1">
                      <Text className="text-[15px] text-foreground">I&apos;ll fill it myself</Text>
                      <Text className="text-[12px] text-muted-foreground">
                        {`${label} is new on this event. ${
                          mine
                            ? `You'll fill it, so ${asked} won't be asked to.`
                            : `${asked} will be asked to fill it.`
                        }`}
                      </Text>
                    </VStack>
                    <Switch
                      value={mine}
                      onValueChange={(on) =>
                        setFillMyself((current) =>
                          on ? [...current, team] : current.filter((entry) => entry !== team),
                        )
                      }
                      trackColor={{ true: colors.base }}
                      accessibilityLabel={`I'll fill ${label} myself`}
                    />
                  </HStack>
                ) : null}
              </Field>
            );
          })}
        </>
      ) : null}
    </Dialog>
  );
}

function RoleRow({
  role,
  checked,
  accent,
  onPress,
}: {
  role: VolunteerRole;
  checked: boolean;
  /** The event's service colour, which the tick is drawn in. */
  accent: string;
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
            borderColor: checked ? accent : theme.border,
            backgroundColor: checked ? accent : "transparent",
          }}
        >
          {checked ? <AppIcon icon={Check} size={12} color="#FFFFFF" /> : null}
        </Box>
      </HStack>
    </Pressable>
  );
}
