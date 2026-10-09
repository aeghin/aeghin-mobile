import ChevronDown from "lucide-react-native/icons/chevron-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Mail from "lucide-react-native/icons/mail";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Trash2 from "lucide-react-native/icons/trash-2";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import Zap from "lucide-react-native/icons/zap";
import { useState } from "react";
import { Alert } from "react-native";

import { ActionMenu } from "@/components/action-menu";
import { AppIcon } from "@/components/app-icon";
import { AddRolesDialog } from "@/components/events/add-roles-dialog";
import { EmailTeamDialog } from "@/components/events/email-team-dialog";
import {
  DetailButton,
  DetailCard,
  DetailCardHeader,
  DetailCount,
} from "@/components/events/event-detail-parts";
import { InviteToEventDialog } from "@/components/events/invite-to-event-dialog";
import { OrgAvatar } from "@/components/org-avatar";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha, type Palette } from "@/constants/branding";
import { useSmartSchedulingAvailable } from "@/hooks/use-billing";
import { useSetSmartScheduling } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import {
  getStatusConfig,
  isInactiveStatus,
  ROW_BORDER_ALPHA,
  ROW_FILL_ALPHA,
} from "@/lib/config/status";
import { failureMessage } from "@/lib/failure";
import { personName } from "@/lib/names";
import type {
  EventDetails,
  EventDetailsAssignment,
  VolunteerRole,
} from "@/types/event";
import type { Team } from "@/types/team-notifications";

const AVATAR = 32;

/** Half a line less the gap, so the four roster actions sit two by two. */
const HALF = { flexBasis: "48%", flexGrow: 1 } as const;

/**
 * The one section that opens by itself.
 *
 * The web accordion defaults to the band and the phone follows: every
 * section open is a screen of scrolling before the setlist, and the band is
 * the group whose gaps are noticed first.
 */
const DEFAULT_OPEN: Team[] = ["BAND"];

type RoleGroup = {
  role: VolunteerRole;
  items: EventDetailsAssignment[];
};

type Category = {
  key: Team;
  label: string;
  groups: RoleGroup[];
  /** Roles here that are filled — see {@link isFilled}. */
  filled: number;
  /** At least one role here has stalled — see {@link hasStalled}. */
  stalled: boolean;
};

/**
 * A role that has stopped moving on its own.
 *
 * Somebody was invited, it fell through — declined, removed, or the deadline
 * passed with no answer — and there is nobody accepted and nothing in flight
 * to replace them. That is the state a manager has to *do* something about,
 * and it is the only thing the warning glyph marks.
 *
 * Deliberately not "short of people": on a fresh event every category is
 * short, so a glyph on each is decoration rather than a signal, and the count
 * beside it already says `0/4`. What the count cannot say is whether nothing
 * has happened yet or something went wrong.
 */
const hasStalled = (groups: RoleGroup[], now: number) =>
  groups.some(
    (group) =>
      group.items.length > 0 && !group.items.some((item) => isLive(item, now)),
  );

/**
 * Somebody accepted and nobody on the role is still deciding.
 *
 * The same test as the staffing meter on the events list and the "fully
 * staffed" notification, so the count here agrees with the card that led
 * here: one BGV in and three yet to answer is not a filled role.
 */
const isFilled = (group: RoleGroup, now: number) =>
  group.items.some((item) => item.status === "ACCEPTED") &&
  !group.items.some((item) => item.status === "PENDING" && isLive(item, now));

type EventTeamCardProps = {
  organizationId: string;
  event: EventDetails;
  /** Managers only: take somebody off the event. Live rows become tappable. */
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  /** Managers only: take an empty role off the roster. */
  onRemoveRole?: (role: VolunteerRole) => void;
  /** Managers only: reopen a lapsed invitation. */
  onResendInvite?: (assignment: EventDetailsAssignment) => void;
  /** Managers only: clear a lapsed invitation off the roster. */
  onDeleteExpired?: (assignment: EventDetailsAssignment) => void;
};

