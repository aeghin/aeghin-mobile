import type { AudioPlayer } from "expo-audio";
import { useSegments } from "expo-router";
import AudioLines from "lucide-react-native/icons/audio-lines";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import X from "lucide-react-native/icons/x";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { SkipButton } from "@/components/track-player-dialog";
import {
  NOW_PLAYING_HEIGHT,
  SKIP_SECONDS,
  usePlayerControls,
  useTrackPlayer,
  type Track,
} from "@/components/track-player-provider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * The mini player: what stays on screen once the full player is closed, so a
 * track can be paused or wound back from anywhere in the tabs. The title opens
 * the full player again; ✕ stops the track.
 *
 * On iOS 26 it sits in the tab bar's accessory slot, where Apple Music's does,
 * and `compact` is that slot's inline form beside a minimized tab bar — room
 * for the title and play/pause only. Elsewhere `FloatingNowPlayingBar` floats
 * it above the tab bar.
 */
export function NowPlayingBar({ compact = false }: { compact?: boolean }) {
  const { player, track, expand, stop } = useTrackPlayer();

  if (!track) return null;

  return (
    <Bar
      key={track.attachment.id}
      player={player}
      track={track}
      compact={compact}
      onExpand={expand}
      onStop={stop}
    />
  );
}

const CONTROL = 38;

function Bar({
  player,
  track,
  compact,
  onExpand,
  onStop,
}: {
  player: AudioPlayer;
  track: Track;
  compact: boolean;
  onExpand: () => void;
  onStop: () => void;
}) {
  const theme = useTheme();
  const { wantsToPlay, loading, skip, toggle } = usePlayerControls(player);

  return (
    <HStack className="flex-1 items-center gap-0.5 pl-3 pr-1.5">
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={`${track.songTitle}, ${track.attachment.name}`}
        accessibilityHint="Opens the player"
        className="min-w-0 flex-1 flex-row items-center gap-2.5 self-stretch"
      >
        {compact ? null : (
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 30,
              height: 30,
              backgroundColor: withAlpha(brand.orange, 0.14),
            }}
          >
            <AppIcon icon={AudioLines} size={16} color={brand.orange} />
          </View>
        )}

        <VStack className="min-w-0 flex-1">
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            {track.songTitle}
          </Text>
          {compact ? null : (
            <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
              {track.attachment.name}
            </Text>
          )}
        </VStack>
      </Pressable>

      {compact ? null : (
        <SkipButton
          icon={RotateCcw}
          label={`Back ${SKIP_SECONDS} seconds`}
          onPress={() => skip(-SKIP_SECONDS)}
          size="small"
        />
      )}

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={wantsToPlay ? "Pause" : "Play"}
        className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
        style={{ width: CONTROL, height: CONTROL }}
      >
        {loading ? (
          <Spinner size="small" color={theme.text} />
        ) : (
          <AppIcon icon={wantsToPlay ? Pause : Play} size={22} color={theme.text} />
        )}
      </Pressable>

      {compact ? null : (
        <Pressable
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel="Stop and close the player"
          className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
          style={{ width: CONTROL - 4, height: CONTROL }}
        >
          <AppIcon icon={X} size={18} color={theme.textMuted} />
        </Pressable>
      )}
    </HStack>
  );
}

/** The native tab bar's height above the home indicator: UIKit's before iOS 26, Material's on Android. */
const TAB_BAR_HEIGHT = Platform.OS === "android" ? 80 : 49;

/** Between the card and the tab bar. The rest of `NOW_PLAYING_HEIGHT` is the card. */
const GAP = 8;

/**
 * The bar where there is no accessory slot: a card floating just above the tab bar.
 *
 * Not over the event chat, where it would sit on the composer. iOS presents
 * the chat as a modal over the whole tab bar controller, bar included; Android
 * pushes it inside the tab, so the bar has to step aside itself.
 */
export function FloatingNowPlayingBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { track } = useTrackPlayer();
  const segments = useSegments();

  if (!track || segments.at(-1) === "chat") return null;

  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: insets.bottom + TAB_BAR_HEIGHT + GAP,
        height: NOW_PLAYING_HEIGHT - GAP,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.card,
        boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.18)",
      }}
    >
      <NowPlayingBar />
    </View>
  );
}
