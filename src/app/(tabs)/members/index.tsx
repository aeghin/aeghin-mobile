import { useUser } from "@clerk/expo";
import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import { InsetCard } from "@/components/inset-list";
import {
  MEMBER_SEPARATOR_INSET,
  MemberRow,
  MemberRowSkeleton,
} from "@/components/member-row";
import { AppHeader } from "@/components/app-header";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Input, InputField, InputSlot } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useMembersList } from "@/hooks/use-members-list";
import { useTheme } from "@/hooks/use-theme";
import type { OrgRole, OrganizationMember } from "@/types/organization";

/** Seniority order. The badge on each row is what names the role. */
const ROLE_ORDER: OrgRole[] = ["OWNER", "ADMIN", "MEMBER"];

/** Stable identity so an empty roster does not remake the array each render. */
const NO_MEMBERS: OrganizationMember[] = [];

/** Field height plus its padding — what the list must clear at the bottom. */
const SEARCH_DOCK_HEIGHT = 62;

export default function OrganizationMembersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  // The organization comes from the provider, not from a route param: the tabs
  // are permanent and have no `[id]` segment above them to read.
  const { organization } = useCurrentOrganization();
  const id = organization?.id ?? "";

  const { data, isPending, isError, refetch, isRefetching } =
    useMembersList(id);

  // The summary already carries `memberCount`, so the placeholder list is
  // usually the exact length of the real one and nothing shifts on arrival.
  const skeletonCount = Math.min(Math.max(organization?.memberCount ?? 4, 3), 8);

  const [query, setQuery] = useState("");

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
          paddingBottom: SEARCH_DOCK_HEIGHT + insets.bottom + 16,
          // Lets the spinner and the empty states stretch to the full viewport,
          // so a short state centres itself instead of hugging the header.
          flexGrow: 1,
        }}
        // No search controller in the nav bar, so the header is opaque and the
        // screen already starts below it. "automatic" is only needed when the
        // bar overlays this view.
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
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
              />
            ))}
          </InsetCard>
        )}
      </ScrollView>

      <VStack
        className="absolute inset-x-0 bottom-0 px-4 pt-2.5"
        style={{ paddingBottom: insets.bottom + 10 }}
      >
        <Input className="h-[42px] gap-2 rounded-full border-border bg-card px-3 dark:bg-card">
          <InputSlot>
            <AppSymbol
              name={{ ios: "magnifyingglass", android: "search" }}
              size={17}
              tint={theme.textMuted}
            />
          </InputSlot>

          <InputField
            value={query}
            onChangeText={setQuery}
            placeholder="Search members"
            placeholderTextColor={theme.textMuted}
            className="text-base text-foreground"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </Input>
      </VStack>
    </VStack>
  );
}

/** Everything one row can be matched on, lowercased once per filter pass. */
function searchText(member: OrganizationMember): string {
  return `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase();
}

type EmptyStateProps = {
  symbol: AppSymbolName;
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
      symbol: { ios: "exclamationmark.triangle.fill", android: "warning" },
      title: "Could not load members",
      body: "Pull down to try again.",
    };
  }

  if (needle) {
    return {
      symbol: { ios: "magnifyingglass", android: "search" },
      title: "No matches",
      body: "Try a different name or email address.",
    };
  }

  return {
    symbol: { ios: "person.2.fill", android: "groups" },
    title: "No members yet",
    body: "Invite someone and they'll show up here.",
  };
}

function EmptyState({ symbol, title, body }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <VStack space="sm" className="flex-1 items-center justify-center">
      <AppSymbol name={symbol} size={40} tint={theme.textMuted} />
      <Text className="text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[260px] text-center text-sm text-muted-foreground">
        {body}
      </Text>
    </VStack>
  );
}
