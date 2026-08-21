import { StyleSheet, Text, View } from "react-native";

import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import type { OrgRole } from "@/types/organization";

type RoleBadgeProps = {
  role: OrgRole;
};

const LABELS: Record<OrgRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

/**
 * The signed-in user's role in an organization. Owner and admin carry the brand
 * tint; member stays neutral so the list doesn't read as all-important.
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  const theme = useTheme();
  const isPrivileged = role === "OWNER" || role === "ADMIN";

  return (
    <View
      style={[
        styles.badge,
        isPrivileged
          ? { backgroundColor: `${brand.orange}1F` }
          : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: isPrivileged ? brand.orange : theme.textMuted },
        ]}
      >
        {LABELS[role]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
