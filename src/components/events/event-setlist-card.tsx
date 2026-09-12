import AudioLines from "lucide-react-native/icons/audio-lines";
import FileText from "lucide-react-native/icons/file-text";
import Info from "lucide-react-native/icons/info";
import Music from "lucide-react-native/icons/music";
import Pencil from "lucide-react-native/icons/pencil";

import { AppIcon } from "@/components/app-icon";
import {
  AvatarStack,
  DetailCard,
  DetailCardHeader,
  DetailCount,
  DetailEmpty,
} from "@/components/events/event-detail-parts";
import { SongKeySaveButton } from "@/components/events/song-key-save-button";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { OpenButton } from "@/components/open-button";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { mediaTint, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import { getServiceColors } from "@/lib/config/service-types";
import type { EventSetlistSong, ServiceType } from "@/types/event";
import type { SongAttachment, SongKey } from "@/types/song";

/** The running-order badge. */
const NUMBER = 22;
/** Hairlines start past the position badge, so they line up with the titles. */
const SEPARATOR_INSET = 14 + NUMBER + 10;
/** Assigned faces. The web draws these at 24. */
const VOCALIST = 22;
/** Half the gap between a 28pt `OpenButton` and the 17pt glyph it centres. */
const LINK_SLACK = 5.5;
/** The same, for the 17pt bookmark in its 26pt square. Only the ⊕ is already
 *  flush: it is drawn to its own edge, so the circle *is* the alignment. */
const BOOKMARK_SLACK = 4.5;

type EventSetlistCardProps = {
  setlist: EventSetlistSong[];
  service: ServiceType;
  /** Managers only: a row opens the vocalist picker for that song. */
  onSongPress?: (song: EventSetlistSong) => void;
  /** Managers only: opens the editor. */
  onEdit?: () => void;
  organizationId: string;
  /** The caller sings on this event, so each row offers a one-tap save. */
  canSaveKeys?: boolean;
  /** Their key journal, for telling the three save states apart. */
  myKeys?: SongKey[];
};

/** Stable identity for an event nobody's journal has anything to say about. */
const NO_KEYS: SongKey[] = [];

/**
 * What the band is playing, in order.
 *
 * The key and tempo shown are the *setlist's*, not the library's: a song is
 * often played a step down from how it is filed, and this is the sheet
 * somebody stands behind a guitar reading.
 *
 * Editing lives on the dashboard. The links and charts are the part that has
 * to work from a phone, so those are the only things here that do anything.
 */
export function EventSetlistCard({
  setlist,
  service,
  onSongPress,
  onEdit,
  organizationId,
  canSaveKeys = false,
  myKeys = NO_KEYS,
}: EventSetlistCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);

  // Keyed on the library song, not the setlist row — the journal outlives any
  // one event. An entry whose song has left the library carries no songId and
  // can never match.
  const myKeyBySongId = new Map(
    myKeys.flatMap((entry) =>
      entry.songId === null ? [] : [[entry.songId, entry] as const],
    ),
  );

  return (
    <DetailCard>
      <DetailCardHeader
        icon={Music}
        title="Setlist"
        tint={colors.text}
        trailing={
          <HStack className="items-center gap-3">
            {setlist.length > 0 ? (
              <DetailCount>
                {`${setlist.length} ${setlist.length === 1 ? "song" : "songs"}`}
              </DetailCount>
            ) : null}
            {onEdit ? (
              <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8}>
                <HStack className="items-center gap-1">
                  <AppIcon icon={Pencil} size={12} color={colors.text} />
                  <Text className="text-[13px] font-semibold" style={{ color: colors.text }}>
                    Edit
                  </Text>
                </HStack>
              </Pressable>
            ) : null}
          </HStack>
        }
      />

      {/* The dashboard says this in a tooltip on the ⊕ that opens the picker.
          A phone has neither a hover nor that button, so the instruction moves
          here, under the heading, where it is read once on the way into the
          list. Managers only: nobody else's tap does anything. */}
      {onSongPress && setlist.length > 0 ? (
        <HStack className="items-center gap-1.5 px-3.5 pb-0.5">
          <AppIcon icon={Info} size={11} color={theme.textMuted} />
          <Text className="flex-1 text-[12px] text-muted-foreground">
            Tap a song to assign who sings it.
          </Text>
        </HStack>
      ) : null}

      {setlist.length === 0 ? (
        <DetailEmpty>No setlist added yet.</DetailEmpty>
      ) : (
        <VStack className="pb-1.5">
          {setlist.map((song, index) => (
            <VStack key={song.id}>
              {index > 0 ? (
                <Divider style={{ marginLeft: SEPARATOR_INSET }} />
              ) : null}
              <SetlistRow
                song={song}
                position={index + 1}
                onPress={onSongPress ? () => onSongPress(song) : undefined}
                organizationId={organizationId}
                canSaveKey={canSaveKeys}
                savedEntry={myKeyBySongId.get(song.songId) ?? null}
              />
            </VStack>
          ))}
        </VStack>
      )}
    </DetailCard>
  );
}

