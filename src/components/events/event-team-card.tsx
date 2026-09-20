import ChevronDown from "lucide-react-native/icons/chevron-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Hourglass from "lucide-react-native/icons/hourglass";
import Mail from "lucide-react-native/icons/mail";
import Plus from "lucide-react-native/icons/plus";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import Zap from "lucide-react-native/icons/zap";
import { useState } from "react";
import { Alert } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { AddRolesDialog } from "@/components/events/add-roles-dialog";
import { EmailTeamDialog } from "@/components/events/email-team-dialog";
import {
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
import { withAlpha } from "@/constants/branding";
import { useSetSmartScheduling } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors, WASH_STOPS } from "@/lib/config/service-types";
import {
  getStatusConfig,
  isInactiveStatus,
  ROW_BORDER_ALPHA,
  ROW_FILL_ALPHA,
} from "@/lib/config/status";
import {
  getVolunteerRoleConfig,
  roleCategoryConfig,
  roleToCategory,
  ROLE_CATEGORIES,
  ROLE_ORDER,
  type RoleCategory,
} from "@/lib/config/volunteer-roles";
import { failureMessage } from "@/lib/failure";
import { tintedGlow, tintedTopWash } from "@/lib/gradients";
import type {
  EventDetails,
  EventDetailsAssignment,
  VolunteerRole,
} from "@/types/event";

const AVATAR = 34;

/** The web's `h-40` tinted strip across the top of the card. */
const WASH_HEIGHT = 160;

/**
 * The one section that opens by itself.
 *
 * The web accordion defaults to `["band"]` and the phone follows: four
 * sections all open is a screen of scrolling before the setlist, and the band
 * is the group whose gaps are noticed first.
 */
const DEFAULT_OPEN: RoleCategory[] = ["band"];

type RoleGroup = {
  role: VolunteerRole;
  /** Rendered as rows. Lapsed invitations are not in here — see {@link isLapsed}. */
  items: EventDetailsAssignment[];
  /** Lapsed, kept for the card's disclosure and for {@link hasStalled}. */
  expired: EventDetailsAssignment[];
};

type Category = {
  key: RoleCategory;
  label: string;
  groups: RoleGroup[];
  /** Places to fill, not people invited — see {@link slotsOf}. */
  slots: number;
  accepted: number;
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
      // Counts lapsed rows too. They no longer render, and without them here a
      // role whose only invitation expired would drop to zero items and quietly
      // stop being marked — losing the glyph in the one case it most describes.
      (group.items.length > 0 || group.expired.length > 0) &&
      !group.items.some((item) => isLive(item, now)),
  );

/**
 * How many places a set of roles asks for — the number the confirmed count is
 * measured against.
 *
 * A role nobody is on yet still counts as one: it is a hole in the event, and
 * counting only the invitations sent reports an eight-role event with one
 * player on it as `1/1` — fully staffed, which is the opposite of the truth.
 * A role carrying several people counts each of them, so a pair of BGVs asks
 * for two.
 *
 * Only people who **accepted** widen a role past one. An invitation in flight
 * must not move the target, or inviting two players for one open spot reports
 * a four-piece band as `0/5` — and a decline would then shrink the denominator
 * back, so the number a manager is watching moves for reasons that have
 * nothing to do with the event being any more or less staffed. A second
 * *accepted* player is different: there really are two people on that role
 * now, and the count says so.
 */
const slotsOf = (groups: RoleGroup[]) =>
  groups.reduce(
    (count, group) =>
      count +
      Math.max(
        1,
        group.items.filter((item) => item.status === "ACCEPTED").length,
      ),
    0,
  );

