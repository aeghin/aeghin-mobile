import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { getRoleConfig } from "@/lib/config/roles";
import type { OrgRole } from "@/types/organization";

type RoleBadgeProps = {
  role: OrgRole;
};

const SYMBOL_SIZE = 11;

/**
 * The signed-in user's role in an organization. Label, symbol and colors all
 * come from `getRoleConfig`, so this badge and its web twin stay in step.
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  const theme = useTheme();
  const { symbol, label, background, border, foreground } = getRoleConfig(
    role,
    theme,
  );

  return (
    <View
      style={[styles.badge, { backgroundColor: background, borderColor: border }]}
    >
      <SymbolView
        name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
        size={SYMBOL_SIZE}
        tintColor={foreground}
        fallback={<View style={styles.symbolFallback} />}
      />

      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  symbolFallback: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
