import { Stack } from "expo-router";
import BellRing from "lucide-react-native/icons/bell-ring";
import CalendarRange from "lucide-react-native/icons/calendar-range";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import UserCheck from "lucide-react-native/icons/user-check";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
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
import { useRoles } from "@/hooks/use-roles";
import {
  useChangeTeamNotifications,
  useTeamNotifications,
} from "@/hooks/use-team-notifications";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import { getServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type {
  ServiceTypeTeams,
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
 * The dashboard's Staffing Alerts: for each service type, who is asked to act
 * when one of a team's roles opens up, and who else gets a heads-up that it's
 * theirs. Owners change it — the server holds the same line — and admins see
 * it read-only.
 *
 * The other half lives on each event: a team can be handed to somebody else
 * for that event only, from the create and edit screens. Admins can do that.
 */
export default function StaffingAlertsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nowPlayingInset = useNowPlayingInset();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);
  const isOwner = organization?.role === "OWNER";

  const settings = useTeamNotifications(organizationId, canManage);
  const change = useChangeTeamNotifications(organizationId);
  const pullToRefresh = usePullToRefresh(settings.refetch);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);

  const serviceTypes = settings.data?.serviceTypes ?? [];

  // The first until one is picked, and the first again if the picked one goes.
  const selected =
    serviceTypes.find((serviceType) => serviceType.serviceTypeId === selectedId) ??
    serviceTypes[0];

  const refused = (error: unknown) => Alert.alert("Couldn't update", failureMessage(error));

  const setLead = (serviceTypeId: string, team: Team, userId: string | null) =>
    change.mutate({ serviceTypeId, team, lead: userId }, { onError: refused });

  const setWatching = (serviceTypeId: string, team: Team, userId: string, watching: boolean) =>
    change.mutate({ serviceTypeId, team, userId, watching }, { onError: refused });

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
            When a spot opens up — somebody declines, an invitation expires, or a member leaves —
            that team&apos;s lead for the service is asked to fill it, and everyone on Also notify
            gets a heads-up. With no lead, the event&apos;s creator is asked. Any event can hand a
            team to someone else for that event only.
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
          ) : !selected ? (
            <EventsEmptyState
              icon={CalendarRange}
              title="No service types yet"
              body="Add a service type to choose who handles its teams."
            />
          ) : !isOwner ? (
            <TeamsOverview serviceTypes={serviceTypes} viewerId={settings.data.viewer.userId} />
          ) : (
            <>
              {serviceTypes.length > 1 ? (
                <ServiceTypePicker
                  serviceTypes={serviceTypes}
                  selectedId={selected.serviceTypeId}
                  onSelect={setSelectedId}
                />
              ) : null}

              {selected.teams.map((entry) => (
                <TeamSection
                  key={`${selected.serviceTypeId}:${entry.team}`}
                  entry={entry}
                  viewerId={settings.data.viewer.userId}
                  onPickLead={() => setPicking({ team: entry.team, kind: "lead" })}
                  onPickWatchers={() => setPicking({ team: entry.team, kind: "watchers" })}
                />
              ))}
            </>
          )}
        </VStack>
      </ScrollView>

      {isOwner && settings.data && selected ? (
        <PeoplePicker
          picking={picking}
          settings={settings.data}
          serviceType={selected}
          onClose={() => setPicking(null)}
          onSetLead={(team, userId) => {
            setLead(selected.serviceTypeId, team, userId);
            setPicking(null);
          }}
          onSetWatching={(team, userId, watching) =>
            setWatching(selected.serviceTypeId, team, userId, watching)
          }
        />
      ) : null}
    </VStack>
  );
}

/**
 * Staffing alerts as admins see them: every service type at once, each team's
 * lead and Also notify, with nothing to tap. Only owners change them; an
 * admin's lever is the create and edit screens, which can hand a team to
 * somebody else for that event only.
 */