type EventTeamCardProps = {
  organizationId: string;
  event: EventDetails;
  /** Managers only: take somebody off the event. Live rows become tappable. */
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  /** Managers only: take an empty role off the roster. */
  onRemoveRole?: (role: VolunteerRole) => void;
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
}: EventTeamCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(event.serviceType.color, theme);
  const [open, setOpen] = useState<RoleCategory[]>(DEFAULT_OPEN);
  // Read once per mount: "has this invitation lapsed" must not flip mid-render.
  const [now] = useState(() => Date.now());

  const [dialog, setDialog] = useState<"invite" | "roles" | "email" | null>(null);

  const smart = useSetSmartScheduling(organizationId, event.id);

  const { assignments, viewer } = event;
  const canManage = viewer.canManage;

  const acceptedCount = assignments.filter(
    (assignment) => assignment.status === "ACCEPTED",
  ).length;

  // Gathered card-wide rather than per role: a marker beside every affected
  // role would grow the card in proportion to how bad the problem is, which is
  // the opposite of what a phone wants.
  const expired = assignments.filter((assignment) => isLapsed(assignment, now));

  // A role belongs on the roster if the event declared it or somebody is on
  // it. The union keeps events created before `rolesNeeded` was persisted
  // intact — the same reason the web takes it.
  const rosterRoles = ROLE_ORDER.filter(
    (role) =>
      event.rolesNeeded.includes(role) ||
      assignments.some((assignment) => assignment.role === role),
  );

  const categories: Category[] = ROLE_CATEGORIES.map((key) => {
    const groups = rosterRoles
      .filter((role) => roleToCategory[role] === key)
      .map((role) => {
        const forRole = assignments.filter(
          (assignment) => assignment.role === role,
        );

        return {
          role,
          // A lapsed invitation leaves the roster rather than holding a slot:
          // nobody is on this role any more, so it should read as needing
          // someone. The names are not lost — the disclosure under the card
          // header keeps them, one tap away and closed by default.
          items: forRole.filter((assignment) => !isLapsed(assignment, now)),
          expired: forRole.filter((assignment) => isLapsed(assignment, now)),
        };
      });

    const items = groups.flatMap((group) => group.items);

    return {
      key,
      label: roleCategoryConfig[key].label,
      groups,
      slots: slotsOf(groups),
      accepted: items.filter((item) => item.status === "ACCEPTED").length,
      stalled: hasStalled(groups, now),
    };
  }).filter((category) => category.groups.length > 0);

  const totalSlots = categories.reduce((count, category) => count + category.slots, 0);

  const toggle = (key: RoleCategory) =>
    setOpen((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const toggleSmart = (enabled: boolean) =>
    smart.mutate(enabled, {
      onError: (error) => Alert.alert("Couldn't update", failureMessage(error)),
    });

  return (
    <>
      <DetailCard>
        {/* The web tints only the top of this card and masks the wash away by
            75% of its height. `overflow-hidden` on the strip clips the blooms
            the way the card's own rounding does there. */}
        <Box
          pointerEvents="none"
          className="absolute inset-x-0 top-0 overflow-hidden"
          style={{ height: WASH_HEIGHT }}
        >
          <Box
            className="absolute inset-0"
            style={tintedTopWash(colors.base, colors.sheenAlpha, WASH_STOPS)}
          />
          <Box
            className="absolute -right-16 -top-16 h-40 w-40 rounded-full"
            style={tintedGlow(colors.base, "lead", colors.glowSoftAlpha)}
          />
          <Box
            className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full"
            style={tintedGlow(colors.base, "trail", colors.glowSoftAlpha)}
          />
        </Box>

        <DetailCardHeader
          icon={Users}
          title="Team"
          trailing={<DetailCount>{`${acceptedCount}/${totalSlots} confirmed`}</DetailCount>}
        />

        {/* The dashboard's three roster-wide actions, on their own line under
            the title exactly as its narrow column puts them. */}
        {canManage ? (
          <HStack className="flex-wrap gap-1 px-3.5 pb-3">
            <ActionChip icon={UserPlus} label="Invite" onPress={() => setDialog("invite")} />
            <ActionChip
              icon={Zap}
              label="Auto-fill"
              checked={event.smartSchedulingEnabled}
              tint={event.smartSchedulingEnabled ? theme.success : undefined}
              busy={smart.isPending}
              onPress={() => toggleSmart(!event.smartSchedulingEnabled)}
            />
            <ActionChip icon={Plus} label="Add roles" onPress={() => setDialog("roles")} />
            {/* The dashboard hides this until somebody has accepted. Here it
                stays: four pills are a fixed row, and one going missing reads
                as a fault rather than as "there is nobody to email yet" — which
                the dialog says in words, and now refuses to send on. */}
            <ActionChip icon={Mail} label="Email" onPress={() => setDialog("email")} />
          </HStack>
        ) : null}

        {canManage && expired.length > 0 ? (
          <ExpiredInvitesDisclosure invitees={expired} />
        ) : null}

        {categories.length === 0 ? (
          <Text className="px-3.5 pb-4 pt-1 text-[13px] text-muted-foreground">
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
                  accessibilityLabel={`${category.label}, ${category.accepted} of ${category.slots} confirmed${
                    category.stalled ? ", needs attention" : ""
                  }`}
                  className="data-[active=true]:bg-border/40"
                >
                  <HStack className="items-center gap-2 px-3.5 py-3">
                    <Text className="flex-1 text-[13.5px] font-semibold text-foreground">
                      {category.label}
                    </Text>

                    {category.stalled ? (
                      <AppIcon icon={CircleAlert} size={13} color={theme.warning} />
                    ) : null}

                    <DetailCount>
                      {`${category.accepted}/${category.slots}`}
                    </DetailCount>

                    <Chevron expanded={open.includes(category.key)} />
                  </HStack>
                </Pressable>

                {open.includes(category.key) ? (
                  <VStack className="gap-4 px-3.5 pb-4 pt-0.5">
                    {category.groups.map((group) => (
                      <RoleGroupBlock
                        key={group.role}
                        group={group}
                        currentUserId={viewer.userId}
                        onRemoveAssignment={onRemoveAssignment}
                        onRemoveRole={onRemoveRole}
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
 * `expiresAt` is a real instant — the moment the window closed — not one of the
 * floating-UTC wall clocks the event dates use, so this formats in the viewer's
 * own zone. Don't align it with the UTC date helpers in `lib/events/format`.
 */
const formatLapsed = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * The invitations on this event that lapsed unanswered.
 *
 * Rendered only when there is something in it and closed by default, so the
 * card costs nothing in the ordinary case. It expands in place behind a
 * chevron — the same disclosure the Smart Scheduling card uses for its log —
 * rather than the popover the dashboard opens on hover. A phone has no hover
 * to open one with, and a floating list is a target the thumb has to chase.
 *
 * Names rather than a bare count: the count alone is what made the old Smart
 * Scheduling chip useless, because it told nobody who to chase.
 */
function ExpiredInvitesDisclosure({
  invitees,
}: {
  invitees: EventDetailsAssignment[];
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  // Newest lapse first: the one most likely still worth chasing.
  const rows = [...invitees].sort(
    (a, b) =>
      new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime(),
  );

  const noun = invitees.length === 1 ? "invite" : "invites";

  return (
    <VStack className="px-3.5 pb-3">
      <Pressable
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${invitees.length} expired ${noun}. ${open ? "Hide" : "Show"} details.`}
        hitSlop={{ top: 10, bottom: 10 }}
        className="data-[active=true]:opacity-60"
      >
        <HStack className="items-center gap-1.5">
          <AppIcon icon={Hourglass} size={12} color={theme.textMuted} />
          <Text
            className="text-[12px] font-semibold text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {`${invitees.length} ${noun} expired`}
          </Text>
          <Box style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <AppIcon icon={ChevronDown} size={11} color={theme.textMuted} />
          </Box>
        </HStack>
      </Pressable>

      {open ? (
        <VStack className="gap-1.5 pt-2">
          {rows.map((assignment) => (
            <HStack key={assignment.id} className="items-baseline gap-2">
              <Text
                className="text-[12.5px] font-medium text-foreground"
                numberOfLines={1}
              >
                {`${assignment.user.firstName} ${assignment.user.lastName}`.trim()}
              </Text>
              <Text
                className="flex-1 text-[11.5px] text-muted-foreground"
                numberOfLines={1}
              >
                {getVolunteerRoleConfig(assignment.role).label}
              </Text>
              <Text
                className="text-[11.5px] text-muted-foreground"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatLapsed(assignment.expiresAt)}
              </Text>
            </HStack>
          ))}
          <Text className="pt-0.5 text-[11.5px] text-muted-foreground">
            Re-invite from the role below to reopen.
          </Text>
        </VStack>
      ) : null}
    </VStack>
  );
}

/**
 * One of the card's roster-wide actions: a small pill, the web's ghost button.
 *
 * Four of these have to sit on one line inside the card, so the padding is
 * tighter than a tap target would otherwise want — `hitSlop` gives the finger
 * back what the box gives up.
 */
function ActionChip({
  icon,
  label,
  onPress,
  tint,
  checked,
  busy,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  /** Colours the pill when the action is *on*, as auto-fill goes green. */
  tint?: string;
  /**
   * Present on a pill that toggles. The label does not spell the state out —
   * the colour carries it — so this is what says "on" to a screen reader,
   * which cannot see the colour at all.
   */
  checked?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const color = tint ?? theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole={checked === undefined ? "button" : "switch"}
      accessibilityLabel={label}
      accessibilityState={checked === undefined ? undefined : { checked }}
      className="rounded-full data-[active=true]:opacity-60"
      style={{ opacity: busy ? 0.5 : 1 }}
    >
      <HStack
        className="items-center gap-1 rounded-full border px-2 py-1.5"
        style={{
          borderColor: tint ? withAlpha(tint, 0.35) : theme.border,
          backgroundColor: tint ? withAlpha(tint, 0.1) : theme.surface,
        }}
      >
        <AppIcon icon={icon} size={12} color={color} />
        <Text className="text-[12px] font-semibold" style={{ color }}>
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
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
  now,
}: {
  group: RoleGroup;
  currentUserId: string;
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  onRemoveRole?: (role: VolunteerRole) => void;
  now: number;
}) {
  const theme = useTheme();
  const { label, emoji } = getVolunteerRoleConfig(group.role);

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
          {group.items.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              isCurrentUser={assignment.userId === currentUserId}
              onPress={
                onRemoveAssignment && isLive(assignment, now)
                  ? () => onRemoveAssignment(assignment)
                  : undefined
              }
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function AssignmentRow({
  assignment,
  isCurrentUser,
  onPress,
}: {
  assignment: EventDetailsAssignment;
  isCurrentUser: boolean;
  /** Managers only: the row opens the remove-from-event confirmation. */
  onPress?: () => void;
}) {
  const theme = useTheme();

  const status = getStatusConfig(assignment.status);
  const inactive = isInactiveStatus(assignment.status);

  const fullName =
    `${assignment.user.firstName} ${assignment.user.lastName}`.trim();

  const row = (
    <HStack
      className="items-center gap-2.5 rounded-xl border px-2.5 py-2"
      style={
        isCurrentUser
          ? {
              borderColor: withAlpha(status.color, ROW_BORDER_ALPHA),
              backgroundColor: withAlpha(status.color, ROW_FILL_ALPHA),
            }
          : { borderColor: theme.border }
      }
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
        className={`flex-1 text-[14px] font-medium ${
          inactive ? "text-muted-foreground" : "text-foreground"
        }`}
        style={inactive ? { textDecorationLine: "line-through" } : undefined}
        numberOfLines={1}
      >
        {isCurrentUser ? "You" : fullName}
      </Text>

      <Text className="text-[11.5px] font-semibold" style={{ color: status.color }}>
        {status.label}
      </Text>
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
