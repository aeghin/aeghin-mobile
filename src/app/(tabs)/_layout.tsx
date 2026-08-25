import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useCurrentOrganization } from "@/components/organization-provider";
import { brand } from "@/constants/branding";

/**
 * The app's only tab bar. Every tab reads from the current organization, which
 * lives in {@link useCurrentOrganization} rather than in the URL.
 *
 * Each trigger points at a directory holding its own `<Stack/>`: native tabs
 * ship no header of their own, and the docs are explicit that a nested native
 * stack is what "supports both headers and pushing screens". The header is
 * where the organization switcher lives, so every tab needs one.
 *
 * `(events)` is a group so its route is `/`, which keeps the app's root path
 * valid; the other three are real segments and own their own paths. Group or
 * not, both resolve as trigger names — triggers go through `withLayoutContext`
 * exactly like `Tabs.Screen`.
 *
 * The set is fixed for the life of the process: Expo Router cannot add or
 * remove a tab at runtime, and `hidden` remounts the navigator and resets its
 * state. Role varies per organization — OWNER in one, MEMBER in the next — so
 * switching organizations can never change these four. Gate content, not
 * triggers.
 */
export default function TabsLayout() {
  const { organization, isPending } = useCurrentOrganization();

  // Still reading the membership list. Returning null holds the splash rather
  // than flashing the picker at someone who does have an organization.
  if (isPending) {
    return null;
  }

  // No organization chosen, or the remembered one is gone. The picker is the
  // whole app until that is resolved, so it is guarded here once instead of
  // being handled four times over inside the tabs.
  if (!organization) {
    return <Redirect href="/organizations" />;
  }

  return (
    <NativeTabs tintColor={brand.orange} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(events)">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Events</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="songs">
        <NativeTabs.Trigger.Icon sf="music.note.list" md="queue_music" />
        <NativeTabs.Trigger.Label>Songs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="members">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md={{ default: "group", selected: "groups" }}
        />
        <NativeTabs.Trigger.Label>Members</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
