import { Stack } from "expo-router";

/**
 * Native tabs carry no header of their own, so each tab nests a stack to get
 * one — and with it the glass nav bar the sidebar's menu button sits in.
 *
 * The title is empty on purpose. `AppHeader` puts the menu and the app mark on
 * the left and the screen's own buttons on the right, and the tab bar already
 * names the section; a centre title would squeeze one end off the bar.
 *
 * No `headerLargeTitle` either: the members screen is tuned against an opaque
 * bar with `"never"` content insets, and a large title would put its first card
 * back underneath the header.
 */
export default function MembersLayout() {
  return <Stack screenOptions={{ title: "" }} />;
}
