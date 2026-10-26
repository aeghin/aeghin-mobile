import { useRouter } from "expo-router";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronsLeft from "lucide-react-native/icons/chevrons-left";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Mail from "lucide-react-native/icons/mail";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Sparkles from "lucide-react-native/icons/sparkles";
import Trash2 from "lucide-react-native/icons/trash-2";
import UserPlus from "lucide-react-native/icons/user-plus";
import UserRound from "lucide-react-native/icons/user-round";
import UserRoundMinus from "lucide-react-native/icons/user-round-minus";
import Users from "lucide-react-native/icons/users";
import Zap from "lucide-react-native/icons/zap";
import { useState } from "react";
import { Alert } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { ActionMenu, type ActionMenuItem } from "@/components/action-menu";
import { AppIcon } from "@/components/app-icon";
import { AddRolesDialog } from "@/components/events/add-roles-dialog";
import { EmailTeamDialog } from "@/components/events/email-team-dialog";
import {
  DetailButton,
  DetailCard,
  DetailCardHeader,
  DetailCardHeaderSkeleton,
  DetailCount,
} from "@/components/events/event-detail-parts";
import { InviteToEventDialog } from "@/components/events/invite-to-event-dialog";
import { OrgAvatar } from "@/components/org-avatar";
import { ShimmerIcon } from "@/components/shimmer-icon";
import { Tip } from "@/components/tip";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha, type Palette } from "@/constants/branding";
import { useSmartSchedulingAvailable } from "@/hooks/use-billing";
import { useSetSmartScheduling } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { useTip } from "@/hooks/use-tip";
import { getServiceColors, type ServiceColors } from "@/lib/config/service-types";
import {
  getStatusConfig,
  isInactiveStatus,
  ROW_BORDER_ALPHA,
  ROW_FILL_ALPHA,
} from "@/lib/config/status";
import { fillableTeams } from "@/lib/events/fill";
import { roleStanding, type RoleStanding } from "@/lib/events/spots";
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

type RoleGroup = {
  role: VolunteerRole;
  items: EventDetailsAssignment[];
  /** The role against how many it needs. */
  standing: RoleStanding;
};

type Category = {
  key: Team;
  label: string;
  groups: RoleGroup[];
  /** Spots here somebody accepted — three BGVs are three spots. */
  filled: number;
  /** Every spot here. */
  needed: number;
  /** At least one role here has stalled — see {@link hasStalled}. */
  stalled: boolean;
};

/**
 * A spot that has stopped moving on its own.
 *
 * Somebody was invited, it fell through — declined, removed, or the deadline
 * passed with no answer — and nothing is in flight to fill the spot they left.
 * Every invite is somebody wanted there, so a second pianist letting it lapse
 * stalls the role even with the first one confirmed. That is the state a
 * manager has to *do* something about, and it is the only thing the warning
 * glyph marks.
 *
 * Deliberately not "short of people": on a fresh event every category is
 * short, so a glyph on each is decoration rather than a signal, and the count
 * beside it already says `0/4`. What the count cannot say is whether nothing
 * has happened yet or something went wrong.
 */
const hasStalled = (groups: RoleGroup[], now: number) =>
  groups.some(
    (group) =>
      group.standing.open > 0 && group.items.some((item) => !isLive(item, now)),
  );

/** The server lets a role go only while nobody is live on it. */
const isRemovable = (group: RoleGroup, now: number) =>
  !group.items.some((item) => isLive(item, now));

/** Spots somebody accepted, never more than the role needs. */
const filledOf = ({ accepted, needed }: RoleStanding) => Math.min(accepted, needed);

/**
 * What the role's open-spot card says, or null for none. A declined, lapsed or
 * removed row already stands for the spot it left, crossed out, so the card
 * only shows while some open spot has no row at all.
 */
function openSpotLabel(group: RoleGroup, now: number): string | null {
  if (group.items.length === 0) return "No one assigned yet";

  const { open } = group.standing;
  const crossedOut = group.items.filter((item) => !isLive(item, now)).length;

  return open > crossedOut ? `${open} more needed` : null;
}

