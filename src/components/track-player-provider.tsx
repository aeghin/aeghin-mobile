import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from "expo-audio";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SongAttachment } from "@/types/song";

/**
 * The track the tabs share, and the one player it plays in.
 *
 * It sits above every tab rather than in the screen that started it, so a
 * track keeps playing while someone goes to the chart, the roster or another
 * song. `TrackPlayerDialog` is the full player; `NowPlayingBar` is what stays
 * on screen once that is closed.
 */

/** What each skip moves. expo-audio's lock screen buttons use the same ten. */
export const SKIP_SECONDS = 10;

/** Often enough for the full player's bar to glide rather than tick. */
const UPDATE_INTERVAL_MS = 250;

/**
 * The room the mini player takes above the tab bar while a track is loaded.
 * A tab screen's bottom inset covers the tab bar but not its accessory, so
 * screens add this to their clearance, and the last row, a form's button or
 * the AI panel's input never ends up underneath it. 62 is what the members
 * search field measured when it sat in the same slot.
 */
export const NOW_PLAYING_HEIGHT = 62;

/** An audio attachment and the title of the song it belongs to. */
export type Track = { attachment: SongAttachment; songTitle: string };

type TrackPlayerContextValue = {
  player: AudioPlayer;
  /** Loaded until stopped, whether or not it is playing. */
  track: Track | null;
  /** The full player is up, rather than just the bar. */
  expanded: boolean;
  /** Opens the full player on a track, starting it unless it is the one already loaded. */
  play: (track: Track) => void;
  expand: () => void;
  /** Closes the full player. The track keeps playing in the bar. */
  collapse: () => void;
  /** Unloads the track, which takes the bar and the lock screen controls away. */
  stop: () => void;
};

const TrackPlayerContext = createContext<TrackPlayerContextValue | null>(null);

export function TrackPlayerProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [expanded, setExpanded] = useState(false);

  // A new source gets a new player and releases the old one. With no track
  // this is an idle player: it loads nothing and holds no audio session, so it
  // interrupts nobody's music by existing.
  const player = useAudioPlayer(track?.attachment.url ?? null, {
    updateInterval: UPDATE_INTERVAL_MS,
  });

  useEffect(() => {
    if (!track) return;

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
  }, [player, track]);

  const value = useMemo<TrackPlayerContextValue>(
    () => ({
      player,
      track,
      expanded,
      play: (next) => {
        // Tapping the track that is already loaded just brings the player
        // back, rather than restarting a part someone is halfway through.
        if (next.attachment.id !== track?.attachment.id) {
          player.pause();
          setTrack(next);
        }
        setExpanded(true);
      },
      expand: () => setExpanded(true),
      collapse: () => setExpanded(false),
      stop: () => {
        player.pause();
        player.clearLockScreenControls();
        setExpanded(false);
        setTrack(null);
      },
    }),
    [player, track, expanded],
  );

  return <TrackPlayerContext.Provider value={value}>{children}</TrackPlayerContext.Provider>;
}

export function useTrackPlayer(): TrackPlayerContextValue {
  const value = useContext(TrackPlayerContext);

  if (!value) {
    throw new Error("useTrackPlayer must be used inside <TrackPlayerProvider>.");
  }

  return value;
}

/** What a screen adds to its tab bar clearance while the mini player is up. */
export function useNowPlayingInset(): number {
  return useTrackPlayer().track ? NOW_PLAYING_HEIGHT : 0;
}

/**
 * Play, pause, skips and seeks, shared by the full player and the bar.
 *
 * Each caller gets its own `pinned`: where a drag or a pending seek has put the
 * playhead, shown instead of the player's own position until the player gets
 * there. Skips build on it, so two quick taps go back twenty seconds, not ten.
 */
export function usePlayerControls(player: AudioPlayer) {
  const status = useAudioPlayerStatus(player);
  const [pinned, setPinned] = useState<number | null>(null);

  const duration =
    Number.isFinite(status.duration) && status.duration > 0 ? status.duration : 0;
  const position =
    pinned ?? (Number.isFinite(status.currentTime) ? status.currentTime : 0);

  // iOS reports a play that is waiting on the network as not playing yet.
  const wantsToPlay =
    status.playing || status.timeControlStatus === "waitingToPlayAtSpecifiedRate";

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

  return {
    error: status.error,
    duration,
    position,
    wantsToPlay,
    loading: wantsToPlay && status.isBuffering,
    scrub: setPinned,
    seek,
    skip,
    toggle,
  };
}
