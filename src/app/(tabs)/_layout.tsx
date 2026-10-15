import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, View } from "react-native";

import { FloatingNowPlayingBar, NowPlayingBar } from "@/components/now-playing-bar";
import { OrgSidebar } from "@/components/org-sidebar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { SidebarLayout } from "@/components/sidebar";
import { TrackPlayerDialog } from "@/components/track-player-dialog";
import { TrackPlayerProvider, useTrackPlayer } from "@/components/track-player-provider";
import { brand } from "@/constants/branding";
import { useMyInvitations } from "@/hooks/use-my-invitations";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * iOS 26 gives the tab bar a slot for a mini player — Apple Music's sits in it,
 * and it rides along when the bar minimizes. Earlier iOS and Android have no
 * such slot, so there the bar floats above the tab bar instead.
 */
const HAS_TAB_ACCESSORY =
  Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26;

export default function TabsLayout() {
  const { organization, isPending } = useCurrentOrganization();

  if (isPending) {
    return null;
  }

  if (!organization) {
    return <Redirect href="/organizations" />;
  }

  // Above every tab, so a track keeps playing from one to the next, and inside
  // them, so signing out stops it.
  return (
    <TrackPlayerProvider>
      <Tabs />
    </TrackPlayerProvider>
  );
}

function Tabs() {
  const { track } = useTrackPlayer();

  // The tab's count, as the bell's was: unread rows plus organization
  // invitations not yet opened.
  const notifications = useNotifications();
  const invitations = useMyInvitations();
  const unread =
    (notifications.data?.unreadCount ?? 0) +
    (invitations.data ?? []).filter((invitation) => !invitation.seen).length;

  return (
    <View style={{ flex: 1 }}>
      {/* Around the tab bar as well as the screens: opening the sidebar slides
          the whole app across, so nothing of it sits over the page's buttons. */}
      <SidebarLayout sidebar={<OrgSidebar />}>
        <NativeTabs
          tintColor={brand.orange}
          badgeBackgroundColor={brand.orange}
          minimizeBehavior="onScrollDown"
          disableTransparentOnScrollEdge
        >
          {track && HAS_TAB_ACCESSORY ? (
            <NativeTabs.BottomAccessory>
              <TabAccessory />
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

          {/* Settings lives in the sidebar, as on the web; the bell took its place. */}
          <NativeTabs.Trigger name="notifications">
            <NativeTabs.Trigger.Icon
              sf={{ default: "bell", selected: "bell.fill" }}
              md="notifications"
            />
            <NativeTabs.Trigger.Label>Notifications</NativeTabs.Trigger.Label>
            {unread > 0 ? (
              <NativeTabs.Trigger.Badge>{unread > 99 ? "99+" : String(unread)}</NativeTabs.Trigger.Badge>
            ) : null}
          </NativeTabs.Trigger>
        </NativeTabs>

        {HAS_TAB_ACCESSORY ? null : <FloatingNowPlayingBar />}
      </SidebarLayout>

      <TrackPlayerDialog />
    </View>
  );
}

/** iOS keeps one of these per placement and shows whichever fits the bar. */
function TabAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();

  return <NowPlayingBar compact={placement === "inline"} />;
}
