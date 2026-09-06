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
    /**
     * `initialRouteName` is not decoration. A stack with no anchor falls back to
     * the first of its route names, and expo-router puts every screen declared
     * here ahead of the ones it discovers from the filesystem — so the chat
     * modal below would otherwise be this tab's opening screen.
     *
     * It only shows when the navigator has to build its own state instead of
     * reading it off the URL, which is exactly what happens the moment sign-in
     * flips the root guard: the tabs route is created empty and each stack
     * under it starts from its first route name. That put a chat with no
     * `eventId` on screen after the splash — a disabled query, so a spinner
     * that never resolved.
     */
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
