import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Mail from "lucide-react-native/icons/mail";
import Megaphone from "lucide-react-native/icons/megaphone";
import SearchX from "lucide-react-native/icons/search-x";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { MemberFilterDialog } from "@/components/members/member-filter-dialog";
import { InsetCard, InsetRow } from "@/components/inset-list";
import {
  MEMBER_SEPARATOR_INSET,
  MemberRow,
  MemberRowSkeleton,
} from "@/components/member-row";
import { EmailOrganizationDialog } from "@/components/members/email-organization-dialog";
import { InviteMemberDialog } from "@/components/members/invite-member-dialog";
import { AppHeader } from "@/components/app-header";
import {
  MembersSearchDock,
  SEARCH_DOCK_CLEARANCE,
} from "@/components/members-search-dock";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useMembersList } from "@/hooks/use-members-list";
import { useOrganizationDetails } from "@/hooks/use-organizations";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg, getRoleConfig } from "@/lib/config/roles";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import {
  NO_FILTERS,
  ORG_ROLE_ORDER,
  activeFilterCount,
  filterMembers,
  isNarrowed,
  type RosterFilters,
} from "@/lib/members/roster";
import type { OrganizationMember } from "@/types/organization";

/** Stable identity so an empty roster does not remake the array each render. */
const NO_MEMBERS: OrganizationMember[] = [];

export default function OrganizationMembersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();

  // The organization comes from the provider, not from a route param: the tabs
  // are permanent and have no `[id]` segment above them to read.
  const { organization } = useCurrentOrganization();
  const id = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const { data, isPending, isError, refetch } = useMembersList(id);
  const pullToRefresh = usePullToRefresh(refetch);

  // Only for the pending count on the invitations row.
  const details = useOrganizationDetails(id);
  const pending = details.data?.pendingInvitationCount ?? 0;

  const [inviting, setInviting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [filtering, setFiltering] = useState(false);

  // Held together rather than as three useStates: every reader below wants the
  // whole set, and `NO_FILTERS` is then one value to reset to.
  const [filters, setFilters] = useState<RosterFilters>(NO_FILTERS);

  const setFilter = <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  // The summary already carries `memberCount`, so the placeholder list is
  // usually the exact length of the real one and nothing shifts on arrival.
  const skeletonCount = Math.min(Math.max(organization?.memberCount ?? 4, 3), 8);

  const members = data ?? NO_MEMBERS;

  // The payload carries no Clerk id, so "you" is matched on email — the one
  // field both Clerk and our own User table are keyed to hold.
  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

  const activeFilters = activeFilterCount(filters);
  const narrowed = isNarrowed(filters);

  const visible = filterMembers(members, filters);

  const roster = ORG_ROLE_ORDER.flatMap((role) =>
    visible.filter((member) => member.role === role),
  );

  return (
    <VStack className="flex-1 bg-grouped">
      <AppHeader />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          // The card is white and so is the nav bar. Without a band of page
          // between them they touch and read as one surface, as if the header
          // ran on into the first row.
          paddingTop: 18,
          // The dock floats over the list, so nothing but this padding
          // keeps the last row out from under it.
          paddingBottom: insets.bottom + SEARCH_DOCK_CLEARANCE,
          // Lets the spinner and the empty states stretch to the full viewport,
          // so a short state centres itself instead of hugging the header.
          flexGrow: 1,
        }}
        // The header is opaque and the list already starts below it; the dock
        // is the screen's own view and adds no inset of its own.
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        // Otherwise the first tap on a row while the keyboard is up only
        // dismisses the keyboard, and the row needs tapping twice.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {canManage && !narrowed ? (
          <InsetCard elevated className="mb-4">
            <InsetRow icon={UserPlus} label="Invite member" onPress={() => setInviting(true)} />
            <InsetRow
              icon={Mail}
              label="Invitations"
              value={pending > 0 ? `${pending} pending` : undefined}
              onPress={() => router.push("/members/invitations")}
            />
            {members.length > 1 ? (
              <InsetRow
                icon={Megaphone}
                label="Email everyone"
                onPress={() => setEmailing(true)}
              />
            ) : null}
          </InsetCard>
        ) : null}

        {/* What the list is currently narrowed to, and the tap that undoes it.
            The dock's badge counts these, but it sits at the far end of the
            screen — this is where somebody looking at a short roster looks. */}
        {activeFilters > 0 && !isPending ? (
          <HStack className="mb-3 flex-wrap items-center gap-1.5">
            <Text className="text-[12px] font-medium text-muted-foreground">
              {`${roster.length} ${roster.length === 1 ? "person" : "people"}`}
            </Text>

            {filters.role !== "ALL" ? (
              <FilterChip
                label={getRoleConfig(filters.role, theme).label}
                onPress={() => setFilter("role", "ALL")}
              />
            ) : null}

            {filters.volunteerRole !== "ALL" ? (
              <FilterChip
                label={getVolunteerRoleConfig(filters.volunteerRole).label}
                onPress={() => setFilter("volunteerRole", "ALL")}
              />
            ) : null}
          </HStack>
        ) : null}

        {isPending ? (
          <InsetCard elevated separatorInset={MEMBER_SEPARATOR_INSET}>
            {Array.from({ length: skeletonCount }, (_, index) => (
              <MemberRowSkeleton key={index} index={index} />
            ))}
          </InsetCard>
        ) : roster.length === 0 ? (
          <EmptyState
            {...emptyStateFor({ isError, filters, canManage })}
            onClear={narrowed ? () => setFilters(NO_FILTERS) : undefined}
          />
        ) : (
          <InsetCard elevated separatorInset={MEMBER_SEPARATOR_INSET}>
            {roster.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isYou={member.email.toLowerCase() === myEmail}
                onPress={() => router.push(`/members/${member.id}`)}
              />
            ))}
          </InsetCard>
        )}
      </ScrollView>

      <MembersSearchDock
        query={filters.query}
        onChange={(value) => setFilter("query", value)}
        activeFilters={activeFilters}
        onOpenFilters={() => setFiltering(true)}
      />

      <MemberFilterDialog
        visible={filtering}
        onClose={() => setFiltering(false)}
        members={members}
        filters={filters}
        onChangeRole={(role) => setFilter("role", role)}
        onChangeVolunteerRole={(role) => setFilter("volunteerRole", role)}
        onClear={() => setFilters((current) => ({ ...NO_FILTERS, query: current.query }))}
      />

      {organization ? (
        <InviteMemberDialog
          visible={inviting}
          onClose={() => setInviting(false)}
          organizationId={organization.id}
          organizationName={organization.name}
        />
      ) : null}

      {organization ? (
        <EmailOrganizationDialog
          visible={emailing}
          onClose={() => setEmailing(false)}
          organizationId={organization.id}
          organizationName={organization.name}
          recipientCount={members.length}
        />
      ) : null}
    </VStack>
  );
}

