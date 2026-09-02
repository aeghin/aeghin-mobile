import AudioLines from "lucide-react-native/icons/audio-lines";
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical";
import FileText from "lucide-react-native/icons/file-text";
import { Linking } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import type { LibrarySong, SongAttachment } from "@/types/song";

const PADDING = 14;

/** Hairlines run the full width here — a song row leads with text, not artwork. */
export const SONG_SEPARATOR_INSET = PADDING;

/** How many themes fit before the row starts counting instead. Web shows 3. */
const THEMES_SHOWN = 3;

/** Tap targets for the links and attachments. Below 28 they get hard to hit. */
const TAP = 28;

type SongRowProps = {
  song: LibrarySong;
  /** Owners and admins get the actions button; everyone else reads the row. */
  canManage: boolean;
  /** Opens the edit/delete menu. The row itself decides nothing. */
  onActions: () => void;
};

/**
 * One song in the library card.
 *
 * The web row is a table on a wide screen and a stack on a narrow one; this is
 * the stack, with the same facts in the same order — what it is, who wrote it,
 * how it is played, what it is about, and what you can open.
 */
export function SongRow({ song, canManage, onActions }: SongRowProps) {
  const theme = useTheme();

  const minor = song.defaultKeyQuality === "MINOR";
  const keyColor = minor ? theme.violet : theme.textMuted;

  const extraThemes = song.themes.length - THEMES_SHOWN;

  return (
    <VStack className="gap-1.5 px-3.5 py-3">
      <HStack className="items-center gap-2">
        <Text
          className="flex-1 text-[15px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {song.title}
        </Text>

        {/* The key is the one field a player looks for first, so it keeps its
            own badge rather than joining the tempo line below. */}
        <Box
          className="rounded-md border px-1.5 py-[1px]"
          style={{
            borderColor: withAlpha(keyColor, 0.3),
            backgroundColor: withAlpha(keyColor, 0.08),
          }}
        >
          <Text
            className="text-[11px] font-semibold"
            style={{ color: keyColor, fontVariant: ["tabular-nums"] }}
          >
            {formatKey(song.defaultPitch, song.defaultKeyQuality)}
          </Text>
        </Box>

        {canManage ? (
          <Pressable
            onPress={onActions}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${song.title}`}
            className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
            style={{ width: 26, height: TAP }}
          >
            <AppIcon icon={EllipsisVertical} size={16} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </HStack>

      <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
        {song.artist}
      </Text>

      <HStack className="items-center gap-2">
        <Text
          className="flex-1 text-[12px] text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
          numberOfLines={1}
        >
          {`${song.bpm} BPM · ${song.timeSignature}`}
        </Text>

        <HStack className="items-center gap-0.5">
          {song.spotifyUrl ? (
            <OpenButton
              url={song.spotifyUrl}
              label={`Open ${song.title} in Spotify`}
            >
              <SpotifyIcon size={15} color={theme.textMuted} />
            </OpenButton>
          ) : null}

          {song.youtubeUrl ? (
            <OpenButton
              url={song.youtubeUrl}
              label={`Open ${song.title} in YouTube`}
            >
              <YoutubeIcon size={16} color={theme.textMuted} />
            </OpenButton>
          ) : null}

          {song.attachments.map((attachment) => (
            <AttachmentButton key={attachment.id} attachment={attachment} />
          ))}
        </HStack>
      </HStack>

      {song.themes.length > 0 ? (
        <HStack className="flex-wrap items-center gap-1 pt-0.5">
          {song.themes.slice(0, THEMES_SHOWN).map((theme) => (
            <Box key={theme} className="rounded bg-surface px-1.5 py-[2px]">
              <Text className="text-[10px] font-medium capitalize text-muted-foreground">
                {theme}
              </Text>
            </Box>
          ))}

          {extraThemes > 0 ? (
            <Text className="text-[10px] text-muted-foreground">
              {`+${extraThemes}`}
            </Text>
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
}

/** A chart or a track, opened in whatever app the device uses for its type. */
function AttachmentButton({ attachment }: { attachment: SongAttachment }) {
  const theme = useTheme();
  const isPdf = attachment.type === "application/pdf";

  return (
    <OpenButton url={attachment.url} label={`Open ${attachment.name}`}>
      <AppIcon
        icon={isPdf ? FileText : AudioLines}
        size={15}
        color={theme.textMuted}
      />
    </OpenButton>
  );
}

type OpenButtonProps = {
  url: string;
  label: string;
  children: React.ReactNode;
};

/**
 * Hands a URL to the system.
 *
 * Nothing is rendered in-app: a Spotify link belongs to Spotify, and a PDF
 * chart to whatever the player already reads charts in.
 */
function OpenButton({ url, label, children }: OpenButtonProps) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
      style={{ width: TAP, height: TAP }}
    >
      {children}
    </Pressable>
  );
}

/** Holds the row's shape while the library loads. */
export function SongRowSkeleton({ index }: { index: number }) {
  // Three repeating widths, so a stack of placeholders reads as a list of
  // different songs rather than one row printed several times.
  const width = [140, 190, 165][index % 3];

  return (
    <VStack className="gap-2 px-3.5 py-3">
      <Skeleton className="h-4 rounded-md" style={{ width }} />
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton className="h-3 w-32 rounded-md" />
    </VStack>
  );
}
