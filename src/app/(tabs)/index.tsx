import { useAuth, useUser } from "@clerk/expo";
import { UserButton } from "@clerk/expo/native";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/logo";
import { OrganizationRow } from "@/components/organization-row";
import { brand } from "@/constants/branding";
import { useOrganizations } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/use-theme";
import { readLastOrganizationId } from "@/lib/last-organization";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { userId } = useAuth();

  const { data, isPending, isError, error, refetch, isRefetching } =
    useOrganizations();

  const organizations = data ?? [];
  const onCreate = () => {};

  const hasRestored = useRef(false);

  /**
   * Reopens the organization this account was last in, once per mount.
   *
   * The stored id is read here rather than during render — it is a native
   * storage hit, and a render may be discarded before it commits. The
   * membership check means an organization the user has since left is ignored
   * rather than pushed into a 404.
   */
  useEffect(() => {
    if (hasRestored.current || isPending || !userId) {
      return;
    }
    hasRestored.current = true;

    const lastOrganizationId = readLastOrganizationId(userId);
    if (
      lastOrganizationId &&
      data?.some((organization) => organization.id === lastOrganizationId)
    ) {
      router.push(`/organizations/${lastOrganizationId}`);
    }
  }, [data, isPending, userId, router]);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Logo size={48} variant="tile" />

        <View style={styles.headerText}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            {user?.firstName ? `Hi, ${user.firstName}` : "Welcome"}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
          </Text>
        </View>

        <UserButton />
      </View>

      <FlatList
        data={organizations}
        keyExtractor={(organization) => organization.id}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
        ListHeaderComponent={
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: theme.text }]}>
              Organizations
            </Text>
            <Text style={[styles.lede, { color: theme.textMuted }]}>
              {ledeFor({ isPending, isError, count: organizations.length })}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrganizationRow
            organization={item}
            onPress={() => router.push(`/organizations/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          isPending ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.textMuted} />
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <SymbolView
                name={{
                  ios: "exclamationmark.triangle.fill",
                  android: "warning",
                  web: "warning",
                }}
                size={40}
                tintColor={theme.textMuted}
                fallback={<View />}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Could not load organizations
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
                {error.message}
              </Text>
              <Pressable
                onPress={() => refetch()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.retry,
                  { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.retryLabel}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <SymbolView
                name={{
                  ios: "person.2.fill",
                  android: "groups",
                  web: "groups",
                }}
                size={40}
                tintColor={theme.textMuted}
                fallback={<View />}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No organizations yet
              </Text>
              <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
                Create one, or ask an owner to send you an invitation.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isPending || isError ? null : (
            <Pressable
              onPress={onCreate}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.create,
                { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <SymbolView
                name={{
                  ios: "plus.circle.fill",
                  android: "add_circle",
                  web: "add_circle",
                }}
                size={20}
                tintColor={brand.orange}
                fallback={<View />}
              />
              <Text style={styles.createLabel}>Create organization</Text>
            </Pressable>
          )
        }
      />
    </SafeAreaView>
  );
}

type LedeState = {
  isPending: boolean;
  isError: boolean;
  count: number;
};

function ledeFor({ isPending, isError, count }: LedeState): string {
  if (isPending) return "Loading your teams…";
  if (isError) return "Pull down to try again.";
  return count > 0
    ? "Choose a team to work in."
    : "Create a team to get started.";
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  titleBlock: {
    paddingTop: 20,
    paddingBottom: 14,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  lede: {
    fontSize: 15,
  },
  gap: {
    height: 10,
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 40,
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
  create: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  createLabel: {
    color: brand.orange,
    fontSize: 16,
    fontWeight: "600",
  },
  retry: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryLabel: {
    color: brand.orange,
    fontSize: 15,
    fontWeight: "600",
  },
});
