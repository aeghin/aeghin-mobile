import { Stack } from "expo-router";

/**
 * Read only when a link opens one of this stack's routes directly, so the chat
 * modal below has the list underneath it rather than being the whole history.
 */
export const unstable_settings = { anchor: "index" };

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
    // Not the same setting as the anchor above: this is what the stack opens on
    // when it mounts with no state of its own, which the root stack rebuilding
    // — signing in — does every time. A `Stack.Screen` child registers ahead of
    // the file routes, so without this the chat was the first route registered,
    // and the tab booted into a chat with no `eventId` that could only spin.
    <Stack initialRouteName="index" screenOptions={{ title: "" }}>
      {/* Declared here rather than in the screen: changing a modal's header
          visibility from inside remounts it and drops its state. */}
      <Stack.Screen
        name="events/[eventId]/chat"
        options={{ presentation: "modal", headerShown: false }}
      />
    </Stack>
  );
}
