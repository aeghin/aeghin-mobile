import { Stack } from "expo-router";

/**
 * Native tabs carry no header of their own, so each tab nests a stack to get
 * one — and with it the glass nav bar the sidebar's menu button sits in. The
 * title is empty for the same reason as every other tab's.
 */
export default function NotificationsLayout() {
  return <Stack screenOptions={{ title: "" }} />;
}
