import { UserProfileView } from "@clerk/expo/native";

import { AppHeader } from "@/components/app-header";
import { VStack } from "@/components/ui/vstack";

/**
 * Clerk's native account management, rendered inline as the tab's whole body.
 * It is not dismissible here — the tab bar is how you leave it.
 *
 * No organization row: the header switcher above already names the current
 * organization and opens the picker, and having both meant saying the same
 * thing twice on one screen.
 *
 * `UserProfileView` is a native view, so it takes a style rather than a class.
 */
export default function SettingsScreen() {
  return (
    <VStack className="flex-1 bg-background">
      <AppHeader />
      <UserProfileView style={{ flex: 1 }} isDismissible={false} />
    </VStack>
  );
}
