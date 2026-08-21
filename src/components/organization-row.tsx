import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OrgAvatar } from "@/components/org-avatar";
import { RoleBadge } from "@/components/role-badge";
import { useTheme } from "@/hooks/use-theme";
import type { OrganizationSummary } from "@/types/organization";

type OrganizationRowProps = {
  organization: OrganizationSummary;
  onPress: () => void;
};

/** One organization card in the home list. */
export function OrganizationRow({ organization, onPress }: OrganizationRowProps) {
  const theme = useTheme();
  const { name, description, logoUrl, role, memberCount } = organization;

  const members = `${memberCount} ${memberCount === 1 ? "member" : "members"}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${role.toLowerCase()}, ${members}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <OrgAvatar name={name} logoUrl={logoUrl} size={48} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.name, { color: theme.text }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <RoleBadge role={role} />
        </View>

        <Text
          style={[styles.meta, { color: theme.textMuted }]}
          numberOfLines={1}
        >
          {description ? `${members} · ${description}` : members}
        </Text>
      </View>

      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
        size={14}
        tintColor={theme.textMuted}
        fallback={<Text style={{ color: theme.textMuted }}>›</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
  },
});
