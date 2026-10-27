import CalendarOff from "lucide-react-native/icons/calendar-off";
import Check from "lucide-react-native/icons/check";
import Search from "lucide-react-native/icons/search";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserPlus from "lucide-react-native/icons/user-plus";
import { useState } from "react";
import { Alert, TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Choice, ErrorBanner, Field, FormCard } from "@/components/form-fields";
import { OrgAvatar } from "@/components/org-avatar";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { VolunteerRolePicker } from "@/components/volunteer-role-picker";
import { withAlpha } from "@/constants/branding";
import { useEventAvailability, useInviteToEvent } from "@/hooks/use-events";
import { useMembersList } from "@/hooks/use-members-list";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import type { ServiceColors } from "@/lib/config/service-types";
import { dayKey, formatDayMonth, formatTime } from "@/lib/events/format";
import { roleStanding } from "@/lib/events/spots";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type {
  EventDate,
  EventDetailsAssignment,
  EventTeamLead,
  NewEventDay,
  RoleSpots,
  VolunteerRole,
} from "@/types/event";
import type { OrganizationMember } from "@/types/organization";
import type { Team } from "@/types/team-notifications";

const EXPIRY_OPTIONS = [3, 5, 7] as const;

/** Past this many holders the web grows a search box; below it the list reads fine. */
const SEARCH_THRESHOLD = 5;

/** The web's `opacity-70` on a member who can't be picked. */
const UNAVAILABLE_OPACITY = 0.7;

const DAY = 86_400_000;

/** Somebody's live place on the event: a real row, or one this dialog just sent. */
type Place = Pick<EventDetailsAssignment, "userId" | "role" | "status" | "expiresAt">;

/** `"09:00"` — the clock face of an instant, read in UTC like every other date here. */
const clockOf = (iso: string) => new Date(iso).toISOString().slice(11, 16);

type InviteToEventDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** The roster — the only roles this dialog can invite into. */
  rosterRoles: VolunteerRole[];
  /** How many each role needs, for the open spots the dialog names. */
  roleSpots?: RoleSpots;
  assignments: EventDetailsAssignment[];
  /** The hours the event runs, which is what availability is judged against. */
  dates: EventDate[];
  /** The signed-in manager, who isn't told that they lead their own team. */
  viewerId: string;
  /**
   * Who handles each team on this event — its lead, or whoever covers it for
   * this event only — named over the member list so nobody staffs it twice.
   */
  teamLeads: Partial<Record<Team, EventTeamLead>>;
  /** The event's service colours, which its pickers are selected in, as the web's are. */
  colors: ServiceColors;
};

/**
 * The web's Invite to Event dialog: pick a role, pick the members who hold
 * it, pick how long they have to answer.
 *
 * Availability is checked the moment it opens, exactly as the dashboard does,
 * and the answer is read the same two ways. A **blockout** is a hard block —
 * the row is greyed and there is no override, because the server refuses the
 * whole batch over one of them. A **conflict** is the manager's call, so it is
 * put to them rather than decided for them.
 *
 * The one shape that differs from the web is the role: the dashboard opens
 * this from each role's own row, while the phone has one Invite pill on the
 * Team card and picks the role inside, so a lead staffing several roles never
 * scrolls the roster looking for them. It stays open after a send for the
 * same reason. Availability is keyed by member and hours, never by role, so
 * switching roles re-uses the same answer.
 */
export function InviteToEventDialog(props: InviteToEventDialogProps) {
  return <InviteToEventBody key={String(props.visible)} {...props} />;
}

