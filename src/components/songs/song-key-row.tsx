import MessageSquareText from "lucide-react-native/icons/message-square-text";

import { AppIcon } from "@/components/app-icon";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { OpenButton } from "@/components/open-button";
import { KeyTile } from "@/components/songs/key-tile";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import type { SongKey } from "@/types/song";

const PADDING = 16;
const TILE = 52;
const GAP = 12;

/** Hairlines start past the key tile, under the titles. */
export const SONG_KEY_SEPARATOR_INSET = PADDING + TILE + GAP;

type SongKeyRowProps = {
  entry: SongKey;
  /** Opens the dialog: the key, the comment, and removing it. */
  onEdit: () => void;
};

/**
 * One line of the key journal, led by the key itself: your key, the song and
 * your comment. No library key or step count beside it — not every singer
 * reads those, and the key you sing is the answer the screen is opened for.
 */
export function SongKeyRow({ entry, onEdit }: SongKeyRowProps) {
  const theme = useTheme();

  const myKey = formatKey(entry.pitch, entry.keyQuality);

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title} by ${entry.artist}, your key ${myKey}`}
      accessibilityHint="Change your key or comment"
      className="data-[active=true]:bg-border/40"
    >
      <HStack
        className="items-center"
        style={{ gap: GAP, paddingHorizontal: PADDING, paddingVertical: 12 }}
      >
        <KeyTile pitch={entry.pitch} quality={entry.keyQuality} />

        <VStack className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {entry.title}
          </Text>

          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {entry.artist}
          </Text>

          {entry.notes ? (
            <HStack className="items-start gap-1.5 pt-0.5">
              <Box style={{ paddingTop: 2 }}>
                <AppIcon icon={MessageSquareText} size={12} color={theme.textMuted} />
              </Box>
              <Text
                className="flex-1 text-[12.5px] leading-[17px] text-muted-foreground"
                numberOfLines={2}
              >
                {entry.notes}
              </Text>
            </HStack>
          ) : null}
        </VStack>

        {entry.spotifyUrl || entry.youtubeUrl ? (
          <HStack className="items-center">
            {entry.spotifyUrl ? (
              <OpenButton url={entry.spotifyUrl} label={`Open ${entry.title} in Spotify`}>
                <SpotifyIcon size={15} color={theme.textMuted} />
              </OpenButton>
            ) : null}

            {entry.youtubeUrl ? (
              <OpenButton url={entry.youtubeUrl} label={`Open ${entry.title} in YouTube`}>
                <YoutubeIcon size={16} color={theme.textMuted} />
              </OpenButton>
            ) : null}
          </HStack>
        ) : null}
      </HStack>
    </Pressable>
  );
}

/** Holds the row's shape while the journal loads. */
export function SongKeyRowSkeleton({ index }: { index: number }) {
  const width = [150, 120, 180][index % 3];

  return (
    <HStack
      className="items-center"
      style={{ gap: GAP, paddingHorizontal: PADDING, paddingVertical: 12 }}
    >
      <Skeleton className="rounded-xl" style={{ width: TILE, height: TILE }} />
      <VStack className="gap-2">
        <Skeleton className="h-4 rounded-md" style={{ width }} />
        <Skeleton className="h-3 w-24 rounded-md" />
      </VStack>
    </HStack>
  );
}
