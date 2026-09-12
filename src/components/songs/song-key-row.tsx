import StickyNote from "lucide-react-native/icons/sticky-note";
import Trash2 from "lucide-react-native/icons/trash-2";

import { AppIcon } from "@/components/app-icon";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { OPEN_BUTTON_TAP, OpenButton } from "@/components/open-button";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import type { SongKey } from "@/types/song";

const PADDING = 14;

/** Hairlines run the full width: these rows lead with text, like the library's. */
export const SONG_KEY_SEPARATOR_INSET = PADDING;

type SongKeyRowProps = {
  entry: SongKey;
  /** Opens the editor for this entry — the web's pencil, moved onto the row. */
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * One line of the key journal.
 *
 * Your key is the loud thing on the row, in the brand colour, because it is
 * the answer you opened this for. The library's key only appears when it
 * disagrees — a singer who transposes needs to know both, and a singer who
 * doesn't should not have to read the same key twice.
 */
export function SongKeyRow({ entry, onEdit, onDelete }: SongKeyRowProps) {
  const theme = useTheme();

  const myKey = formatKey(entry.pitch, entry.keyQuality);
  const libraryKey =
    entry.libraryPitch && entry.libraryKeyQuality
      ? formatKey(entry.libraryPitch, entry.libraryKeyQuality)
      : null;
  const differsFromLibrary = libraryKey !== null && libraryKey !== myKey;

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title} by ${entry.artist}, your key ${myKey}`}
      accessibilityHint="Edit your key and notes"
      className="data-[active=true]:bg-border/40"
    >
      <VStack className="gap-1" style={{ paddingHorizontal: PADDING, paddingVertical: 11 }}>
        <HStack className="items-center gap-2">
          <Text
            className="flex-1 text-[15px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {entry.title}
          </Text>

          <Box
            className="rounded-md border px-2 py-[1px]"
            style={{
              borderColor: withAlpha(brand.orange, 0.4),
              backgroundColor: withAlpha(brand.orange, 0.1),
            }}
          >
            <Text
              className="text-[12px] font-bold"
              style={{ color: brand.orange, fontVariant: ["tabular-nums"] }}
            >
              {myKey}
            </Text>
          </Box>

          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${entry.title} from my keys`}
            className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
            style={{ width: 26, height: OPEN_BUTTON_TAP }}
          >
            <AppIcon icon={Trash2} size={15} color={theme.textMuted} />
          </Pressable>
        </HStack>

        <HStack className="items-center gap-2">
          <Text className="flex-1 text-[13px] text-muted-foreground" numberOfLines={1}>
            {entry.artist}
          </Text>

          {differsFromLibrary ? (
            <Text
              className="text-[12px] text-muted-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {`library ${libraryKey}`}
            </Text>
          ) : null}
        </HStack>

        {entry.notes ? (
          <HStack className="items-start gap-1.5 pt-0.5">
            <Box style={{ paddingTop: 2 }}>
              <AppIcon icon={StickyNote} size={12} color={theme.textMuted} />
            </Box>
            <Text className="flex-1 text-[12.5px] leading-[17px] text-muted-foreground">
              {entry.notes}
            </Text>
          </HStack>
        ) : null}

        {entry.spotifyUrl || entry.youtubeUrl ? (
          <HStack className="items-center gap-0.5 pt-0.5">
            {entry.spotifyUrl ? (
              <OpenButton
                url={entry.spotifyUrl}
                label={`Open ${entry.title} in Spotify`}
              >
                <SpotifyIcon size={15} color={theme.textMuted} />
              </OpenButton>
            ) : null}

            {entry.youtubeUrl ? (
              <OpenButton
                url={entry.youtubeUrl}
                label={`Open ${entry.title} in YouTube`}
              >
                <YoutubeIcon size={16} color={theme.textMuted} />
              </OpenButton>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
    </Pressable>
  );
}

/** Holds the row's shape while the journal loads. */
export function SongKeyRowSkeleton({ index }: { index: number }) {
  const width = [150, 120, 180][index % 3];

  return (
    <VStack className="gap-2" style={{ paddingHorizontal: PADDING, paddingVertical: 13 }}>
      <Skeleton className="h-4 rounded-md" style={{ width }} />
      <Skeleton className="h-3 w-24 rounded-md" />
    </VStack>
  );
}
