import type { AudioPlayer } from "expo-audio";
import AudioLines from "lucide-react-native/icons/audio-lines";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import RotateCw from "lucide-react-native/icons/rotate-cw";
import { useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner } from "@/components/form-fields";
import {
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
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * The full player for a song's audio attachment.
 *
 * Tracks used to go to Safari the way charts still do, which left their
 * controls to Safari's media page — and that page drops its skip buttons
 * whenever it loses hold of the file's length, which leaving the app and
 * coming back can make it do. Play and pause were all that survived. Drawn
 * here, the ten-second skips are always on screen, and the lock screen shows
 * the same two because they are asked for rather than inferred from the file.
 *
 * Done leaves the track playing in `NowPlayingBar`; ✕ stops it, the same as
 * the bar's own ✕.
 */

const PLAY_BUTTON = 64;
const BAR_HEIGHT = 4;
const THUMB = 14;
/** The bar is thin; the strip that takes the touch is not. */
const SCRUB_HEIGHT = 28;

export function TrackPlayerDialog() {
  const { player, track, expanded, collapse, stop } = useTrackPlayer();

  // ✕ clears the track while the card is still fading out, so it keeps
  // drawing the last one rather than unmounting mid-fade.
  const [last, setLast] = useState<Track | null>(track);
  if (track && track !== last) setLast(track);

  const shown = track ?? last;
  if (!shown) return null;

  return (
    <Dialog
      visible={expanded}
      icon={AudioLines}
      title={shown.songTitle}
      description={shown.attachment.name}
      closeButton={{ label: "Stop and close the player", onPress: stop }}
      onClose={collapse}
    >
      {/* Keyed so a new track starts with none of the last one's seeking. */}
      <TrackControls key={shown.attachment.id} player={player} />
    </Dialog>
  );
}

function TrackControls({ player }: { player: AudioPlayer }) {
  const { error, duration, position, wantsToPlay, loading, scrub, seek, skip, toggle } =
    usePlayerControls(player);

  return (
    <>
      <ErrorBanner
        message={
          error ? "This track couldn't be played. Check your connection and try again." : null
        }
      />

      <VStack className="gap-1">
        <Scrubber position={position} duration={duration} onScrub={scrub} onSeek={seek} />

        <HStack className="justify-between">
          <Text
            className="text-[12px] text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatClock(position)}
          </Text>
          <Text
            className="text-[12px] text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {duration > 0 ? `-${formatClock(Math.ceil(duration - position))}` : "--:--"}
          </Text>
        </HStack>
      </VStack>

      <HStack className="items-center justify-center gap-7 pb-1">
        <SkipButton
          icon={RotateCcw}
          label={`Back ${SKIP_SECONDS} seconds`}
          onPress={() => skip(-SKIP_SECONDS)}
        />

        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={wantsToPlay ? "Pause" : "Play"}
          className="items-center justify-center rounded-full data-[active=true]:opacity-80"
          style={{
            width: PLAY_BUTTON,
            height: PLAY_BUTTON,
            backgroundColor: brand.orange,
          }}
        >
          {loading ? (
            <Spinner size="small" color="#FFFFFF" />
          ) : (
            <AppIcon icon={wantsToPlay ? Pause : Play} size={28} color="#FFFFFF" />
          )}
        </Pressable>

        <SkipButton
          icon={RotateCw}
          label={`Forward ${SKIP_SECONDS} seconds`}
          onPress={() => skip(SKIP_SECONDS)}
        />
      </HStack>
    </>
  );
}

type ScrubberProps = {
  position: number;
  /** Zero until the player knows it, which leaves the bar inert. */
  duration: number;
  /** Where the finger is while it is down. Letting go seeks instead. */
  onScrub: (seconds: number) => void;
  onSeek: (seconds: number) => void;
};

/**
 * The timeline. A tap jumps, a drag follows the finger and seeks on release.
 *
 * The dialog's body scrolls. Claiming the touch keeps its scroll view out on
 * Android; on iOS one can still take a drag that strays vertical, which ends
 * it with a terminate rather than a release — seeking all the same, to where
 * the finger had got to.
 */
function Scrubber({ position, duration, onScrub, onSeek }: ScrubberProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const seekable = duration > 0 && width > 0;
  const fraction = seekable ? Math.min(position / duration, 1) : 0;

  // The bar's children don't take touches, so this is always measured
  // against the bar itself.
  const secondsAt = (event: GestureResponderEvent) =>
    Math.min(Math.max(event.nativeEvent.locationX / width, 0), 1) * duration;

  const finish = (event: GestureResponderEvent) => onSeek(secondsAt(event));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => seekable}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        onScrub(secondsAt(event));
        return true;
      }}
      onResponderMove={(event) => onScrub(secondsAt(event))}
      onResponderRelease={finish}
      onResponderTerminate={finish}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityValue={{ text: `${formatClock(position)} of ${formatClock(duration)}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        onSeek(
          position +
            (event.nativeEvent.actionName === "increment" ? SKIP_SECONDS : -SKIP_SECONDS),
        )
      }
      style={{ height: SCRUB_HEIGHT, justifyContent: "center" }}
    >
      <View
        pointerEvents="none"
        style={{
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: theme.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${fraction * 100}%`,
            height: "100%",
            backgroundColor: brand.orange,
          }}
        />
      </View>

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: fraction * width - THUMB / 2,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: brand.orange,
        }}
      />
    </View>
  );
}

/** Button, arrow and number sizes for the full player and for the bar. */
const SKIP_SIZES = {
  regular: { button: 52, icon: 34, text: "text-[10px]" },
  small: { button: 38, icon: 26, text: "text-[8px]" },
} as const;

/** A circular arrow with the seconds inside it, the way iOS draws its own. */
export function SkipButton({
  icon,
  label,
  onPress,
  size = "regular",
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  size?: keyof typeof SKIP_SIZES;
}) {
  const theme = useTheme();
  const dimensions = SKIP_SIZES[size];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
      style={{ width: dimensions.button, height: dimensions.button }}
    >
      <AppIcon icon={icon} size={dimensions.icon} color={theme.text} />
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        <Text
          className={`${dimensions.text} font-bold text-foreground`}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {SKIP_SECONDS}
        </Text>
      </View>
    </Pressable>
  );
}

/** `65.4` -> `"1:05"`, `3725` -> `"1:02:05"`. */
function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}`
    : `${minutes}:${secs}`;
}
