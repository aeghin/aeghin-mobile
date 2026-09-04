import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Mail from "lucide-react-native/icons/mail";
import Megaphone from "lucide-react-native/icons/megaphone";
import SearchX from "lucide-react-native/icons/search-x";
import UserPlus from "lucide-react-native/icons/user-plus";
import Users from "lucide-react-native/icons/users";
import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { InsetCard, InsetRow } from "@/components/inset-list";
import {
  MEMBER_SEPARATOR_INSET,
  MemberRow,
  MemberRowSkeleton,
} from "@/components/member-row";
import { EmailOrganizationDialog } from "@/components/members/email-organization-dialog";
import { InviteMemberDialog } from "@/components/members/invite-member-dialog";
import { AppHeader } from "@/components/app-header";
import { useMembersSearch } from "@/components/members-search-provider";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useMembersList } from "@/hooks/use-members-list";
import { useOrganizationDetails } from "@/hooks/use-organizations";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { canManageOrg } from "@/lib/config/roles";
import type { OrgRole, OrganizationMember } from "@/types/organization";

/** Seniority order. The badge on each row is what names the role. */
const ROLE_ORDER: OrgRole[] = ["OWNER", "ADMIN", "MEMBER"];

/** Stable identity so an empty roster does not remake the array each render. */
const NO_MEMBERS: OrganizationMember[] = [];

/** The bottom accessory's height — what the list must clear underneath it. */
const SEARCH_ACCESSORY_HEIGHT = 62;

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

  // The summary already carries `memberCount`, so the placeholder list is
  // usually the exact length of the real one and nothing shifts on arrival.
  const skeletonCount = Math.min(Math.max(organization?.memberCount ?? 4, 3), 8);

  // The field itself is the tab navigator's bottom accessory, mounted up in
  // the tabs layout. Only the term reaches this screen.
  const { query } = useMembersSearch();

  const members = data ?? NO_MEMBERS;
  const needle = query.trim().toLowerCase();

  // The payload carries no Clerk id, so "you" is matched on email — the one
  // field both Clerk and our own User table are keyed to hold.
  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();

  const visible = needle
    ? members.filter((member) => searchText(member).includes(needle))
    : members;

  const roster = ROLE_ORDER.flatMap((role) =>
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
          // Clears the docked field so the last row can always scroll free.
          paddingBottom: SEARCH_ACCESSORY_HEIGHT + insets.bottom + 16,
          // Lets the spinner and the empty states stretch to the full viewport,
          // so a short state centres itself instead of hugging the header.
          flexGrow: 1,
        }}
        // The accessory is the navigator's, not this screen's, so it adds no
        // top inset. The header is opaque and the list already starts below it.
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {canManage && !needle ? (
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

        {isPending ? (
          <InsetCard elevated separatorInset={MEMBER_SEPARATOR_INSET}>
            {Array.from({ length: skeletonCount }, (_, index) => (
              <MemberRowSkeleton key={index} index={index} />
            ))}
          </InsetCard>
        ) : roster.length === 0 ? (
          <EmptyState {...emptyStateFor({ isError, needle })} />
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

/** Everything one row can be matched on, lowercased once per filter pass. */
function searchText(member: OrganizationMember): string {
  return `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase();
}

type EmptyStateProps = {
  icon: AppIconName;
  title: string;
  body: string;
};

function emptyStateFor({
  isError,
  needle,
}: {
  isError: boolean;
  needle: string;
}): EmptyStateProps {
  if (isError) {
    return {
      icon: CircleAlert,
      title: "Could not load members",
      body: "Pull down to try again.",
    };
  }

  if (needle) {
    return {
      icon: SearchX,
      title: "No matches",
      body: "Try a different name or email address.",
    };
  }

  return {
    icon: Users,
    title: "No members yet",
    body: "Invite someone and they'll show up here.",
  };
}

function EmptyState({ icon, title, body }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <VStack space="sm" className="flex-1 items-center justify-center">
      <AppIcon icon={icon} size={40} color={theme.textMuted} />
      <Text className="text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[260px] text-center text-sm text-muted-foreground">
        {body}
      </Text>
    </VStack>
  );
}