type EventTeamCardProps = {
  organizationId: string;
  event: EventDetails;
  /** Managers only: take somebody off the event. Live rows become tappable. */
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  /** Managers only: take a role nobody is on off the roster. */
  onRemoveRole?: (role: VolunteerRole) => void;
  /** Managers only: reopen a lapsed invitation. */
  onResendInvite?: (assignment: EventDetailsAssignment) => void;
  /**
   * Managers only: take a lapsed, declined or removed invitation off the
   * roster, which closes the spot it left open.
   */
  onDeleteInvite?: (assignment: EventDetailsAssignment) => void;
  /**
   * The viewer can still say "Can't make it" from the hero's ⋮, so a manager's
   * own accepted row doesn't offer remove, which would skip telling their lead.
   */
  canWithdraw?: boolean;
};

/**
 * Who is on the event, what they answered, and — for a manager — every way to
 * change it.
 *
 * This is where the roster is *worked on*, not merely read: every action that
 * changes it — invite, auto-fill, add roles, email — sits under the title, so
 * staffing several roles never means scrolling the roster to find them. A role
 * nobody is on comes off with a swipe left on its open spot.
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
  onDeleteInvite,
  canWithdraw,
}: EventTeamCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(event.serviceType.color, theme);
  const roles = useRoles();
  const router = useRouter();
  // Every team starts open, so the whole roster reads at a glance. Team is the
  // last card on the screen, so opening everything pushes nothing out of reach.
  // Tracking what was closed rather than what is open means a team that joins
  // later, when a role is added, opens too.
  const [collapsed, setCollapsed] = useState<Team[]>([]);
  // Read once per mount: "has this invitation lapsed" must not flip mid-render.
  const [now] = useState(() => Date.now());

  const [dialog, setDialog] = useState<"invite" | "roles" | "email" | null>(null);

  const swipeTip = useTip("swipeRemoveRole", event.viewer.userId);

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
        standing: roleStanding(role, event.roleSpots, assignments, now),
      }));

    return {
      key,
      label: roles.teamLabel(key),
      groups,
      filled: groups.reduce((count, group) => count + filledOf(group.standing), 0),
      needed: groups.reduce((count, group) => count + group.standing.needed, 0),
      stalled: hasStalled(groups, now),
    };
  }).filter((category) => category.groups.length > 0);

  // Fill with AI: the viewer's teams that still have spots nobody has taken.
  // A team they only back up waits for its lead until the backup is needed.
  const fillable = canManage ? fillableTeams(event, roles, now) : [];

  // Pointed at one role only: the first a manager can swipe in an open team.
  const tipRole =
    onRemoveRole && !swipeTip.seen
      ? categories
          .filter((category) => !collapsed.includes(category.key))
          .flatMap((category) => category.groups)
          .find((group) => isRemovable(group, now) && openSpotLabel(group, now))?.role
      : undefined;

  const spotCount = categories.reduce((count, category) => count + category.needed, 0);
  const filledCount = categories.reduce((count, category) => count + category.filled, 0);

  // The count without the events list's meter: managers saw the pills before
  // they tapped in, and past a dozen roles they stop lining up with anything
  // here. Each team below says which roles are open.
  const fillRate =
    spotCount > 0 ? (
      <HStack
        className="items-baseline gap-1.5"
        accessible
        accessibilityLabel={`${filledCount} of ${spotCount} ${spotCount === 1 ? "spot" : "spots"} filled`}
      >
        {/* The title's size and line, so the count reads as part of the
            header rather than a second headline beside it. */}
        <Text
          className="text-[15px] font-bold leading-[20px] text-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {filledCount}
          <Text className="text-muted-foreground">{`/${spotCount}`}</Text>
        </Text>
        <Text className="text-[13px] text-muted-foreground">
          {spotCount === 1 ? "spot filled" : "spots filled"}
        </Text>
      </HStack>
    ) : undefined;

  const toggle = (key: Team) =>
    setCollapsed((current) =>
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
                  accessibilityState={{ expanded: !collapsed.includes(category.key) }}
                  accessibilityLabel={`${category.label}, ${category.filled} of ${category.needed} filled${
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
                      {`${category.filled}/${category.needed}`}
                    </DetailCount>

                    <Chevron expanded={!collapsed.includes(category.key)} />
                  </HStack>
                </Pressable>

                {!collapsed.includes(category.key) ? (
                  <VStack className="gap-4 px-4 pb-4 pt-0.5">
                    {fillable
                      .filter((entry) => entry.team === category.key)
                      .map((entry) => (
                        <FillRow
                          key={entry.team}
                          open={entry.open}
                          backingUp={entry.backingUp}
                          colors={colors}
                          onPress={() => router.push(`/events/${event.id}/fill?team=${entry.team}`)}
                        />
                      ))}
                    {category.groups.map((group) => (
                      <RoleGroupBlock
                        key={group.role}
                        group={group}
                        currentUserId={viewer.userId}
                        onRemoveAssignment={onRemoveAssignment}
                        onRemoveRole={onRemoveRole}
                        onResendInvite={onResendInvite}
                        onDeleteInvite={onDeleteInvite}
                        canWithdraw={canWithdraw}
                        onDismissTip={group.role === tipRole ? swipeTip.dismiss : undefined}
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

      {/* Managers only, and not merely for the gate: `InviteToEventDialog`
          reads the org roster on mount, not on open, so mounting these for
          everyone bought every member a members fetch they can never use. They
          used to hang off the Manage card, which was already behind `canManage`. */}
      {canManage ? (
        <>
          <InviteToEventDialog
            visible={dialog === "invite"}
            onClose={() => setDialog(null)}
            organizationId={organizationId}
            eventId={event.id}
            rosterRoles={rosterRoles}
            roleSpots={event.roleSpots}
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
            roster={rosterRoles}
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

/** Holds the card's shape while the event loads: one team, two roles. */
export function EventTeamCardSkeleton() {
  return (
    <DetailCard>
      <DetailCardHeaderSkeleton />
      <Divider />

      <HStack className="items-center px-4 py-3">
        <Skeleton startColor="bg-border" style={{ width: 64, height: 14 }} />
      </HStack>

      <VStack className="gap-4 px-4 pb-5 pt-0.5">
        {[130, 100].map((width) => (
          <VStack key={width} className="gap-2">
            <Skeleton startColor="bg-border" style={{ width: 90, height: 11 }} />
            <HStack className="items-center gap-3 rounded-xl border border-border px-3 py-2.5">
              {/* The avatar inside its status ring. */}
              <Skeleton
                startColor="bg-border"
                className="rounded-full"
                style={{ width: AVATAR + 8, height: AVATAR + 8 }}
              />
              <Skeleton startColor="bg-border" style={{ width, height: 13 }} />
            </HStack>
          </VStack>
        ))}
      </VStack>
    </DetailCard>
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
  onDeleteInvite,
  canWithdraw,
  onDismissTip,
  now,
}: {
  group: RoleGroup;
  currentUserId: string;
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  onRemoveRole?: (role: VolunteerRole) => void;
  onResendInvite?: (assignment: EventDetailsAssignment) => void;
  onDeleteInvite?: (assignment: EventDetailsAssignment) => void;
  canWithdraw?: boolean;
  /** Shows the swipe hint under this role; swiping it counts as "Got it". */
  onDismissTip?: () => void;
  now: number;
}) {
  const { label, emoji } = useRoles().get(group.role);
  const { needed } = group.standing;

  const remove =
    onRemoveRole && isRemovable(group, now) ? () => onRemoveRole(group.role) : undefined;

  const openSpot = openSpotLabel(group, now);

  const body = (
    <VStack className="gap-2">
      <HStack className="items-center gap-1.5">
        {/* Emoji ignore `color` and clip against a tight line box, so this one
            carries its own metrics rather than inheriting the label's. */}
        <Text style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Text>

        <Text
          className="shrink text-[11px] font-bold uppercase tracking-[0.7px] text-muted-foreground"
          numberOfLines={1}
        >
          {label}
        </Text>

        <Text
          className="text-[11px] text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {`· ${filledOf(group.standing)}/${needed}`}
        </Text>
      </HStack>

      <VStack className="gap-1.5">
        {group.items.map((assignment) => {
          const lapsed = isLapsed(assignment, now);
          const isCurrentUser = assignment.userId === currentUserId;
          const ownSpot = canWithdraw && isCurrentUser && assignment.status === "ACCEPTED";

          return (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              isCurrentUser={isCurrentUser}
              expired={lapsed}
              onPress={
                onRemoveAssignment && isLive(assignment, now) && !ownSpot
                  ? () => onRemoveAssignment(assignment)
                  : undefined
              }
              onResend={
                onResendInvite && lapsed
                  ? () => onResendInvite(assignment)
                  : undefined
              }
              onDelete={
                onDeleteInvite && (lapsed || isInactiveStatus(assignment.status))
                  ? () => onDeleteInvite(assignment)
                  : undefined
              }
              onRemoveRole={remove}
            />
          );
        })}

        {openSpot ? (
          <OpenSpot label={openSpot} role={label} onRemove={remove} onSwipeOpen={onDismissTip} />
        ) : null}
      </VStack>
    </VStack>
  );

  if (!onDismissTip) return body;

  return (
    <VStack>
      {body}
      <Tip
        icon={ChevronsLeft}
        title="Swipe left to remove a role"
        message="A role with someone on it stays until they're removed."
        onDismiss={onDismissTip}
      />
    </VStack>
  );
}

/**
 * A spot nobody holds, boxed like the people beside it with an empty seat
 * where their avatar sits — the web's resting ring around a blank avatar — and
 * nothing at its end, since inviting is the card's Invite. VoiceOver can't
 * swipe, so the remove rides here as an action.
 */
function OpenSpot({
  label,
  role,
  onRemove,
  onSwipeOpen,
}: {
  label: string;
  role: string;
  /** Managers only, and only while nobody is on the role: the spot swipes. */
  onRemove?: () => void;
  onSwipeOpen?: () => void;
}) {
  const theme = useTheme();

  const row = (
    <HStack
      className="items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{
        borderCurve: "continuous",
        borderColor: theme.border,
        backgroundColor: theme.card,
      }}
    >
      <Center
        className="rounded-full border-2"
        style={{ borderColor: theme.border, padding: 2, backgroundColor: theme.card }}
      >
        <Center
          className="rounded-full"
          style={{
            width: AVATAR,
            height: AVATAR,
            backgroundColor: withAlpha(theme.surface, 0.3),
          }}
        >
          <AppIcon icon={UserRound} size={16} color={theme.textMuted} />
        </Center>
      </Center>

      <Text
        className="flex-1 text-[13px] font-medium"
        style={{ color: theme.destructive }}
        numberOfLines={1}
        accessibilityActions={onRemove ? [{ name: "remove", label: "Remove role" }] : undefined}
        onAccessibilityAction={onRemove}
      >
        {label}
      </Text>
    </HStack>
  );

  if (!onRemove) return row;

  // Only the spot slides, so the button behind it is the spot's own height
  // rather than reaching up past the role's header.
  return (
    <ReanimatedSwipeable
      friction={2}
      overshootRight={false}
      onSwipeableOpen={onSwipeOpen}
      // Opaque, or the action shows through the spot's corners as it slides.
      childrenContainerStyle={{ backgroundColor: theme.card }}
      renderRightActions={(_progress, _translation, methods) => (
        <RemoveRoleAction
          role={role}
          onPress={() => {
            methods.close();
            onRemove();
          }}
        />
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

/**
 * Fill with AI, as a row at the top of a team's section, in the service's
 * colour so it stands out on the roster and invites a tap. Somebody else's
 * team, which the viewer only backs up, is said as a fact, not a request.
 */
function FillRow({
  open,
  backingUp,
  colors,
  onPress,
}: {
  open: number;
  backingUp: string | null;
  colors: ServiceColors;
  onPress: () => void;
}) {
  const spots = open === 1 ? "1 open spot" : `${open} open spots`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Fill with AI, ${spots}${backingUp ? `, ${backingUp}'s team` : ""}`}
      className="data-[active=true]:opacity-60"
    >
      <HStack
        className="items-center gap-3 rounded-xl border px-3 py-2.5"
        style={{
          borderCurve: "continuous",
          borderColor: colors.hairline,
          backgroundColor: withAlpha(colors.base, 0.06),
        }}
      >
        {/* The size of the avatar in its ring on the rows under it. */}
        <Center
          className="rounded-full"
          style={{ width: AVATAR + 8, height: AVATAR + 8, backgroundColor: colors.base }}
        >
          <ShimmerIcon icon={Sparkles} size={18} color="#FFFFFF" />
        </Center>

        <VStack className="flex-1">
          <Text className="text-[14px] font-semibold text-foreground">{spots}</Text>
          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {backingUp ? `${backingUp}'s team` : "AI picks, you approve"}
          </Text>
        </VStack>

        <Box className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.base }}>
          <Text className="text-[12px] font-semibold text-white">Fill with AI</Text>
        </Box>
      </HStack>
    </Pressable>
  );
}

