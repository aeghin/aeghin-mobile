import { useUser } from "@clerk/expo";
import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, type RowSymbol } from "@/components/list";
import {
  MEMBER_SEPARATOR_INSET,
  MemberRow,
  MemberRowSkeleton,
} from "@/components/member-row";
import { brand } from "@/constants/branding";
import { useMembersList } from "@/hooks/use-members-list";
import { useOrganizationDetails } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/use-theme";
import type { OrgRole, OrganizationMember } from "@/types/organization";

/** Seniority order. The badge on each row is what names the role. */
const ROLE_ORDER: OrgRole[] = ["OWNER", "ADMIN", "MEMBER"];

/** Stable identity so an empty roster does not remake the array each render. */
const NO_MEMBERS: OrganizationMember[] = [];

export default function OrganizationMembersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isPending, isError, refetch, isRefetching } =
    useMembersList(id);

  // Already cached by the screen you arrived from, so the placeholder list is
  // usually the exact length of the real one and nothing shifts on arrival.
  const { data: organization } = useOrganizationDetails(id);
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
    <View style={[styles.screen, { backgroundColor: theme.groupedBackground }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.content,
          // Clears the docked field so the last row can always scroll free.
          { paddingBottom: SEARCH_DOCK_HEIGHT + insets.bottom + 16 },
        ]}
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
          <Card elevated separatorInset={MEMBER_SEPARATOR_INSET}>
            {Array.from({ length: skeletonCount }, (_, index) => (
              <MemberRowSkeleton key={index} index={index} />
            ))}
          </Card>
        ) : roster.length === 0 ? (
          <EmptyState {...emptyStateFor({ isError, needle })} />
        ) : (
          <Card elevated separatorInset={MEMBER_SEPARATOR_INSET}>
            {roster.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isYou={member.email.toLowerCase() === myEmail}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + 10 }]}>
        <View
          style={[
            styles.field,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SymbolView
            name={{ ios: "magnifyingglass", android: "search", web: "search" }}
            size={17}
            tintColor={theme.textMuted}
            fallback={<View />}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search members"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </View>
    </View>
  );
}

/** Everything one row can be matched on, lowercased once per filter pass. */
function searchText(member: OrganizationMember): string {
  return `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase();
}

type EmptyStateProps = {
  symbol: RowSymbol;
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
    <View style={styles.empty}>
      <SymbolView
        name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
        size={40}
        tintColor={theme.textMuted}
        fallback={<View />}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.textMuted }]}>{body}</Text>
    </View>
  );
}

/** Field height plus its padding — what the list must clear at the bottom. */
const SEARCH_DOCK_HEIGHT = 62;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  content: {
    paddingHorizontal: 16,
    // The card is white and so is the nav bar. Without a band of page between
    // them they touch and read as one surface, as if the header ran on into the
    // first row. This is the standard inset above a grouped list's first card.
    paddingTop: 18,
    paddingBottom: 40,
    // Lets the spinner and the empty states stretch to the full viewport, so a
    // short state centres itself instead of hugging the header above a void.
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptyBody: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
  },
});
