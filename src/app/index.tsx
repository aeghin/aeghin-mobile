import { useUser } from "@clerk/expo";
import { UserButton } from "@clerk/expo/native";
import {
  StyleSheet,
  Text,
  useColorScheme,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/logo";
import { palette } from "@/constants/branding";

export default function Index() {
  const scheme = useColorScheme();
  const theme = palette[scheme === "dark" ? "dark" : "light"];
  const { user } = useUser();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Logo size={32} />

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
    </SafeAreaView>
  );
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
});
