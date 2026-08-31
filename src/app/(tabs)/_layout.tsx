import { Redirect, usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { MembersSearchField } from "@/components/members-search-field";
import { MembersSearchProvider } from "@/components/members-search-provider";
import { useCurrentOrganization } from "@/components/organization-provider";
import { brand } from "@/constants/branding";

export default function TabsLayout() {
  const { organization, isPending } = useCurrentOrganization();
  const pathname = usePathname();

  if (isPending) {
    return null;
  }

  if (!organization) {
    return <Redirect href="/organizations" />;
  }

  // A bottom accessory belongs to the navigator, not to a screen, so the only
  // way to keep it off the other three tabs is to mount it per route. Unlike a
  // trigger this is safe to toggle — the tab set is what cannot change.
  const isMembers = pathname === "/members";

  return (
    <MembersSearchProvider>
      <NativeTabs tintColor={brand.orange} minimizeBehavior="onScrollDown">
        {isMembers ? (
          <NativeTabs.BottomAccessory>
            <MembersSearchField />
          </NativeTabs.BottomAccessory>
        ) : null}

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
    </MembersSearchProvider>
  );
}