/** An active filter, and the tap that takes it off again. */
function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
      hitSlop={8}
      className="rounded-full border px-2.5 py-0.5 data-[active=true]:opacity-60"
      style={{ borderColor: theme.border, backgroundColor: theme.surface }}
    >
      <HStack className="items-center gap-1">
        <Text className="text-[12px] font-medium text-foreground">{label}</Text>
        <AppIcon icon={X} size={10} color={theme.textMuted} />
      </HStack>
    </Pressable>
  );
}

type EmptyStateProps = {
  icon: AppIconName;
  title: string;
  body: string;
};

function emptyStateFor({
  isError,
  filters,
  canManage,
}: {
  isError: boolean;
  filters: RosterFilters;
  /** Members match on names alone; only managers are given addresses to match. */
  canManage: boolean;
}): EmptyStateProps {
  if (isError) {
    return {
      icon: CircleAlert,
      title: "Could not load members",
      body: "Pull down to try again.",
    };
  }

  // A filter is the likelier culprit than the term when both are on: it is the
  // one you cannot see by glancing at the field you just typed into.
  if (activeFilterCount(filters) > 0) {
    return {
      icon: SearchX,
      title: "No matches",
      body: filters.query.trim()
        ? "Nobody matches that search and those filters."
        : "Nobody in this organization has that combination.",
    };
  }

  if (filters.query.trim()) {
    return {
      icon: SearchX,
      title: "No matches",
      body: canManage
        ? "Try a different name or email address."
        : "Try a different name.",
    };
  }

  return {
    icon: Users,
    title: "No members yet",
    body: "Invite someone and they'll show up here.",
  };
}

function EmptyState({
  icon,
  title,
  body,
  onClear,
}: EmptyStateProps & { onClear?: () => void }) {
  const theme = useTheme();

  return (
    <VStack space="sm" className="flex-1 items-center justify-center">
      <AppIcon icon={icon} size={40} color={theme.textMuted} />
      <Text className="text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[260px] text-center text-sm text-muted-foreground">
        {body}
      </Text>

      {/* The search field is docked at the bottom and the filters live behind
          a button in it, so a narrowed roster showing nothing has no visible
          cause up here. This is the way back. */}
      {onClear ? (
        <Button
          variant="outline"
          onPress={onClear}
          className="mt-1.5 rounded-xl border-border"
        >
          <ButtonText className="text-brand">Clear search and filters</ButtonText>
        </Button>
      ) : null}
    </VStack>
  );
}