/**
 * Who is on the event, what they answered, and — for a manager — every way to
 * change it.
 *
 * This is where the roster is *worked on*, not merely read: every action that
 * changes it — invite, add roles, email, auto-fill — sits under the title
 * rather than at the bottom of the page.
 *
 * Declined and canceled people stay on the list rather than disappearing —
 * struck through, as the web shows them. A role that lost somebody is a fact
 * about the event, and a roster that silently shortens hides it.
 */
export function EventTeamCard({
  organizationId,
  event,
  onRemoveAssignment,
  onRemoveRole,
  onResendInvite,
  onDeleteExpired,
}: EventTeamCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(event.serviceType.color, theme);
  const roles = useRoles();
  const [open, setOpen] = useState<Team[]>(DEFAULT_OPEN);
  // Read once per mount: "has this invitation lapsed" must not flip mid-render.
  const [now] = useState(() => Date.now());

  const [dialog, setDialog] = useState<"invite" | "roles" | "email" | null>(null);

  const smart = useSetSmartScheduling(organizationId, event.id);
  const autoFillAvailable = useSmartSchedulingAvailable(organizationId);

  const { assignments, viewer } = event;
  const canManage = viewer.canManage;

  // An event switched on before the organization was on Free keeps its
  // setting, but nothing is filled, so the chip reads as off.
  const autoFillOn = event.smartSchedulingEnabled && autoFillAvailable;

  const acceptedCount = assignments.filter(
    (assignment) => assignment.status === "ACCEPTED",
  ).length;

  // A role belongs on the roster if the event declared it or somebody is on
  // it. The union keeps events created before `rolesNeeded` was persisted
  // intact — the same reason the web takes it.
  const rosterRoles = roles.inOrder([
    ...event.rolesNeeded,
    ...assignments.map((assignment) => assignment.role),
  ]);

  const categories: Category[] = roles.teamsOf(rosterRoles).map((key) => {
    const groups = rosterRoles
      .filter((role) => roles.teamOf(role) === key)
      .map((role) => ({
        role,
        items: assignments.filter((assignment) => assignment.role === role),
      }));

    return {
      key,
      label: roles.teamLabel(key),
      groups,
      filled: groups.filter((group) => isFilled(group, now)).length,
      stalled: hasStalled(groups, now),
    };
  }).filter((category) => category.groups.length > 0);

  const roleCount = categories.reduce((count, category) => count + category.groups.length, 0);
  const filledCount = categories.reduce((count, category) => count + category.filled, 0);

  // The count without the events list's meter: managers saw the pills before
  // they tapped in, and past a dozen roles they stop lining up with anything
  // here. Each team below says which roles are open.
  const fillRate =
    roleCount > 0 ? (
      <HStack
        className="items-baseline gap-1.5"
        accessible
        accessibilityLabel={`${filledCount} of ${roleCount} ${roleCount === 1 ? "role" : "roles"} filled`}
      >
        {/* The title's size and line, so the count reads as part of the
            header rather than a second headline beside it. */}
        <Text
          className="text-[15px] font-bold leading-[20px] text-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {filledCount}
          <Text className="text-muted-foreground">{`/${roleCount}`}</Text>
        </Text>
        <Text className="text-[13px] text-muted-foreground">
          {roleCount === 1 ? "role filled" : "roles filled"}
        </Text>
      </HStack>
    ) : undefined;

  const toggle = (key: Team) =>
    setOpen((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const toggleSmart = (enabled: boolean) => {
    if (!autoFillAvailable) {
      Alert.alert("Auto-fill", "Smart Scheduling isn't included in this organization's plan.");
      return;
    }

    smart.mutate(enabled, {
      onError: (error) => Alert.alert("Couldn't update", failureMessage(error)),
    });
  };

  return (
    <>
      <DetailCard>
        <DetailCardHeader icon={Users} title="Team" tint={colors} trailing={fillRate} />

        {/* The dashboard's roster-wide actions, under the title exactly as its
            narrow column puts them. */}
        {canManage ? (
          <HStack className="flex-wrap gap-2 px-4 pb-4">
            <DetailButton
              icon={UserPlus}
              label="Invite"
              service={colors}
              primary
              onPress={() => setDialog("invite")}
              style={HALF}
            />
            <DetailButton
              icon={Zap}
              label="Auto-fill"
              service={colors}
              checked={autoFillOn}
              on={autoFillOn}
              busy={smart.isPending}
              onPress={() => toggleSmart(!event.smartSchedulingEnabled)}
              style={HALF}
            />
            <DetailButton
              icon={Plus}
              label="Add roles"
              service={colors}
              onPress={() => setDialog("roles")}
              style={HALF}
            />
            {/* The dashboard hides this until somebody has accepted. Here it
                stays: four buttons are a fixed block, and one going missing
                reads as a fault rather than as "there is nobody to email yet"
                — which the dialog says in words, and refuses to send on. */}
            <DetailButton
              icon={Mail}
              label="Email"
              service={colors}
              onPress={() => setDialog("email")}
              style={HALF}
            />
          </HStack>
        ) : null}

        {categories.length === 0 ? (
          <Text className="border-t border-border px-4 pb-4 pt-3 text-[13px] text-muted-foreground">
            {canManage
              ? "No roles on this event yet. Add roles to start building the team."
              : "No roles on this event yet."}
          </Text>
        ) : (
          <VStack className="pb-1">
            {categories.map((category) => (
              <VStack key={category.key}>
                {/* Under the card header as well as between sections, so the
                    first category reads as a row rather than as the title. */}
                <Divider />

                <Pressable
                  onPress={() => toggle(category.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open.includes(category.key) }}
                  accessibilityLabel={`${category.label}, ${category.filled} of ${category.groups.length} filled${
                    category.stalled ? ", needs attention" : ""
                  }`}
                  className="data-[active=true]:bg-border/40"
                >
                  <HStack className="items-center gap-2 px-4 py-3">
                    <Text className="flex-1 text-[14px] font-bold text-foreground">
                      {category.label}
                    </Text>

                    {category.stalled ? (
                      <AppIcon icon={CircleAlert} size={13} color={theme.warning} />
                    ) : null}

                    <DetailCount>
                      {`${category.filled}/${category.groups.length}`}
                    </DetailCount>

                    <Chevron expanded={open.includes(category.key)} />
                  </HStack>
                </Pressable>

                {open.includes(category.key) ? (
                  <VStack className="gap-4 px-4 pb-4 pt-0.5">
                    {category.groups.map((group) => (
                      <RoleGroupBlock
                        key={group.role}
                        group={group}
                        currentUserId={viewer.userId}
                        onRemoveAssignment={onRemoveAssignment}
                        onRemoveRole={onRemoveRole}
                        onResendInvite={onResendInvite}
                        onDeleteExpired={onDeleteExpired}
                        now={now}
                      />
                    ))}
                  </VStack>
                ) : null}
              </VStack>
            ))}
          </VStack>
        )}
      </DetailCard>

      {/* Managers only, and not merely for the gate: `InviteToEventBody` reads
          the org roster on mount, not on open, so mounting these for everyone
          bought every member a members fetch they can never use. They used to
          hang off the Manage card, which was already behind `canManage`. */}
      {canManage ? (
        <>
          <InviteToEventDialog
            visible={dialog === "invite"}
            onClose={() => setDialog(null)}
            organizationId={organizationId}
            eventId={event.id}
            rosterRoles={rosterRoles}
            assignments={assignments}
            dates={event.dates}
            viewerId={viewer.userId}
            teamLeads={event.teamLeads ?? {}}
          />
          <AddRolesDialog
            visible={dialog === "roles"}
            onClose={() => setDialog(null)}
            organizationId={organizationId}
            eventId={event.id}
            existing={rosterRoles}
          />
          <EmailTeamDialog
            visible={dialog === "email"}
            onClose={() => setDialog(null)}
            organizationId={organizationId}
            eventId={event.id}
            acceptedCount={acceptedCount}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * The status pill's words, darker than its dot so they read on the tint — the
 * Volunteers design's `bg-emerald-50 text-emerald-700`, and the -400 stop on a
 * dark card. Tailwind v4 values, like the dots in `status.ts`.
 */
const PILL_TEXT = {
  light: { ACCEPTED: "#007A55", PENDING: "#BB4D00", EXPIRED: "#45556C", OTHER: "#C10007" },
  dark: { ACCEPTED: "#00D492", PENDING: "#FFB900", EXPIRED: "#90A1B9", OTHER: "#FF6467" },
} as const;

function pillText(status: EventDetailsAssignment["status"] | "EXPIRED", theme: Palette) {
  const shades = PILL_TEXT[theme.scheme];
  return status === "ACCEPTED" || status === "PENDING" || status === "EXPIRED"
    ? shades[status]
    : shades.OTHER;
}

/** Points down when the section is open, right when it is closed. */
function Chevron({ expanded }: { expanded: boolean }) {
  const theme = useTheme();

  return (
    <Box style={{ transform: [{ rotate: expanded ? "0deg" : "-90deg" }] }}>
      <AppIcon icon={ChevronDown} size={14} color={theme.textMuted} />
    </Box>
  );
}

/**
 * Sent, never answered, and now unanswerable.
 *
 * Reads the deadline as well as the status: the API's hourly sweep is what
 * writes EXPIRED, so for up to an hour after a lapse the row is still PENDING.
 * Paired with {@link isLive} — an assignment is unique per event and member, so
 * between them a pending invitation lands in exactly one bucket.
 */
function isLapsed(assignment: EventDetailsAssignment, now: number): boolean {
  return (
    assignment.status === "EXPIRED" ||
    (assignment.status === "PENDING" &&
      new Date(assignment.expiresAt).getTime() <= now)
  );
}

/** Accepted, or pending and not yet lapsed — somebody the role still counts on. */
function isLive(assignment: EventDetailsAssignment, now: number): boolean {
  return (
    assignment.status === "ACCEPTED" ||
    (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now)
  );
}

function RoleGroupBlock({
  group,
  currentUserId,
  onRemoveAssignment,
  onRemoveRole,
  onResendInvite,
  onDeleteExpired,
  now,
}: {
  group: RoleGroup;
  currentUserId: string;
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  onRemoveRole?: (role: VolunteerRole) => void;
  onResendInvite?: (assignment: EventDetailsAssignment) => void;
  onDeleteExpired?: (assignment: EventDetailsAssignment) => void;
  now: number;
}) {
  const theme = useTheme();
  const { label, emoji } = useRoles().get(group.role);

  // The server only lets a role go when nobody is live on it; offer it then.
  const removable = onRemoveRole && !group.items.some((item) => isLive(item, now));

  return (
    <VStack className="gap-2">
      <HStack className="items-center gap-1.5">
        {/* Emoji ignore `color` and clip against a tight line box, so this one
            carries its own metrics rather than inheriting the label's. */}
        <Text style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Text>

        <Text className="text-[11px] font-bold uppercase tracking-[0.7px] text-muted-foreground">
          {label}
        </Text>

        <Text
          className="text-[11px] text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {`· ${group.items.length}`}
        </Text>

        {removable ? (
          <Pressable
            onPress={() => onRemoveRole(group.role)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label} from this event`}
            hitSlop={6}
            className="ml-auto"
          >
            <Text className="text-[11px] font-semibold" style={{ color: theme.destructive }}>
              Remove role
            </Text>
          </Pressable>
        ) : null}
      </HStack>

      {group.items.length === 0 ? (
        <Text className="px-1 text-[13px] text-muted-foreground">
          No one assigned yet
        </Text>
      ) : (
        <VStack className="gap-1.5">
          {group.items.map((assignment) => {
            const lapsed = isLapsed(assignment, now);

            return (
              <AssignmentRow
                key={assignment.id}
                assignment={assignment}
                isCurrentUser={assignment.userId === currentUserId}
                expired={lapsed}
                onPress={
                  onRemoveAssignment && isLive(assignment, now)
                    ? () => onRemoveAssignment(assignment)
                    : undefined
                }
                onResend={
                  onResendInvite && lapsed
                    ? () => onResendInvite(assignment)
                    : undefined
                }
                onDelete={
                  onDeleteExpired && lapsed
                    ? () => onDeleteExpired(assignment)
                    : undefined
                }
              />
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}

function AssignmentRow({
  assignment,
  isCurrentUser,
  expired,
  onPress,
  onResend,
  onDelete,
}: {
  assignment: EventDetailsAssignment;
  isCurrentUser: boolean;
  /** Reads the deadline as well as the status — see {@link isLapsed}. */
  expired: boolean;
  /** Managers only: the row opens the remove-from-event confirmation. */
  onPress?: () => void;
  onResend?: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();

  // A lapsed invitation shows EXPIRED even while the sweep still has it PENDING.
  const status = getStatusConfig(expired ? "EXPIRED" : assignment.status);
  const inactive = expired || isInactiveStatus(assignment.status);

  const menu = expired && onResend && onDelete;

  const fullName = personName(assignment.user);

  const row = (
    <HStack
      className="items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{
        borderCurve: "continuous",
        ...(isCurrentUser
          ? {
              borderColor: withAlpha(status.color, ROW_BORDER_ALPHA),
              backgroundColor: withAlpha(status.color, ROW_FILL_ALPHA),
            }
          : { borderColor: theme.border, backgroundColor: theme.card }),
      }}
    >
      <Box className="shrink-0" style={{ opacity: inactive ? 0.6 : 1 }}>
        {/* The web's `ring-2 ring-offset-2`: a hoop in the status colour with
            the page showing through the gap. */}
        <Center
          className="rounded-full border-2"
          style={{
            borderColor: withAlpha(status.color, status.ringAlpha),
            padding: 2,
            backgroundColor: theme.card,
          }}
        >
          <OrgAvatar
            name={fullName || "?"}
            logoUrl={assignment.user.userImageUrl}
            size={AVATAR}
            shape="circle"
          />
        </Center>

        <Center
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
          style={{
            width: 16,
            height: 16,
            backgroundColor: status.color,
            borderColor: theme.card,
          }}
        >
          <AppIcon icon={status.icon} size={8} color="#FFFFFF" />
        </Center>
      </Box>

      <Text
        className={`flex-1 text-[14px] font-semibold ${
          inactive ? "text-muted-foreground" : "text-foreground"
        }`}
        style={
          inactive && !expired ? { textDecorationLine: "line-through" } : undefined
        }
        numberOfLines={1}
      >
        {isCurrentUser ? "You" : fullName}
      </Text>

      <HStack
        className="items-center gap-1 rounded-full px-2 py-[3px]"
        style={{ backgroundColor: withAlpha(status.color, 0.12) }}
      >
        <Box className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: status.color }} />
        <Text
          className="text-[11px] font-semibold"
          style={{ color: pillText(expired ? "EXPIRED" : assignment.status, theme) }}
        >
          {status.label}
        </Text>
      </HStack>

      {menu ? (
        <ActionMenu
          label={`Actions for ${fullName || "this invitation"}`}
          heading="Action(s)"
          items={[
            { icon: RefreshCw, label: "Resend Invitation", onPress: onResend },
            {
              icon: Trash2,
              label: "Delete Expired Invite",
              onPress: onDelete,
              destructive: true,
            },
          ]}
        />
      ) : null}
    </HStack>
  );

  // Somebody who cannot change the roster gets the same row without the tap.
  // A `disabled` Pressable would drop it to 40%, which reads as unavailable
  // rather than read-only.
  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Removes them from this event"
      className="data-[active=true]:opacity-60"
    >
      {row}
    </Pressable>
  );
}