/** Behind an open spot; opens the screen's red confirm. */
function RemoveRoleAction({ role, onPress }: { role: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${role}`}
      className="pl-3 data-[active=true]:opacity-70"
    >
      <Center
        className="flex-1 rounded-xl"
        style={{ width: 72, backgroundColor: theme.destructive, borderCurve: "continuous" }}
      >
        <AppIcon icon={Trash2} size={18} color="#FFFFFF" />
      </Center>
    </Pressable>
  );
}

function AssignmentRow({
  assignment,
  isCurrentUser,
  expired,
  onPress,
  onResend,
  onDelete,
  onRemoveRole,
}: {
  assignment: EventDetailsAssignment;
  isCurrentUser: boolean;
  /** Reads the deadline as well as the status — see {@link isLapsed}. */
  expired: boolean;
  /** Managers only: the row opens the remove-from-event confirmation. */
  onPress?: () => void;
  onResend?: () => void;
  onDelete?: () => void;
  /** Managers only, while nobody is live on the role. */
  onRemoveRole?: () => void;
}) {
  const theme = useTheme();

  // A lapsed invitation shows EXPIRED even while the sweep still has it PENDING.
  const status = getStatusConfig(expired ? "EXPIRED" : assignment.status);
  const inactive = expired || isInactiveStatus(assignment.status);

  // A lapsed invite can go out again. Any crossed-out row can come off, which
  // closes the spot it left, and the role can go with it while nobody is live
  // on it — there's no open-spot card to swipe once every gap is crossed out.
  const menu: ActionMenuItem[] = inactive
    ? [
        ...(expired && onResend
          ? [{ icon: RefreshCw, label: "Resend Invitation", onPress: onResend }]
          : []),
        ...(onDelete
          ? [{ icon: UserRoundMinus, label: "Remove Person", onPress: onDelete, destructive: true }]
          : []),
        ...(onRemoveRole
          ? [{ icon: Trash2, label: "Remove Role", onPress: onRemoveRole, destructive: true }]
          : []),
      ]
    : [];

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
      <Box className="shrink-0">
        {/* The web's `ring-2 ring-offset-2`: a hoop in the status colour with
            the page showing through the gap. On a settled row only the face
            fades — the red ring and badge stay full, or they read pink. */}
        <Center
          className="rounded-full border-2"
          style={{
            borderColor: withAlpha(status.color, status.ringAlpha),
            padding: 2,
            backgroundColor: theme.card,
          }}
        >
          <Box style={{ opacity: inactive ? 0.6 : 1 }}>
            <OrgAvatar
              name={fullName || "?"}
              logoUrl={assignment.user.userImageUrl}
              size={AVATAR}
              shape="circle"
            />
          </Box>
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

      {menu.length > 0 ? (
        <ActionMenu
          label={`Actions for ${fullName || "this invitation"}`}
          heading="Action(s)"
          items={menu}
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
