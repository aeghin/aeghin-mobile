import BookmarkCheck from "lucide-react-native/icons/bookmark-check";
import BookmarkPlus from "lucide-react-native/icons/bookmark-plus";
import { Alert } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { OPEN_BUTTON_TAP } from "@/components/open-button";
import { Center } from "@/components/ui/center";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { brand } from "@/constants/branding";
import { useSaveSongKey } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import { failureMessage } from "@/lib/failure";
import type { KeyQuality, Pitch, SongKey } from "@/types/song";

/**
 * One tap from a setlist row into the caller's key journal.
 *
 * Offered only to somebody singing on this event. Three states, because
 * overwriting a key you already wrote down should never be silent: not yet
 * saved, saved at this key, and saved at a different one.
 *
 * The dashboard says which of the three it is in a tooltip, which a phone has
 * no equivalent for. So the colour carries it at a glance, the accessibility
 * label carries it to VoiceOver, and — for the one case that would overwrite
 * something — a confirm carries it in words before anything is written.
 */

const TAP_WIDTH = 26;

type SongKeySaveButtonProps = {
  organizationId: string;
  /** The library song. A setlist can't hold anything else. */
  songId: string;
  title: string;
  artist: string;
  /** The setlist's key for this event — what gets copied across. */
  pitch: Pitch;
  keyQuality: KeyQuality;
  /** The caller's journal entry for this song, if they already have one. */
  savedEntry: SongKey | null;
};

export function SongKeySaveButton({
  organizationId,
  songId,
  title,
  artist,
  pitch,
  keyQuality,
  savedEntry,
}: SongKeySaveButtonProps) {
  const theme = useTheme();
  const save = useSaveSongKey(organizationId);

  const setlistKey = formatKey(pitch, keyQuality);
  const journalKey = savedEntry
    ? formatKey(savedEntry.pitch, savedEntry.keyQuality)
    : null;

  const isSaved = journalKey === setlistKey;
  const isStale = journalKey !== null && !isSaved;

  const label = isSaved
    ? `In your keys as ${setlistKey}`
    : isStale
      ? `Your keys say ${journalKey} — update to ${setlistKey}`
      : `Save ${setlistKey} to your keys`;

  const write = () =>
    save.mutate(
      {
        songId,
        title,
        artist,
        pitch,
        keyQuality,
        // The note you already wrote for this song goes back up unchanged.
        // The save is an upsert, and the action writes whatever notes it is
        // handed — so sending an empty one here would quietly erase it.
        notes: savedEntry?.notes ?? "",
      },
      {
        onError: (error) => Alert.alert("Couldn't save", failureMessage(error)),
      },
    );

  const press = () => {
    if (save.isPending) return;

    if (!isStale) {
      write();
      return;
    }

    Alert.alert(
      "Update your key?",
      `Your keys say ${journalKey} for ${title}. This event is in ${setlistKey}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: `Save ${setlistKey}`, onPress: write },
      ],
    );
  };

  // Saved at this key is nothing to do, so it is drawn rather than pressed: a
  // `disabled` Pressable would render the whole thing at 40% and read as
  // unavailable instead of as done.
  if (isSaved) {
    return (
      <Center
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ width: TAP_WIDTH, height: OPEN_BUTTON_TAP }}
      >
        <AppIcon icon={BookmarkCheck} size={17} color={brand.orange} />
      </Center>
    );
  }

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
      style={{ width: TAP_WIDTH, height: OPEN_BUTTON_TAP }}
    >
      {save.isPending ? (
        <Spinner size="small" color={theme.textMuted} />
      ) : (
        <AppIcon
          icon={BookmarkPlus}
          size={17}
          color={isStale ? theme.warning : theme.textMuted}
        />
      )}
    </Pressable>
  );
}
