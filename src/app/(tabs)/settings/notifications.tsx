import { Stack } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import BellRing from "lucide-react-native/icons/bell-ring";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import UserCheck from "lucide-react-native/icons/user-check";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useNowPlayingInset } from "@/components/track-player-provider";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import {
  useChangeTeamNotifications,
  useTeamNotifications,
} from "@/hooks/use-team-notifications";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getVolunteerRoleConfig, teamLabel, teamRoles } from "@/lib/config/volunteer-roles";
import { failureMessage } from "@/lib/failure";
import type {
  Team,
  TeamNotificationSettings,
  TeamPerson,
  TeamSettings,
} from "@/types/team-notifications";

const TAB_BAR_CLEARANCE = 64;

const fullName = (person: TeamPerson) => `${person.firstName} ${person.lastName}`;

/** "Ben", "Ben, Mike", "Ben, Mike +2" — whatever fits beside the row's label. */
const summarize = (people: TeamPerson[]) =>
  people.length === 0
    ? "Nobody"
    : people.length <= 2
      ? people.map((person) => person.firstName).join(", ")
      : `${people[0].firstName}, ${people[1].firstName} +${people.length - 2}`;

type Picking = { team: Team; kind: "lead" | "watchers" };

/**
 * The dashboard's Staffing Alerts: who is asked to act when one of a team's
 * roles opens up, and who else gets a heads-up that it's theirs.
 *
 * Owners set it for everybody. An admin reads it and switches only their own
 * heads-up — the server holds the same line, so this screen hiding the other
 * controls is courtesy, not the gate.
 */
export default function StaffingAlertsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nowPlayingInset = useNowPlayingInset();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const settings = useTeamNotifications(organizationId, canManage);
  const change = useChangeTeamNotifications(organizationId);
  const pullToRefresh = usePullToRefresh(settings.refetch);

  const [picking, setPicking] = useState<Picking | null>(null);

  const refused = (error: unknown) => Alert.alert("Couldn't update", failureMessage(error));

  const setLead = (team: Team, userId: string | null) =>
    change.mutate({ team, lead: userId }, { onError: refused });

  const setWatching = (team: Team, userId: string, watching: boolean) =>
    change.mutate({ team, userId, watching }, { onError: refused });

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Staffing alerts", headerBackTitle: "Settings" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + nowPlayingInset,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl {...pullToRefresh} tintColor={theme.textMuted} colors={[brand.orange]} />
        }
      >
        <VStack className="gap-5">
          <Text className="ml-1 text-[13px] text-muted-foreground">
            When a role opens up — somebody declines, an invitation expires, or a member leaves —
            the team&apos;s lead is asked to fill it, and everyone on Also notify gets a heads-up
            that the lead has it. With no lead, whoever sent the invitation is asked, then the
            event&apos;s creator.
          </Text>

          {!canManage ? (
            <EventsEmptyState
              icon={ShieldCheck}
              title="Owners and admins only"
              body="Staffing alerts go to the people who fill roles."
            />
          ) : settings.isError ? (
            <EventsEmptyState
              icon={CircleAlert}
              title="Couldn't load staffing alerts"
              body="Pull down to try again."
              tone="error"
            />
          ) : settings.isPending ? (
            <VStack className="items-center py-10">
              <Spinner color={theme.textMuted} />
            </VStack>
          ) : (
            <>
              {settings.data.viewer.isOwner ? null : (
                <Text className="-mt-2 ml-1 text-[12px] text-muted-foreground">
                  Only an owner can change leads or add other people. Your own heads-up is yours to
                  switch.
                </Text>
              )}

              {settings.data.teams.map((entry) => (
                <TeamSection
                  key={entry.team}
                  entry={entry}
                  viewerId={settings.data.viewer.userId}
                  isOwner={settings.data.viewer.isOwner}
                  onPickLead={() => setPicking({ team: entry.team, kind: "lead" })}
                  onPickWatchers={() => setPicking({ team: entry.team, kind: "watchers" })}
                  onSetMine={(watching) =>
                    setWatching(entry.team, settings.data.viewer.userId, watching)
                  }
                />
              ))}
            </>
          )}
        </VStack>
      </ScrollView>

      {settings.data ? (
        <PeoplePicker
          picking={picking}
          settings={settings.data}
          onClose={() => setPicking(null)}
          onSetLead={(team, userId) => {
            setLead(team, userId);
            setPicking(null);
          }}
          onSetWatching={setWatching}
        />
      ) : null}
    </VStack>
  );
}

