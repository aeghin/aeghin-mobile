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
import { VolunteerRolePicker, toggleRole } from "@/components/volunteer-role-picker";
import { brand, withAlpha } from "@/constants/branding";
import { useEventAvailability, useInviteToEvent } from "@/hooks/use-events";
import { useMembersList } from "@/hooks/use-members-list";
import { useTheme } from "@/hooks/use-theme";
import { getVolunteerRoleConfig, ROLE_ORDER } from "@/lib/config/volunteer-roles";
import { dayKey, formatDayMonth, formatTime } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type {
  EventDate,
  EventDetailsAssignment,
  NewEventDay,
  VolunteerRole,
} from "@/types/event";
import type { OrganizationMember } from "@/types/organization";

const EXPIRY_OPTIONS = [3, 5, 7] as const;

/** Past this many holders the web grows a search box; below it the list reads fine. */
const SEARCH_THRESHOLD = 5;

/** `"09:00"` — the clock face of an instant, read in UTC like every other date here. */
const clockOf = (iso: string) => new Date(iso).toISOString().slice(11, 16);

type InviteToEventDialogProps = {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** The roster — the only roles this dialog can invite into. */
  rosterRoles: VolunteerRole[];
  assignments: EventDetailsAssignment[];
  /** The hours the event runs, which is what availability is judged against. */
  dates: EventDate[];
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
 * this dialog from a role's own row, so its role is fixed, while the phone has
 * a single Invite entry on the Manage card and picks the role inside. What it
 * offers is still the roster and nothing else — widening that is what Add
 * roles is for. The check is unaffected — availability is keyed by member and
 * hours, never by role — so switching roles re-uses the same answer.
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
  assignments,
  dates,
}: InviteToEventDialogProps) {
  const theme = useTheme();
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

  // Only the roles this event asked for, in roster order. Offering the rest
  // let the phone invite into a role the event never wanted, and the invite
  // action backfills `rolesNeeded` with whatever role it is handed — so the
  // roster grew behind the manager's back. Add roles is the deliberate way to
  // widen it, which is the line the dashboard draws by construction.
  const roles = ROLE_ORDER.filter((entry) => rosterRoles.includes(entry));

  // Reachable: removing the last role leaves an event with an empty roster.
  const noRoles = roles.length === 0;

  const [role, setRole] = useState<VolunteerRole | null>(roles[0] ?? null);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<3 | 5 | 7>(3);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const conflicts = availability.data?.conflicts ?? {};
  const blockouts = availability.data?.blockouts ?? {};

  // One role per member, so anyone still live on the event cannot be invited
  // into another. A lapsed invite is not live — re-inviting is what unsticks
  // it — which is the same line the action draws server-side.
  const live = new Set(
    assignments
      .filter(
        (assignment) =>
          assignment.status === "ACCEPTED" ||
          (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now),
      )
      .map((assignment) => assignment.userId),
  );

  // Everyone who holds the role, listed whether or not they can be picked:
  // the web shows why somebody is unavailable rather than hiding them, and
  // "already on this event" is the answer to the question the manager is
  // actually asking.
  const holders = role
    ? (members.data ?? []).filter((member) => member.volunteerRoles.includes(role))
    : [];

  const invitableCount = holders.filter((member) => !live.has(member.id)).length;

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

    const name = `${member.firstName} ${member.lastName}`.trim();

    Alert.alert(
      "Scheduling Conflict",
      `${name} is already assigned to ${conflict.eventName} from ${formatTime(conflict.startTime)} – ${formatTime(conflict.endTime)} on this day. Assigning them may cause a time overlap.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Select Anyway", onPress: () => select(member.id) },
      ],
    );
  };

  const submit = () => {
    if (!role) return;
    setError(null);
    invite.mutate(
      { role, userIds, expiresAt },
      {
        onSuccess: ({ invitedCount, skippedNames }) => {
          onClose();
          const skipped =
            skippedNames.length > 0 ? ` ${skippedNames.join(", ")} already on this event.` : "";
          Alert.alert(
            "Invitations sent",
            `Invited ${invitedCount} ${invitedCount === 1 ? "member" : "members"}.${skipped}`,
          );
        },
        onError: (failure) => setError(failureMessage(failure)),
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={UserPlus}
      title="Invite volunteers"
      description={
        role
          ? `${userIds.length} selected · ${invitableCount} available`
          : noRoles
            ? "This event has no roles on its roster yet."
            : "Pick a role, then the members who hold it."
      }
      action={{ label: "Invite", onPress: submit, disabled: !role || userIds.length === 0 }}
      submitting={invite.isPending}
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
        hint={noRoles ? "Add a role from the Manage card, then invite into it." : undefined}
      >
        <VolunteerRolePicker
          roles={roles}
          selected={role ? [role] : []}
          single
          onToggle={(next) => {
            setRole(toggleRole(role ? [role] : [], next, true)[0] ?? null);
            setUserIds([]);
            setSearch("");
          }}
        />
      </Field>

      <Field label={role ? `Members who can play ${getVolunteerRoleConfig(role).label}` : "Members"}>
        <VStack className="gap-2">
          {holders.length > SEARCH_THRESHOLD ? (
            <HStack
              className="items-center gap-2 rounded-xl border px-3"
              style={{ backgroundColor: theme.surface, borderColor: theme.border }}
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
                    onEvent={live.has(member.id)}
                    blockout={blockouts[member.id]}
                    conflict={conflicts[member.id]}
                    onPress={() => toggleMember(member)}
                  />
                </VStack>
              ))}
            </FormCard>
          ) : (
            <Text className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
              {noRoles
                ? "Add a role to this event first"
                : !role
                  ? "Pick a role to see who can fill it"
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
  /** Still live on this event, so not invitable into a second role. */
  onEvent: boolean;
  blockout?: { startDate: string; endDate: string };
  conflict?: { eventName: string; startTime: string; endTime: string };
  onPress: () => void;
};

/**
 * One candidate, and why they can or cannot be picked.
 *
 * The three states are the dashboard's, in its order of severity: already on
 * the event, blocked out, or merely double-booked. Only the last is selectable.
 */
function MemberRow({ member, selected, onEvent, blockout, conflict, onPress }: MemberRowProps) {
  const theme = useTheme();

  const blocked = onEvent || Boolean(blockout);
  const name = `${member.firstName} ${member.lastName}`.trim();

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: blocked }}
      className="data-[active=true]:bg-border/40"
      style={{
        opacity: blocked ? 0.55 : 1,
        backgroundColor:
          !blocked && conflict && !selected ? withAlpha(theme.warning, 0.08) : "transparent",
      }}
    >
      <HStack className="items-center gap-3 px-3 py-2.5">
        <OrgAvatar name={name} logoUrl={member.imageUrl} size={34} shape="circle" />

        <VStack className="flex-1">
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {name}
          </Text>

          {onEvent ? (
            <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
              Already on this event
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
