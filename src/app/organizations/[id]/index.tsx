import { useAuth } from "@clerk/expo";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card, Row, SectionLabel } from "@/components/list";
import { OrgAvatar } from "@/components/org-avatar";
import { RoleBadge } from "@/components/role-badge";
import { useOrganizationDetails } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { rememberLastOrganizationId } from "@/lib/last-organization";

export default function OrganizationDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();

  const { data: organization, error } = useOrganizationDetails(id);

  const organizationId = organization?.id;

  useEffect(() => {
    if (userId && organizationId) {
      rememberLastOrganizationId(userId, organizationId);
    }
  }, [userId, organizationId]);

  if (error) {
    // A 404 means the caller is not a member. The row should not have been
    // reachable, so say so rather than offering a retry that cannot succeed.
    const isForbidden = error instanceof ApiError && error.status === 404;

    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={[styles.message, { color: theme.textMuted }]}>
            {isForbidden
              ? "You no longer have access to this organization."
              : "Couldn't load this organization."}
          </Text>
        </View>
      </>
    );
  }

  // Covers the in-flight fetch and the tick before Clerk resolves `userId`.
  if (!organization) {
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.textMuted} />
        </View>
      </>
    );
  }

  const {
    name,
    description,
    logoUrl,
    role,
    memberCount,
    createdAt,
    upcomingEventCount,
    songCount,
    pendingInvitationCount,
  } = organization;

  const canManage = role === "OWNER" || role === "ADMIN";

  return (
    <>
      {/* Feeds the native header in the root stack once the name loads. */}
      <Stack.Screen options={{ title: name }} />

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <OrgAvatar name={name} logoUrl={logoUrl} size={76} />
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
          {description ? (
            <Text style={[styles.description, { color: theme.textMuted }]}>
              {description}
            </Text>
          ) : null}
          <RoleBadge role={role} />
        </View>

        <View
          style={[
            styles.stats,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Stat value={memberCount} label="Members" />
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <Stat value={upcomingEventCount} label="Upcoming" />
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <Stat value={songCount} label="Songs" />
        </View>

        <View style={styles.section}>
          <SectionLabel>Team</SectionLabel>
          <Card>
            <Row
              label="Members"
              symbol={{ ios: "person.2.fill", android: "group" }}
              value={String(memberCount)}
              onPress={() =>
                router.push({
                  pathname: "/organizations/[id]/members",
                  params: { id },
                })
              }
            />
            {canManage ? (
              <Row
                label="Invitations"
                symbol={{ ios: "envelope.fill", android: "mail" }}
                value={
                  pendingInvitationCount > 0
                    ? `${pendingInvitationCount} pending`
                    : "None"
                }
                onPress={() => {}}
              />
            ) : null}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel>Schedule</SectionLabel>
          <Card>
            <Row
              label="Events"
              symbol={{ ios: "calendar", android: "calendar_month" }}
              value={String(upcomingEventCount)}
              onPress={() => {}}
            />
            <Row
              label="Songs"
              symbol={{ ios: "music.note.list", android: "music_note" }}
              value={String(songCount)}
              onPress={() => {}}
            />
          </Card>
        </View>

        {canManage ? (
          <View style={styles.section}>
            <SectionLabel>Organization</SectionLabel>
            <Card>
              <Row
                label="Settings"
                symbol={{ ios: "gearshape.fill", android: "settings" }}
                onPress={() => {}}
              />
            </Card>
          </View>
        ) : null}

        {role !== "OWNER" ? (
          <View style={styles.section}>
            <Card>
              <Row
                label="Leave organization"
                symbol={{
                  ios: "rectangle.portrait.and.arrow.right",
                  android: "logout",
                }}
                destructive
                onPress={() => {}}
              />
            </Card>
          </View>
        ) : null}

        <Text style={[styles.founded, { color: theme.textMuted }]}>
          Created {formatFounded(createdAt)}
        </Text>
      </ScrollView>
    </>
  );
}

type StatProps = {
  value: number;
  label: string;
};

function Stat({ value, label }: StatProps) {
  const theme = useTheme();

  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

/** "February 2026" in the device's locale. */
function formatFounded(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  hero: {
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
    paddingBottom: 22,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    maxWidth: 300,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
  section: {
    marginTop: 24,
  },
  founded: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
});
