import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, View } from "react-native";

import { FloatingNowPlayingBar, NowPlayingBar } from "@/components/now-playing-bar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { TrackPlayerDialog } from "@/components/track-player-dialog";
import { TrackPlayerProvider, useTrackPlayer } from "@/components/track-player-provider";
import { brand } from "@/constants/branding";

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

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={brand.orange} minimizeBehavior="onScrollDown">
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

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon
            sf={{ default: "gearshape", selected: "gearshape.fill" }}
            md="settings"
          />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {HAS_TAB_ACCESSORY ? null : <FloatingNowPlayingBar />}

      <TrackPlayerDialog />
    </View>
  );
}

/** iOS keeps one of these per placement and shows whichever fits the bar. */
function TabAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();

  return <NowPlayingBar compact={placement === "inline"} />;
}
