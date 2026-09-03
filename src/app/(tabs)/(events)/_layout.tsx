import { Stack } from "expo-router";

/**
 * Native tabs carry no header of their own, so each tab nests a stack to get
 * one — and with it the glass nav bar the organization switcher sits in.
 *
 * The title is empty on purpose. `AppHeader` fills both ends of the bar with
 * the app mark and the organization switcher, and the tab bar already names the
 * section — a centre title would squeeze one of those two off the bar.
 *
 * No `headerLargeTitle` either: the members screen is tuned against an opaque
 * bar with `"never"` content insets, and a large title would put its first card
 * back underneath the header.
 */
export default function EventsLayout() {
  return (
    <Stack screenOptions={{ title: "" }}>
      {/* Declared here rather than in the screen: changing a modal's header
          visibility from inside remounts it and drops its state. */}
      <Stack.Screen
        name="events/[eventId]/chat"
        options={{ presentation: "modal", headerShown: false }}
      />
    </Stack>
  );
}
