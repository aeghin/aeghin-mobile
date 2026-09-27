import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import AudioLines from "lucide-react-native/icons/audio-lines";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import RotateCw from "lucide-react-native/icons/rotate-cw";
import { useEffect, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner } from "@/components/form-fields";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import type { SongAttachment } from "@/types/song";

/**
 * A song's audio attachment, played in the app.
 *
 * Tracks used to go to Safari the way charts still do, which left their
 * controls to Safari's media page — and that page drops its skip buttons
 * whenever it loses hold of the file's length, which leaving the app and
 * coming back can make it do. Play and pause were all that survived. Drawn
 * here, the ten-second skips are always on screen, and the lock screen shows
 * the same two because they are asked for rather than inferred from the file.
 */

/** What each skip moves. expo-audio's lock screen buttons use the same ten. */
const SKIP_SECONDS = 10;

/** Often enough for the bar to glide rather than tick. */
const UPDATE_INTERVAL_MS = 250;

const PLAY_BUTTON = 64;
const SKIP_BUTTON = 52;
const BAR_HEIGHT = 4;
const THUMB = 14;
/** The bar is thin; the strip that takes the touch is not. */
const SCRUB_HEIGHT = 28;

/** An audio attachment and the title of the song it belongs to. */
export type Track = { attachment: SongAttachment; songTitle: string };

type TrackPlayerDialogProps = {
  visible: boolean;
  /** Kept by the caller after closing, so the card has something to fade out. */
  track: Track | null;
  onClose: () => void;
};

export function TrackPlayerDialog({ visible, track, onClose }: TrackPlayerDialogProps) {
  if (!track) return null;

  return (
    <Dialog
      visible={visible}
      icon={AudioLines}
      title={track.songTitle}
      description={track.attachment.name}
      onClose={onClose}
    >
      {/* The Modal unmounts this once it has faded out, and that is what
          releases the player. Keyed so another track gets a player of its own. */}
      <TrackPlayer key={track.attachment.id} track={track} active={visible} />
    </Dialog>
  );
}

function TrackPlayer({ track, active }: { track: Track; active: boolean }) {
  const player = useAudioPlayer(track.attachment.url, {
    updateInterval: UPDATE_INTERVAL_MS,
  });
  const status = useAudioPlayerStatus(player);

  // Where a drag or a pending seek has put the playhead, shown instead of the
  // player's own position until the player gets there. Skips build on it, so
  // two quick taps go back twenty seconds, not ten.
  const [pinned, setPinned] = useState<number | null>(null);

  useEffect(() => {
    // Stops the moment the dialog is dismissed rather than when its fade ends.
    if (!active) {
      player.pause();
      player.clearLockScreenControls();
      return;
    }

    let cancelled = false;

    // Safari played through the silent switch and kept going in the
    // background, so this does too. `doNotMix` is what gets it a lock screen.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    })
      .catch(() => {})
      .then(() => {
        if (cancelled) return;

        player.setActiveForLockScreen(
          true,
          { title: track.songTitle, artist: track.attachment.name },
          { showSeekBackward: true, showSeekForward: true },
        );
        player.play();
      });

    return () => {
      cancelled = true;
    };
  }, [active, player, track.songTitle, track.attachment.name]);

  const duration =
    Number.isFinite(status.duration) && status.duration > 0 ? status.duration : 0;
  const position =
    pinned ?? (Number.isFinite(status.currentTime) ? status.currentTime : 0);

  // iOS reports a play that is waiting on the network as not playing yet.
  const wantsToPlay =
    status.playing || status.timeControlStatus === "waitingToPlayAtSpecifiedRate";
  const loading = wantsToPlay && status.isBuffering;

  const seek = (seconds: number) => {
    const to = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
    setPinned(to);

    const settle = () => setPinned((current) => (current === to ? null : current));

    // Zero tolerance: left to itself the player lands wherever is cheapest,
    // which can be seconds off — no use for finding the top of a chorus.
    player.seekTo(to, 0, 0).then(settle, settle);
  };

  const skip = (by: number) => seek((pinned ?? player.currentTime) + by);

  const toggle = () => {
    if (wantsToPlay) {
      player.pause();
      return;
    }

    // A finished track sits on its last frame, where play does nothing.
    if (duration > 0 && player.currentTime >= duration - 0.25) seek(0);

    player.play();
  };

  const error = status.error
    ? "This track couldn't be played. Check your connection and try again."
    : null;

  return (
    <>
      <ErrorBanner message={error} />

      <VStack className="gap-1">
        <Scrubber
          position={position}
          duration={duration}
          onScrub={setPinned}
          onSeek={seek}
        />

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

/** A circular arrow with the seconds inside it, the way iOS draws its own. */
function SkipButton({
  icon,
  label,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
      style={{ width: SKIP_BUTTON, height: SKIP_BUTTON }}
    >
      <AppIcon icon={icon} size={34} color={theme.text} />
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        <Text
          className="text-[10px] font-bold text-foreground"
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