function TeamSection({
  entry,
  viewerId,
  isOwner,
  onPickLead,
  onPickWatchers,
  onSetMine,
}: {
  entry: TeamSettings;
  viewerId: string;
  isOwner: boolean;
  onPickLead: () => void;
  onPickWatchers: () => void;
  onSetMine: (watching: boolean) => void;
}) {
  const theme = useTheme();
  const label = teamLabel(entry.team);
  const youLead = entry.lead?.userId === viewerId;
  const youWatch = entry.watchers.some((watcher) => watcher.userId === viewerId);

  return (
    <VStack>
      <SectionLabel>{label}</SectionLabel>
      <InsetCard elevated>
        <InsetRow
          icon={UserCheck}
          label="Lead"
          value={entry.lead ? (youLead ? "You" : fullName(entry.lead)) : "No lead"}
          onPress={isOwner ? onPickLead : undefined}
        />
        <InsetRow
          icon={BellRing}
          label="Also notify"
          value={summarize(entry.watchers)}
          onPress={isOwner ? onPickWatchers : undefined}
        />
        {/* Laid out as an `InsetRow`, with a switch where the chevron goes. */}
        <HStack space="sm" className="min-h-[52px] items-center" style={{ paddingHorizontal: 14 }}>
          <VStack className="items-center justify-center" style={{ width: 18 }}>
            <AppIcon icon={Bell} size={20} color={theme.textMuted} />
          </VStack>
          <Text className="flex-1 text-base text-foreground" numberOfLines={2}>
            {youLead ? `You lead ${label}` : `Notify me about ${label}`}
          </Text>
          {youLead ? null : (
            <Switch
              value={youWatch}
              onValueChange={onSetMine}
              trackColor={{ true: brand.orange }}
              accessibilityLabel={`Notify me about ${label}`}
            />
          )}
        </HStack>
      </InsetCard>
      <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
        {teamRoles(entry.team)
          .map((role) => getVolunteerRoleConfig(role).label)
          .join(", ")}
      </Text>
    </VStack>
  );
}

/**
 * Picks a team's lead (one person, or nobody) or its Also notify (anybody).
 * Owners only; each tap is sent as it's made, so Done just closes.
 */
function PeoplePicker({
  picking,
  settings,
  onClose,
  onSetLead,
  onSetWatching,
}: {
  picking: Picking | null;
  settings: TeamNotificationSettings;
  onClose: () => void;
  onSetLead: (team: Team, userId: string | null) => void;
  onSetWatching: (team: Team, userId: string, watching: boolean) => void;
}) {
  const entry = picking ? settings.teams.find((team) => team.team === picking.team) : undefined;
  const label = picking ? teamLabel(picking.team) : "";
  const lead = picking?.kind === "lead";

  // The lead is already asked to act, so Also notify never offers them.
  const people = lead
    ? settings.managers
    : settings.managers.filter((manager) => manager.userId !== entry?.lead?.userId);

  return (
    <Dialog
      visible={picking !== null}
      icon={lead ? UserCheck : BellRing}
      title={lead ? `${label} lead` : `Also notify about ${label}`}
      description={
        lead
          ? `Asked to fill ${label}'s roles when one opens up.`
          : `A heads-up whenever one of ${label}'s roles opens up, saying who has it.`
      }
      onClose={onClose}
    >
      {picking && entry ? (
        <VStack className="overflow-hidden rounded-xl border border-border">
          {lead ? (
            <PickerRow
              label="No lead"
              selected={entry.lead === null}
              onPress={() => onSetLead(picking.team, null)}
            />
          ) : null}
          {people.map((person, index) => {
            const selected = lead
              ? entry.lead?.userId === person.userId
              : entry.watchers.some((watcher) => watcher.userId === person.userId);

            return (
              <VStack key={person.userId}>
                {index > 0 || lead ? <Divider /> : null}
                <PickerRow
                  label={`${fullName(person)}${person.userId === settings.viewer.userId ? " (you)" : ""}`}
                  detail={person.role === "OWNER" ? "Owner" : "Admin"}
                  selected={selected}
                  onPress={() =>
                    lead
                      ? onSetLead(picking.team, person.userId)
                      : onSetWatching(picking.team, person.userId, !selected)
                  }
                />
              </VStack>
            );
          })}
        </VStack>
      ) : null}
    </Dialog>
  );
}

function PickerRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className="data-[active=true]:bg-border/40"
    >
      <HStack className="min-h-[48px] items-center gap-3 px-3.5">
        <VStack className="flex-1">
          <Text className="text-[15px] text-foreground" numberOfLines={1}>
            {label}
          </Text>
          {detail ? (
            <Text className="text-[12px] text-muted-foreground">{detail}</Text>
          ) : null}
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