function TeamsOverview({
  serviceTypes,
  viewerId,
}: {
  serviceTypes: ServiceTypeTeams[];
  viewerId: string;
}) {
  const theme = useTheme();
  const roles = useRoles();

  const nameOf = (person: TeamPerson) => (person.userId === viewerId ? "You" : fullName(person));

  return (
    <>
      {serviceTypes.map((serviceType) => (
        <VStack key={serviceType.serviceTypeId}>
          <HStack className="mb-2 ml-1 items-center gap-1.5">
            <Box
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: getServiceColors(serviceType.color, theme).base }}
            />
            <Text className="text-xs font-bold uppercase tracking-[0.7px] text-muted-foreground">
              {serviceType.name}
            </Text>
          </HStack>

          {/* Rows lead with text, so the hairlines start where it does. */}
          <InsetCard elevated separatorInset={14}>
            {serviceType.teams.map((entry) => (
              <VStack key={entry.team} className="min-h-[52px] justify-center px-3.5 py-2.5">
                <HStack className="items-center gap-3">
                  <Text className="text-base text-foreground">{roles.teamLabel(entry.team)}</Text>
                  <Text
                    className="flex-1 text-right text-[15px] text-muted-foreground"
                    numberOfLines={1}
                  >
                    {entry.lead ? nameOf(entry.lead) : "No lead · the event's creator"}
                  </Text>
                </HStack>
                {entry.watchers.length > 0 ? (
                  <Text className="mt-0.5 text-[13px] text-muted-foreground">
                    Also notify: {entry.watchers.map(nameOf).join(", ")}
                  </Text>
                ) : null}
              </VStack>
            ))}
          </InsetCard>
        </VStack>
      ))}

      <Text className="ml-1 text-[12px] text-muted-foreground">
        Only owners can change these. You can hand a team to someone else for one event when you
        create or edit it.
      </Text>
    </>
  );
}

/** One pill per service type, tinted like its events. */
function ServiceTypePicker({
  serviceTypes,
  selectedId,
  onSelect,
}: {
  serviceTypes: ServiceTypeTeams[];
  selectedId: string;
  onSelect: (serviceTypeId: string) => void;
}) {
  const theme = useTheme();

  return (
    <HStack className="flex-wrap gap-2" accessibilityRole="tablist">
      {serviceTypes.map((serviceType) => {
        const active = serviceType.serviceTypeId === selectedId;
        const colors = getServiceColors(serviceType.color, theme);

        return (
          <Pressable
            key={serviceType.serviceTypeId}
            onPress={() => onSelect(serviceType.serviceTypeId)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="rounded-full border px-3 py-1.5"
            style={{
              borderColor: active ? colors.base : theme.border,
              backgroundColor: active ? theme.card : "transparent",
            }}
          >
            <HStack className="items-center gap-1.5">
              <Box className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.base }} />
              <Text
                className="text-[13px] font-medium"
                style={{ color: active ? theme.text : theme.textMuted }}
              >
                {serviceType.name}
              </Text>
            </HStack>
          </Pressable>
        );
      })}
    </HStack>
  );
}

function TeamSection({
  entry,
  viewerId,
  onPickLead,
  onPickWatchers,
}: {
  entry: TeamSettings;
  viewerId: string;
  onPickLead: () => void;
  onPickWatchers: () => void;
}) {
  const roles = useRoles();
  const label = roles.teamLabel(entry.team);
  const youLead = entry.lead?.userId === viewerId;

  return (
    <VStack>
      <SectionLabel>{label}</SectionLabel>
      <InsetCard elevated>
        <InsetRow
          icon={UserCheck}
          label="Lead"
          value={entry.lead ? (youLead ? "You" : fullName(entry.lead)) : "No lead"}
          onPress={onPickLead}
        />
        <InsetRow
          icon={BellRing}
          label="Also notify"
          value={summarize(entry.watchers)}
          onPress={onPickWatchers}
        />
      </InsetCard>
      <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
        {roles.teamRolesLabel(entry.team)}
      </Text>
    </VStack>
  );
}

/**
 * Picks a team's lead (one person, or nobody) or its Also notify (anybody),
 * for one service type. Each tap is sent as it's made, so Done just closes.
 */
function PeoplePicker({
  picking,
  settings,
  serviceType,
  onClose,
  onSetLead,
  onSetWatching,
}: {
  picking: Picking | null;
  settings: TeamNotificationSettings;
  serviceType: ServiceTypeTeams;
  onClose: () => void;
  onSetLead: (team: Team, userId: string | null) => void;
  onSetWatching: (team: Team, userId: string, watching: boolean) => void;
}) {
  const { teamLabel } = useRoles();
  const entry = picking
    ? serviceType.teams.find((team) => team.team === picking.team)
    : undefined;
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
          ? `Asked to fill ${label}'s roles on ${serviceType.name} events when one opens up.`
          : `A heads-up whenever one of ${label}'s roles opens up on ${serviceType.name} events, saying who has it.`
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