function SetlistRow({
  song,
  position,
  onPress,
  organizationId,
  canSaveKey,
  savedEntry,
}: {
  song: EventSetlistSong;
  position: number;
  onPress?: () => void;
  organizationId: string;
  canSaveKey: boolean;
  savedEntry: SongKey | null;
}) {
  const theme = useTheme();

  const minor = song.keyQuality === "MINOR";
  const keyColor = minor ? theme.violet : theme.textMuted;

  const hasLinks =
    Boolean(song.spotifyUrl) ||
    Boolean(song.youtubeUrl) ||
    song.attachments.length > 0;

  // The web's `showPeople`, widened to cover the links. A row with nothing to
  // open, nobody singing it and no key to save skips the line outright rather
  // than paying for an empty one.
  const showControls = hasLinks || song.vocalists.length > 0 || canSaveKey;

  const row = (
    <HStack className="items-start gap-2.5 px-3.5 py-2.5">
      <Center
        className="mt-0.5 shrink-0 rounded-md bg-surface"
        style={{ width: NUMBER, height: NUMBER }}
      >
        <Text
          className="text-[11px] font-bold text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {position}
        </Text>
      </Center>

      <VStack className="min-w-0 flex-1 gap-0.5">
        <HStack className="items-center gap-2">
          <Text
            className="flex-1 text-[14.5px] font-semibold leading-[19px] text-foreground"
            numberOfLines={1}
          >
            {song.title}
          </Text>

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
              {formatKey(song.pitch, song.keyQuality)}
            </Text>
          </Box>
        </HStack>

        <HStack className="items-center gap-2">
          <Text
            className="flex-1 text-[12.5px] text-muted-foreground"
            numberOfLines={1}
          >
            {song.artist}
          </Text>

          <Text
            className="text-[12px] text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {`${song.bpm} bpm · ${song.timeSignature}`}
          </Text>
        </HStack>

        {showControls ? (
          <HStack className="items-center">
            {/* Every control here is a tap square wider than the glyph inside
              it, so each end is pulled out by its own slack — otherwise the
              icons sit indented from the title and artist above them. */}
            <HStack
              className="items-center"
              style={{ marginLeft: -LINK_SLACK }}
            >
              {song.spotifyUrl ? (
                <OpenButton
                  url={song.spotifyUrl}
                  label={`Open ${song.title} in Spotify`}
                >
                  <SpotifyIcon size={17} color={mediaTint.spotify} />
                </OpenButton>
              ) : null}

              {song.youtubeUrl ? (
                <OpenButton
                  url={song.youtubeUrl}
                  label={`Open ${song.title} in YouTube`}
                >
                  <YoutubeIcon size={18} color={mediaTint.youtube} />
                </OpenButton>
              ) : null}

              {song.attachments.map((attachment) => (
                <AttachmentButton key={attachment.id} attachment={attachment} />
              ))}
            </HStack>

            <Box className="flex-1" />

            {/* Who is singing it, then whether it is in your keys — the order
                the dashboard puts them in. */}
            <AvatarStack people={song.vocalists} size={VOCALIST} max={3} />

            {canSaveKey ? (
              <Box className="ml-1.5" style={{ marginRight: -BOOKMARK_SLACK }}>
                <SongKeySaveButton
                  organizationId={organizationId}
                  songId={song.songId}
                  title={song.title}
                  artist={song.artist}
                  pitch={song.pitch}
                  keyQuality={song.keyQuality}
                  savedEntry={savedEntry}
                />
              </Box>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
    </HStack>
  );

  // Somebody who cannot assign vocalists gets the same row without the tap.
  // A `disabled` Pressable would drop it to 40%, which reads as unavailable
  // rather than read-only.
  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Assign vocalists"
      className="data-[active=true]:bg-border/40"
    >
      {row}
    </Pressable>
  );
}

/** A chart or a track, opened in whatever app the device uses for its type. */
function AttachmentButton({ attachment }: { attachment: SongAttachment }) {
  const isPdf = attachment.type === "application/pdf";

  return (
    <OpenButton url={attachment.url} label={`Open ${attachment.name}`}>
      <AppIcon
        icon={isPdf ? FileText : AudioLines}
        size={17}
        color={isPdf ? mediaTint.chart : mediaTint.audio}
      />
    </OpenButton>
  );
}
