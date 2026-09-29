import Check from "lucide-react-native/icons/check";
import UserCog from "lucide-react-native/icons/user-cog";
import { useState } from "react";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { FormGroup } from "@/components/form-fields";
import { InsetRow } from "@/components/inset-list";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { teamLabel } from "@/lib/config/volunteer-roles";
import type { Team, TeamLeadPick, TeamPerson } from "@/types/team-notifications";

/**
 * This event's picks, by team — only the teams handed to somebody other than
 * the default. A team left out follows the service type.
 */
export type TeamLeadPicks = Partial<Record<Team, string>>;

/**
 * Who a team with no lead falls to: the event's creator while they can still
 * act on it, else the owners.
 */
export type TeamLeadFallback = {
  /** The creator's id, so the list doesn't offer them twice. Null for the owners. */
  userId: string | null;
  /** "You", "Adam Smith" or "The owners". */
  name: string;
};

/** The picks as the create and edit routes take them. */
export const teamLeadPicksInput = (picks: TeamLeadPicks): TeamLeadPick[] =>
  (Object.entries(picks) as [Team, string][]).map(([team, userId]) => ({ team, userId }));

/** The event's picks, back into the form's shape. */
export const teamLeadPicksFrom = (picks: TeamLeadPick[]): TeamLeadPicks =>
  Object.fromEntries(picks.map((pick) => [pick.team, pick.userId]));

type EventTeamLeadsGroupProps = {
  /** Teams this event has roles in, in roster order. */
  teams: Team[];
  /** The service type's lead for each team: what a team follows unless changed here. */
  defaults: Partial<Record<Team, TeamPerson>>;
  /** Admins and owners: anybody who can handle a team. */
  managers: TeamPerson[];
  /** The signed-in manager, named "You". */
  viewerId: string;
  /** Who a team with no lead falls to. */
  fallback: TeamLeadFallback;
  /** The service type the defaults come from, e.g. "Worship". */
  serviceTypeName: string | null;
  value: TeamLeadPicks;
  onChange: (next: TeamLeadPicks) => void;
  /** The chosen service type's hue, as the rest of the form wears it. */
  tint?: string;
};

/**
 * "Who handles open spots": every team starts on its default — the service
 * type's lead from Settings, or with no lead whoever the alerts fall to — and
 * can be handed to somebody else for this event only, the week the band lead
 * is away, with nothing to switch back afterwards. The dashboard's create and
 * edit forms carry the same section.
 */
export function EventTeamLeadsGroup({
  teams,
  defaults,
  managers,
  viewerId,
  fallback,
  serviceTypeName,
  value,
  onChange,
  tint,
}: EventTeamLeadsGroupProps) {
  const [picking, setPicking] = useState<Team | null>(null);

  if (teams.length === 0) return null;

  const nameOf = (person: TeamPerson) =>
    person.userId === viewerId ? "You" : `${person.firstName} ${person.lastName}`;

  // Always a real person: the lead, or whoever a team without one falls to.
  const defaultIdOf = (team: Team) => defaults[team]?.userId ?? fallback.userId;

  const defaultNameOf = (team: Team) => {
    const lead = defaults[team];

    return lead ? nameOf(lead) : fallback.name;
  };

  const coverOf = (team: Team) => {
    const chosen = value[team];

    return chosen ? managers.find((manager) => manager.userId === chosen) : undefined;
  };

  const summary = (team: Team) => {
    const covering = coverOf(team);

    return covering
      ? `${nameOf(covering)} · This event only`
      : `${defaultNameOf(team)} · Default`;
  };

  const pick = (team: Team, userId: string | null) => {
    const next: TeamLeadPicks = { ...value };

    if (userId === null || userId === defaultIdOf(team)) {
      delete next[team];
    } else {
      next[team] = userId;
    }

    onChange(next);
    setPicking(null);
  };

  const label = picking ? teamLabel(picking) : "";
  const covering = picking ? coverOf(picking) : undefined;

  return (
    <>
      <FormGroup
        label="Who handles open spots"
        icon={UserCog}
        tint={tint}
        footnote={`Filled in from Settings${serviceTypeName ? ` for ${serviceTypeName}` : ""}. Change one and it only applies to this event.`}
      >
        {teams.map((team) => (
          <InsetRow
            key={team}
            label={teamLabel(team)}
            value={summary(team)}
            onPress={() => setPicking(team)}
          />
        ))}
      </FormGroup>

      <Dialog
        visible={picking !== null}
        icon={UserCog}
        title={`Who handles ${label}`}
        description={`Asked to fill ${label}'s open spots on this event.`}
        onClose={() => setPicking(null)}
      >
        {picking ? (
          <VStack className="overflow-hidden rounded-xl border border-border">
            <PickerRow
              label={
                covering
                  ? `Back to ${defaultNameOf(picking)} (Default)`
                  : `${defaultNameOf(picking)} (Default)`
              }
              detail={defaults[picking] ? "Lead in Settings" : "No lead set"}
              selected={!covering}
              onPress={() => pick(picking, null)}
            />
            {managers
              .filter((manager) => manager.userId !== defaultIdOf(picking))
              .map((manager) => (
                <VStack key={manager.userId}>
                  <Divider />
                  <PickerRow
                    label={nameOf(manager)}
                    detail="This event only"
                    selected={covering?.userId === manager.userId}
                    onPress={() => pick(picking, manager.userId)}
                  />
                </VStack>
              ))}
          </VStack>
        ) : null}
      </Dialog>
    </>
  );
}

function PickerRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className="data-[active=true]:bg-border/40"
    >
      <HStack className="min-h-[48px] items-center gap-3 px-3.5">
        <VStack className="flex-1">
          <Text className="text-[15px] text-foreground" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-[12px] text-muted-foreground">{detail}</Text>
        </VStack>
        <Box
          className="h-5 w-5 items-center justify-center rounded-full border"
          style={{
            borderColor: selected ? brand.orange : theme.border,
            backgroundColor: selected ? brand.orange : "transparent",
          }}
        >
          {selected ? <AppIcon icon={Check} size={12} color="#FFFFFF" /> : null}
        </Box>
      </HStack>
    </Pressable>
  );
}
