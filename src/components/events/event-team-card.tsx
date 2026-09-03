import ChevronDown from "lucide-react-native/icons/chevron-down";
import Users from "lucide-react-native/icons/users";
import { useState } from "react";

import { AppIcon } from "@/components/app-icon";
import {
  DetailCard,
  DetailCardHeader,
  DetailCount,
} from "@/components/events/event-detail-parts";
import { OrgAvatar } from "@/components/org-avatar";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
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
import { tintedGlow, tintedTopWash } from "@/lib/gradients";
import type {
  EventDetailsAssignment,
  ServiceType,
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
  items: EventDetailsAssignment[];
};

type Category = {
  key: RoleCategory;
  label: string;
  groups: RoleGroup[];
  total: number;
  accepted: number;
};

type EventTeamCardProps = {
  assignments: EventDetailsAssignment[];
  /** What the event asked for, which is what makes an unfilled role visible. */
  rolesNeeded: VolunteerRole[];
  /** The viewer's own database id, so their row can be marked. */
  currentUserId: string;
  /** The event's service type, which tints the card's header the way the web does. */
  service: ServiceType;
  /** Managers only: take somebody off the event. Live rows become tappable. */
  onRemoveAssignment?: (assignment: EventDetailsAssignment) => void;
  /** Managers only: take an empty role off the roster. */
  onRemoveRole?: (role: VolunteerRole) => void;
};

/**
 * Who is on the event and what they answered.
 *
 * Declined and canceled people stay on the list rather than disappearing —
 * struck through, as the web shows them. A role that lost somebody is a fact
 * about the event, and a roster that silently shortens hides it.
 */
export function EventTeamCard({
  assignments,
  rolesNeeded,
  currentUserId,
  service,
  onRemoveAssignment,
  onRemoveRole,
}: EventTeamCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);
  const [open, setOpen] = useState<RoleCategory[]>(DEFAULT_OPEN);
  // Read once per mount: "has this invitation lapsed" must not flip mid-render.
  const [now] = useState(() => Date.now());

  const total = assignments.length;
  const acceptedCount = assignments.filter(
    (assignment) => assignment.status === "ACCEPTED",
  ).length;

  // A role belongs on the roster if the event declared it or somebody is on
  // it. The union keeps events created before `rolesNeeded` was persisted
  // intact — the same reason the web takes it.
  const rosterRoles = new Set<VolunteerRole>([
    ...rolesNeeded,
    ...assignments.map((assignment) => assignment.role),
  ]);

  const categories: Category[] = ROLE_CATEGORIES.map((key) => {
    const groups = ROLE_ORDER.filter(
      (role) => roleToCategory[role] === key && rosterRoles.has(role),
    ).map((role) => ({
      role,
      items: assignments.filter((assignment) => assignment.role === role),
    }));

    const items = groups.flatMap((group) => group.items);

    return {
      key,
      label: roleCategoryConfig[key].label,
      groups,
      total: items.length,
      accepted: items.filter((item) => item.status === "ACCEPTED").length,
    };
  }).filter((category) => category.groups.length > 0);

  const toggle = (key: RoleCategory) =>
    setOpen((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  return (
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
        trailing={<DetailCount>{`${acceptedCount}/${total} confirmed`}</DetailCount>}
      />

      {categories.length === 0 ? (
        <Text className="px-3.5 pb-4 pt-1 text-[13px] text-muted-foreground">
          No roles on this event yet.
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
                accessibilityLabel={`${category.label}, ${category.accepted} of ${category.total} confirmed`}
                className="data-[active=true]:bg-border/40"
              >
                <HStack className="items-center gap-2 px-3.5 py-3">
                  <Text className="flex-1 text-[13.5px] font-semibold text-foreground">
                    {category.label}
                  </Text>

                  <DetailCount>
                    {`${category.accepted}/${category.total}`}
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
                      currentUserId={currentUserId}
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

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Removes them from this event" : undefined}
      className="data-[active=true]:opacity-60"
    >
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
    </Pressable>
  );
}
