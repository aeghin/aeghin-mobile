import { UserProfileView } from "@clerk/expo/native";
import { Stack } from "expo-router";

import { VStack } from "@/components/ui/vstack";

/** Clerk's native account management: name, email, password, sessions, sign out. */
export default function AccountScreen() {
  return (
    <VStack className="flex-1 bg-background">
      <Stack.Screen options={{ title: "Account", headerBackTitle: "Settings" }} />
      <UserProfileView style={{ flex: 1 }} isDismissible={false} />
    </VStack>
  );
}
