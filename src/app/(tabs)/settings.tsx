import { UserProfileView } from "@clerk/expo/native";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

/**
 * Clerk's native account management, rendered inline as the tab's whole body.
 * It is not dismissible here — the tab bar is how you leave it.
 */
export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <UserProfileView style={styles.profile} isDismissible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  profile: {
    flex: 1,
  },
});