function InviteToEventBody({
  visible,
  onClose,
  organizationId,
  eventId,
  rosterRoles,
  roleSpots,
  assignments,
  dates,
  viewerId,
  teamLeads,
  colors,
}: InviteToEventDialogProps) {
  const theme = useTheme();
  const catalog = useRoles();
  const members = useMembersList(organizationId);
  const invite = useInviteToEvent(organizationId, eventId);

  // The event's own hours, in the spelling the availability route takes.
  const days: NewEventDay[] = dates.map((date) => ({
    date: dayKey(date.startTime),
    startTime: clockOf(date.startTime),
    endTime: clockOf(date.endTime),
  }));

  // The same predicate the hook gates on. A disabled query reports as
  // `pending` forever, so reading `isPending` alone would leave an event with
  // no dates under a spinner that never resolves and never errors.
  const canCheck = visible && Boolean(organizationId && eventId) && days.length > 0;

  const availability = useEventAvailability(organizationId, eventId, days, canCheck);
  const checking = canCheck && availability.isPending;

  // Only the roles this event asked for: the invite action backfills
  // `rolesNeeded` with whatever role it is handed, so offering the rest would
  // grow the roster behind the manager's back. Edit roles is how it widens.
  const roles = catalog.inOrder(rosterRoles);

  const [now] = useState(() => Date.now());
  // Whoever opens this is most likely leading a team, so it starts on their
  // first open spot, then anyone's, then the first role.
  const [role, setRole] = useState<VolunteerRole | null>(() => {
    const isOpen = (entry: VolunteerRole) =>
      roleStanding(entry, roleSpots, assignments, now).open > 0;
    const isMine = (entry: VolunteerRole) =>
      teamLeads[catalog.teamOf(entry)]?.userId === viewerId;

    return (
      roles.find((entry) => isMine(entry) && isOpen(entry)) ??
      roles.find(isOpen) ??
      roles[0] ??
      null
    );
  });
  const [userIds, setUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<3 | 5 | 7>(3);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Who this dialog has invited: they stand in for their rows until the
  // event's refetch brings them back, and read as just invited until Done.
  const [sent, setSent] = useState<Place[]>([]);

  const conflicts = availability.data?.conflicts ?? {};
  const blockouts = availability.data?.blockouts ?? {};

  // One role per member, so anyone still live on the event cannot be invited
  // into another; their row says which role they hold. A lapsed invite is not
  // live — re-inviting is what unsticks it — which is the same line the action
  // draws server-side.
  const live = new Map<string, Place>(
    assignments
      .filter(
        (assignment) =>
          assignment.status === "ACCEPTED" ||
          (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now),
      )
      .map((assignment) => [assignment.userId, assignment]),
  );

  const standIns = sent.filter((place) => !live.has(place.userId));
  for (const place of standIns) live.set(place.userId, place);

  const justInvited = new Set(
    sent.filter((place) => place.role === role).map((place) => place.userId),
  );

  // Who can be picked, then who can with a warning, then who can't. Neither
  // ticking nor sending moves a row: somebody just invited keeps the place
  // they were ticked in.
  const rank = (member: OrganizationMember) =>
    justInvited.has(member.id)
      ? conflicts[member.id]
        ? 1
        : 0
      : live.has(member.id) || blockouts[member.id]
        ? 2
        : conflicts[member.id]
          ? 1
          : 0;

  // Everyone who holds the role, listed whether or not they can be picked:
  // the web shows why somebody is unavailable rather than hiding them.
  const holders = role
    ? (members.data ?? [])
        .filter((member) => member.volunteerRoles.includes(role))
        .sort((a, b) => rank(a) - rank(b))
    : [];

  // Who can still be ticked: a blockout has no override, so it isn't available.
  const invitableCount = holders.filter(
    (member) => !live.has(member.id) && !blockouts[member.id],
  ).length;

  // Every invite is somebody wanted there, so one past the role's open spots
  // simply adds a spot on the server.
  const standing = role
    ? roleStanding(role, roleSpots, [...assignments, ...standIns], now)
    : null;

  const team = role ? catalog.teamOf(role) : null;
  const lead = team ? teamLeads[team] : undefined;
  const leadLine =
    team && lead && lead.userId !== viewerId
      ? lead.cover
        ? `${lead.firstName} ${lead.lastName} is covering ${catalog.teamLabel(team)} for this event and is asked to fill its roles.`
        : `${lead.firstName} ${lead.lastName} leads ${catalog.teamLabel(team)} and is asked to fill its roles.`
      : undefined;

  const query = search.trim().toLowerCase();

  const filtered = query
    ? holders.filter(
        (member) =>
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query),
      )
    : holders;

  const select = (id: string) => setUserIds((current) => [...current, id]);

  const toggleMember = (member: OrganizationMember) => {
    if (userIds.includes(member.id)) {
      setUserIds((current) => current.filter((entry) => entry !== member.id));
      return;
    }

    // A blockout is never assignable and carries no override, matching both
    // the dashboard's disabled checkbox and the action's outright refusal.
    if (live.has(member.id) || blockouts[member.id]) return;

    const conflict = conflicts[member.id];

    if (!conflict) {
      select(member.id);
      return;
    }

    const name = personName(member);

    Alert.alert(
      "Scheduling Conflict",
      `${name} is already assigned to ${conflict.eventName} from ${formatTime(conflict.startTime)} – ${formatTime(conflict.endTime)} on this day. Assigning them may cause a time overlap.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Select Anyway", onPress: () => select(member.id) },
      ],
    );
  };

  const pickRole = (next: VolunteerRole) => {
    if (next === role) return;
    setRole(next);
    setUserIds([]);
    setSearch("");
  };

  const send = () => {
    if (!role) return;
    setError(null);
    invite.mutate(
      { role, userIds, expiresAt },
      {
        onSuccess: ({ skippedNames }) => {
          // Already on the event by the time it landed — another manager got
          // there first. Once the refetch lands, their row names the role they hold.
          const skipped = new Set(skippedNames);
          const invited = userIds.filter((userId) => {
            const member = holders.find((entry) => entry.id === userId);
            return !member || !skipped.has(`${member.firstName} ${member.lastName}`);
          });

          if (skippedNames.length > 0) {
            Alert.alert("Already on this event", skippedNames.join(", "));
          }

          setSent((current) => [
            ...current,
            ...invited.map((userId) => ({
              userId,
              role,
              status: "PENDING" as const,
              expiresAt: new Date(now + expiresAt * DAY).toISOString(),
            })),
          ]);
          setUserIds([]);
        },
        onError: (failure) => setError(failureMessage(failure)),
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={UserPlus}
      accent={colors.base}
      title="Invite volunteers"
      description={
        role && standing
          ? `${userIds.length} selected · ${invitableCount} available · ${
              standing.open === 1 ? "1 open spot" : `${standing.open} open spots`
            }`
          : "This event has no roles on its roster yet."
      }
      action={{ label: "Invite", onPress: send, disabled: !role || userIds.length === 0 }}
      submitting={invite.isPending}
      // Ticks beside "Done" would read as sending them.
      cancelLabel={
        sent.length > 0 && userIds.length === 0 ? `Done · ${sent.length} invited` : "Cancel"
      }
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      {/* The dashboard toasts this and carries on. A failed check is not a
          reason to block the invite: the server still refuses a blockout, so
          only the forewarning is lost — but the manager has to be told that. */}
      {availability.isError ? (
        <Box
          className="rounded-xl px-3 py-2.5"
          style={{ backgroundColor: withAlpha(theme.warning, 0.12) }}
        >
          <HStack className="items-center gap-2">
            <AppIcon icon={TriangleAlert} size={15} color={theme.warning} />
            <Text className="flex-1 text-[13px]" style={{ color: theme.warning }}>
              Couldn&apos;t check availability
            </Text>
          </HStack>
        </Box>
      ) : null}

      <Field
        label="Role"
        hint={roles.length === 0 ? "Add a role with Edit roles, then invite into it." : undefined}
      >
        <VolunteerRolePicker
          roles={roles}
          selected={role ? [role] : []}
          single
          solid={colors.base}
          onToggle={pickRole}
        />
      </Field>

      <Field label={role ? `Members who can play ${catalog.get(role).label}` : "Members"}>
        <VStack className="gap-2">
          {leadLine ? (
            <Text className="ml-1 text-[12px] text-muted-foreground">{leadLine}</Text>
          ) : null}

          {holders.length > SEARCH_THRESHOLD ? (
            <HStack
              className="items-center gap-2 rounded-xl border px-3"
              style={{ backgroundColor: theme.card, borderColor: theme.border }}
            >
              <AppIcon icon={Search} size={16} color={theme.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or email..."
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: theme.text }}
              />
            </HStack>
          ) : null}

          {members.isPending || checking ? (
            <HStack className="items-center justify-center gap-2 py-6">
              <Spinner size="small" color={theme.textMuted} />
              <Text className="text-[13px] text-muted-foreground">Checking availability...</Text>
            </HStack>
          ) : filtered.length > 0 ? (
            <FormCard>
              {filtered.map((member, index) => (
                <VStack key={member.id}>
                  {index > 0 ? <Divider style={{ marginLeft: 58 }} /> : null}
                  <MemberRow
                    member={member}
                    selected={userIds.includes(member.id)}
                    justInvited={justInvited.has(member.id)}
                    onEvent={live.get(member.id)}
                    blockout={blockouts[member.id]}
                    conflict={conflicts[member.id]}
                    accent={colors.base}
                    onPress={() => toggleMember(member)}
                  />
                </VStack>
              ))}
            </FormCard>
          ) : (
            <Text className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
              {!role
                ? "Add a role to this event first"
                : holders.length === 0
                  ? "No members hold this role yet"
                  : "No members match your search"}
            </Text>
          )}
        </VStack>
      </Field>

      <Field label="Time to respond">
        <HStack className="gap-1.5">
          {EXPIRY_OPTIONS.map((days) => (
            <Choice
              key={days}
              label={`${days} days`}
              selected={expiresAt === days}
              solid={colors.base}
              onPress={() => setExpiresAt(days)}
            />
          ))}
        </HStack>
      </Field>
    </Dialog>
  );
}

type MemberRowProps = {
  member: OrganizationMember;
  selected: boolean;
  /** Sent from this dialog into the role on show. */
  justInvited: boolean;
  /** Their live place on this event, so not invitable into a second role. */
  onEvent?: Place;
  blockout?: { startDate: string; endDate: string };
  conflict?: { eventName: string; startTime: string; endTime: string };
  /** The event's service colour, which a picked member's tick is drawn in. */
  accent: string;
  onPress: () => void;
};

/**
 * One candidate, and why they can or cannot be picked.
 *
 * The three states are the dashboard's, in its order of severity: already on
 * the event, blocked out, or merely double-booked. Only the last is selectable,
 * so the first two are greyed out and the last keeps its amber.
 */
function MemberRow({
  member,
  selected,
  justInvited,
  onEvent,
  blockout,
  conflict,
  accent,
  onPress,
}: MemberRowProps) {
  const theme = useTheme();
  const catalog = useRoles();

  // Somebody just sent reads as that, not as greyed-out "already on the event".
  const blocked = !justInvited && Boolean(onEvent || blockout);
  const name = personName(member);
  const tick = justInvited ? theme.success : selected ? accent : null;

  const content = (
    <HStack className="items-center gap-3 px-3 py-2.5">
      <OrgAvatar name={name} logoUrl={member.imageUrl} size={34} shape="circle" />

      <VStack className="flex-1">
        <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
          {name}
        </Text>

        {justInvited ? (
          <HStack className="items-center gap-1">
            <AppIcon icon={Check} size={11} color={theme.success} />
            <Text
              className="flex-1 text-[12px] font-medium"
              style={{ color: theme.success }}
              numberOfLines={1}
            >
              Invited just now
            </Text>
          </HStack>
        ) : onEvent ? (
          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {`${catalog.get(onEvent.role).label} · ${
              onEvent.status === "ACCEPTED" ? "confirmed" : "invited"
            }`}
          </Text>
        ) : blockout ? (
          <HStack className="items-center gap-1">
            <AppIcon icon={CalendarOff} size={11} color={theme.destructive} />
            <Text
              className="flex-1 text-[12px]"
              style={{ color: theme.destructive }}
              numberOfLines={1}
            >
              {`Blocked out · ${formatDayMonth(blockout.startDate)}${
                blockout.endDate !== blockout.startDate
                  ? ` – ${formatDayMonth(blockout.endDate)}`
                  : ""
              }`}
            </Text>
          </HStack>
        ) : conflict ? (
          <HStack className="items-center gap-1">
            <AppIcon icon={TriangleAlert} size={11} color={theme.warning} />
            <Text
              className="flex-1 text-[12px]"
              style={{ color: theme.warning }}
              numberOfLines={1}
            >
              {`${conflict.eventName} · ${formatTime(conflict.startTime)} - ${formatTime(conflict.endTime)}`}
            </Text>
          </HStack>
        ) : (
          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {member.email}
          </Text>
        )}
      </VStack>

      <Box
        className="h-5 w-5 items-center justify-center rounded-full border"
        style={{
          borderColor: tick ?? theme.border,
          backgroundColor: tick ?? "transparent",
        }}
      >
        {tick ? <AppIcon icon={Check} size={12} color="#FFFFFF" /> : null}
      </Box>
    </HStack>
  );

  // Done with, but not unavailable: a disabled Pressable would dim it.
  if (justInvited) {
    return (
      <Box
        accessible
        accessibilityLabel={`${name}, invited just now`}
        style={{ backgroundColor: withAlpha(theme.success, 0.08) }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: blocked }}
      // Pressable's own disabled dim is 40%, too faint to read who is busy.
      className="data-[active=true]:bg-border/40 data-[disabled=true]:opacity-70"
      style={{
        opacity: blocked ? UNAVAILABLE_OPACITY : 1,
        backgroundColor: blocked
          ? withAlpha(theme.surface, 0.4)
          : conflict && !selected
            ? withAlpha(theme.warning, 0.08)
            : "transparent",
      }}
    >
      {content}
    </Pressable>
  );
}
